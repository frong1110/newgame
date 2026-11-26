// 돌격형 몬스터 AI (맵·몬스터 설계안 '몬스터 원형: 돌격형 — 거리를 좁히며 압박').
//   순찰 → 플레이어가 가까이(aggroRange, 같은 높이)면 바라보며 다가옴(approach)
//   → 돌격 거리(chargeRange) 안이면 준비 동작(windup, 머리 위 느낌표) → 돌진(charge, 느낌표 유지)
//   → 지침(recover) → 근접 공격 구간(melee, meleeTime 동안 쫓아다니며 휘두름)
//   → 재사용대기(idle, chargeCooldown 동안 돌격 불가·접근만) → 다시 돌진
//   별의 힘 변이(설계안): burstRadius > 0 이면 돌진이 끝날 때 결정 파편이 터짐 (프로토타입에서는 꺼 둠)
// 맞아서 경직되면 동작이 끊긴다(interrupt). 수치는 enemies.json 의 ai 항목.
export class ChargerAI {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.state = 'idle'; // idle | windup | charge | recover | melee
    this.timer = 0;
    this.cooldown = 0; // 돌격 재사용대기 (idle 에서만 줄어듦)
    this.swing = null; // 근접 공격 중이면 { phase: 'windup'|'active'|'recover', t }
  }

  // 돌격·근접 동작 중이라 방향을 바꾸지 않는 상태 (벽·낭떠러지에서 돌아서지 않음)
  get holdsFacing() {
    return this.state === 'windup' || this.state === 'charge' || (this.state === 'melee' && this.swing !== null);
  }

  // 경직·속박·붙잡힘 등으로 동작이 끊김: 잠깐 쉬었다 다시 시작
  interrupt() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.swing = null;
    this.cooldown = this.cfg.cooldown;
  }

  // 근접 공격이 맞는 영역 (휘두르는 순간만, 아니면 null)
  attackBox(e) {
    if (this.state !== 'melee' || this.swing?.phase !== 'active') return null;
    const R = this.cfg.meleeReach;
    return { x: e.dir > 0 ? e.x + e.w : e.x - R, y: e.y, w: R, h: e.h };
  }

  // e: Enemy, target: 플레이어, 반환: 이번 프레임 가로 속도 (속도 배율은 호출한 쪽이 곱함)
  update(e, dt, target, world) {
    const C = this.cfg;
    if (this.state === 'windup') {
      this.timer -= dt;
      if (this.timer <= 0) this.start('charge', C.chargeMaxTime);
      return 0;
    }
    if (this.state === 'charge') {
      this.timer -= dt;
      if (this.timer <= 0 || e.hitWall || !e.groundAhead(world)) this.endCharge(e);
      return e.dir * C.chargeSpeed;
    }
    if (this.state === 'recover') {
      this.timer -= dt;
      if (this.timer <= 0) this.start('melee', C.meleeTime);
      return 0;
    }
    if (this.state === 'melee') return this.updateMelee(e, dt, target, world);
    this.cooldown -= dt;
    if (!target) return e.dir * e.stats.moveSpeed;
    const dx = target.x + target.w / 2 - (e.x + e.w / 2);
    const dy = target.y + target.h / 2 - (e.y + e.h / 2);
    if (Math.abs(dx) > C.aggroRange || Math.abs(dy) > C.aggroDy) return e.dir * e.stats.moveSpeed; // 순찰
    e.dir = Math.sign(dx) || e.dir; // 플레이어를 바라봄
    const near = Math.abs(dx) <= C.chargeRange; // 근접 공격 직후처럼 바짝 붙어 있어도 재사용대기가 끝나면 돌격 준비
    if (near && this.cooldown <= 0 && e.groundAhead(world)) {
      this.start('windup', C.windupTime);
      return 0;
    }
    if (Math.abs(dx) < C.minChargeDist || !e.groundAhead(world)) return 0; // 가까이 붙었거나 낭떠러지 앞이면 접근을 멈춤
    return e.dir * C.approachSpeed; // 거리를 좁힘
  }

  // 근접 공격 구간: 플레이어를 쫓아가 가까우면 휘두른다 (준비 → 휘두름 → 후딜). 끝나면 돌격 재사용대기에 들어감
  updateMelee(e, dt, target, world) {
    const C = this.cfg;
    this.timer -= dt;
    if (this.swing) {
      const s = this.swing;
      s.t -= dt;
      if (s.t <= 0) {
        if (s.phase === 'windup') this.swing = { phase: 'active', t: C.meleeActive };
        else if (s.phase === 'active') this.swing = { phase: 'recover', t: C.meleeRecover };
        else this.swing = null;
      }
      if (this.timer <= 0 && !this.swing) this.endMelee();
      return 0;
    }
    if (this.timer <= 0) {
      this.endMelee();
      return 0;
    }
    if (!target) return 0;
    const dx = target.x + target.w / 2 - (e.x + e.w / 2);
    e.dir = Math.sign(dx) || e.dir;
    if (Math.abs(dx) <= C.meleeRange) {
      this.swing = { phase: 'windup', t: C.meleeWindup };
      return 0;
    }
    return e.groundAhead(world) ? e.dir * C.meleeApproachSpeed : 0;
  }

  endMelee() {
    this.state = 'idle';
    this.swing = null;
    this.cooldown = this.cfg.chargeCooldown; // 이 시간이 지나야 다시 돌격
  }

  start(state, time) {
    this.state = state;
    this.timer = time;
  }

  endCharge(e) {
    const C = this.cfg;
    if (C.burstRadius > 0) e.shardBurst = { x: e.x + e.w / 2, y: e.y + e.h / 2, r: C.burstRadius, damage: C.burstDamage };
    this.start('recover', C.recoverTime);
  }

  // 돌격: 준비 중 번쩍이는 느낌표, 돌진 중 붉은 느낌표 + 속도선. 근접: 준비 때 흰 점멸, 휘두를 때 앞쪽 타격 영역
  draw(ctx, px, py, e) {
    const bang = (color) => {
      ctx.fillStyle = color;
      ctx.fillRect(px + e.w / 2 - 2, py - 32, 4, 11);
      ctx.fillRect(px + e.w / 2 - 2, py - 18, 4, 4);
    };
    if (this.state === 'windup') {
      const k = 1 - this.timer / this.cfg.windupTime;
      bang(Math.floor(k * 8) % 2 ? '#ffffff' : '#ffcc4d');
    } else if (this.state === 'charge') {
      bang('#ff4d4d');
      ctx.fillStyle = 'rgba(255,204,77,0.55)';
      for (let i = 1; i <= 3; i++) ctx.fillRect(px + (e.dir > 0 ? -i * 12 : e.w + (i - 1) * 12), py + 6 + i * 4, 10, 3);
    } else if (this.state === 'melee' && this.swing) {
      if (this.swing.phase === 'windup') {
        ctx.fillStyle = Math.floor(this.swing.t * 40) % 2 ? '#ffffff' : '#ffcc4d';
        ctx.fillRect(px + e.w / 2 - 3, py - 14, 6, 6);
      } else if (this.swing.phase === 'active') {
        const R = this.cfg.meleeReach;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(e.dir > 0 ? px + e.w : px - R, py + 4, R, e.h - 8);
      }
    }
  }
}
