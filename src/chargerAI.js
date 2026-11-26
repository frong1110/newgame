// 돌격형 몬스터 AI (맵·몬스터 설계안 '몬스터 원형: 돌격형 — 거리를 좁히며 압박').
//   순찰 → 플레이어가 가까이(aggroRange, 같은 높이)면 바라보며 다가옴(approach)
//   → 돌격 거리(chargeRange) 안이면 준비 동작(windup: 멈추고 번쩍, 방향 고정)
//   → 돌진(charge: 벽·낭떠러지·시간 끝까지 직진) → 지침(recover: 서서 쉼) → 대기시간 뒤 다시
//   별의 힘 변이(설계안): burstRadius > 0 이면 돌진이 끝날 때 결정 파편이 터짐 (프로토타입에서는 꺼 둠)
// 맞아서 경직되면 동작이 끊긴다(interrupt). 수치는 enemies.json 의 ai 항목.
export class ChargerAI {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.state = 'idle'; // idle | windup | charge | recover
    this.timer = 0;
    this.cooldown = 0;
  }

  // 경직·속박·붙잡힘 등으로 동작이 끊김: 잠깐 쉬었다 다시 시작
  interrupt() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.cooldown = this.cfg.cooldown;
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
      if (this.timer <= 0) this.start('idle', 0, C.cooldown);
      return 0;
    }
    this.cooldown -= dt;
    if (!target) return e.dir * e.stats.moveSpeed;
    const dx = target.x + target.w / 2 - (e.x + e.w / 2);
    const dy = target.y + target.h / 2 - (e.y + e.h / 2);
    if (Math.abs(dx) > C.aggroRange || Math.abs(dy) > C.aggroDy) return e.dir * e.stats.moveSpeed; // 순찰
    e.dir = Math.sign(dx) || e.dir; // 플레이어를 바라봄
    const near = Math.abs(dx) <= C.chargeRange && Math.abs(dx) >= C.minChargeDist;
    if (near && this.cooldown <= 0 && e.groundAhead(world)) {
      this.start('windup', C.windupTime);
      return 0;
    }
    if (Math.abs(dx) < C.minChargeDist || !e.groundAhead(world)) return 0; // 붙었거나 낭떠러지 앞이면 멈춤
    return e.dir * C.approachSpeed; // 거리를 좁힘
  }

  start(state, time, cooldown = this.cooldown) {
    this.state = state;
    this.timer = time;
    this.cooldown = cooldown;
  }

  endCharge(e) {
    const C = this.cfg;
    if (C.burstRadius > 0) e.shardBurst = { x: e.x + e.w / 2, y: e.y + e.h / 2, r: C.burstRadius, damage: C.burstDamage };
    this.start('recover', C.recoverTime);
  }

  // 준비 동작: 머리 위 느낌표, 돌진 중: 진행 방향 속도선
  draw(ctx, px, py, e) {
    if (this.state === 'windup') {
      const k = 1 - this.timer / this.cfg.windupTime;
      ctx.fillStyle = Math.floor(k * 8) % 2 ? '#ffffff' : '#ffcc4d';
      ctx.fillRect(px + e.w / 2 - 2, py - 30, 4, 10);
      ctx.fillRect(px + e.w / 2 - 2, py - 17, 4, 4);
    } else if (this.state === 'charge') {
      ctx.fillStyle = 'rgba(255,204,77,0.55)';
      for (let i = 1; i <= 3; i++) ctx.fillRect(px + (e.dir > 0 ? -i * 12 : e.w + (i - 1) * 12), py + 6 + i * 4, 10, 3);
    }
  }
}
