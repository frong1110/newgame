// 근접형 몬스터 AI (맵·몬스터 설계안 '몽둥이 간수': 걸어서 접근 → 전조 → 한 번 휘두름 → 후딜 → 다시 접근. 돌격 없음, 이동 느림).
//   순찰 → 플레이어가 같은 높이 aggroRange 안이면 바라보며 접근(approachSpeed)
//   → meleeRange 안이면 전조(windupTime: 머리 위 흰 점멸) → 휘두름(activeTime: 앞쪽 meleeReach 타격 영역) → 후딜(recoverTime) → 다시 접근
// 전조·휘두름 중 맞아서 경직되거나 제어를 받으면 끊긴다(interrupt). 수치는 enemies.json 의 ai 항목.
export class MeleeAI {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.state = 'idle'; // idle | windup | active | recover
    this.timer = 0;
    this.cooldown = 0; // 후딜 뒤 다음 전조까지 (idle 에서만 줄어듦)
  }

  get holdsFacing() { return this.state !== 'idle'; }
  get armored() { return false; }

  interrupt() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.cooldown = this.cfg.cooldown;
  }

  // 휘두르는 순간에만 맞는 영역
  attackBox(e) {
    if (this.state !== 'active') return null;
    const R = this.cfg.meleeReach;
    return { x: e.dir > 0 ? e.x + e.w : e.x - R, y: e.y, w: R, h: e.h };
  }

  update(e, dt, target, world) {
    const C = this.cfg;
    if (this.state !== 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.state === 'windup') this.start('active', C.activeTime);
        else if (this.state === 'active') this.start('recover', C.recoverTime);
        else { this.state = 'idle'; this.cooldown = C.cooldown; }
      }
      return 0;
    }
    this.cooldown -= dt;
    if (!target) return e.dir * e.stats.moveSpeed;
    const dx = target.x + target.w / 2 - (e.x + e.w / 2);
    const dy = target.y + target.h / 2 - (e.y + e.h / 2);
    if (Math.abs(dx) > C.aggroRange || Math.abs(dy) > C.aggroDy) return e.dir * e.stats.moveSpeed; // 순찰
    e.dir = Math.sign(dx) || e.dir; // 플레이어를 바라봄
    if (Math.abs(dx) <= C.meleeRange) {
      if (this.cooldown <= 0) this.start('windup', C.windupTime);
      return 0;
    }
    return e.groundAhead(world) ? e.dir * C.approachSpeed : 0;
  }

  start(state, time) {
    this.state = state;
    this.timer = time;
  }

  draw(ctx, px, py, e) {
    if (this.state === 'windup') {
      ctx.fillStyle = Math.floor(this.timer * 40) % 2 ? '#ffffff' : '#ffcc4d';
      ctx.fillRect(px + e.w / 2 - 3, py - 14, 6, 6);
    } else if (this.state === 'active') {
      const R = this.cfg.meleeReach;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(e.dir > 0 ? px + e.w : px - R, py + 4, R, e.h - 8);
    }
  }
}
