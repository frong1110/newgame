import { moveAndCollide } from './physics.js';

// 플레이어 대시: 8방향 조준, 대시 / 대시 사슬 시작, 대시 이동, 잔상, 무적 판정.
// player.js 의 Player 에 메서드로 붙는다 (applyMixins). this 는 Player.
export class PlayerDash {
  // 대시 중이거나 사슬로 멈칫·날아가는 중 (조작 불가)
  get isDashing() {
    return this.dashTimer > 0 || this.chain.locksPlayer || this.pullChain.locksPlayer || this.slamState !== null;
  }

  get isInvincible() {
    return this.invincibleTimer > 0 || this.dodgeTimer > 0;
  }

  get usesChain() {
    return this.stats.dash.mode === 'chain';
  }

  canDash(stunned) {
    if (stunned || this.isDashing || this.chain.active || this.pullChain.active || this.dashCooldownTimer > 0) return false;
    if (this.usesChain) return true; // 사슬은 대기시간만 있고 공중 횟수 제한 없음
    return this.onGround || this.airDashesUsed < this.stats.dash.maxAirDashes;
  }

  // 방향키 입력 → 대시/사슬 방향 (단위 벡터). 대각선 대시 스킬이 없으면 좌우만
  aim(ix, iy, eightWay = this.stats.dash.directions === 8) {
    const y = eightWay ? iy : 0;
    if (ix === 0 && y === 0) return [this.facing, 0];
    const len = Math.hypot(ix, y);
    return [ix / len, y / len];
  }

  // 대시 키: 대시, 또는 사슬 스킬이 있으면 사슬 던지기
  useDash(ix, iy) {
    const [dx, dy] = this.aim(ix, iy);
    if (dx !== 0) this.facing = Math.sign(dx);
    // 공격을 끊고 사용 (캔슬)
    this.attackTimer = 0;
    this.comboTimer = 0;
    this.ghostTimer = 0;
    if (this.usesChain) {
      this.chain.start(this, dx, dy);
      return;
    }
    const D = this.stats.dash;
    this.dashDirX = dx;
    this.dashDirY = dy;
    this.dashTimer = D.duration;
    this.dashCooldownTimer = D.cooldown;
    this.dodgeTimer = D.duration + D.invincibleExtra;
    if (!this.onGround) this.airDashesUsed++;
  }

  endDash() {
    const D = this.stats.dash;
    this.dashTimer = 0;
    this.vx = this.dashDirX * D.endSpeed;
    this.vy = this.dashDirY < 0 ? this.dashDirY * D.endSpeedY : 0; // 위로 대시했으면 상승을 조금 남긴다
  }

  // 대시 중 이동: 중력 무시, 일정 속도로 직진. 막혀서 거의 못 움직이면 종료
  updateDash(dt, world) {
    const D = this.stats.dash;
    this.dashTimer -= dt;
    this.vx = this.dashDirX * D.speed;
    this.vy = this.dashDirY * D.speed;
    const [x0, y0] = [this.x, this.y];
    moveAndCollide(this, world, dt);
    const moved = Math.hypot(this.x - x0, this.y - y0);
    if (moved < D.speed * dt * 0.3 || this.dashTimer <= 0) this.endDash();
  }

  updateGhosts(dt) {
    const D = this.stats.dash;
    for (const g of this.ghosts) g.t += dt;
    while (this.ghosts.length && this.ghosts[0].t > D.ghostLifetime) this.ghosts.shift();
    if (this.dashTimer > 0 || this.chain.zipping) {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, t: 0 });
        this.ghostTimer = D.ghostInterval;
      }
    }
  }
}
