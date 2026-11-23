// 테스트용 적. 좌우로 순찰하다가 벽이나 낭떠러지에서 돌아선다.
// 맞으면 넉백·경직, 체력이 0이 되면 사라졌다가 일정 시간 뒤 제자리에서 다시 나타난다.
import { ENEMIES, GAME } from './data/index.js';
import { moveAndCollide, approach } from './physics.js';

export class Enemy {
  constructor(type, spawn) {
    this.type = type;
    this.stats = ENEMIES[type];
    this.spawn = spawn;
    this.w = this.stats.width;
    this.h = this.stats.height;
    this.reset();
  }

  reset() {
    this.x = this.spawn.x + (GAME.tileSize - this.w) / 2;
    this.y = this.spawn.y + (GAME.tileSize - this.h);
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.hp = this.stats.maxHp;
    this.alive = true;
    this.stunTimer = 0;
    this.flashTimer = 0;
    this.respawnTimer = 0;
    this.lastHitId = -1; // 같은 공격에 여러 번 맞지 않도록
  }

  update(dt, world) {
    const S = this.stats;
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.reset();
      return;
    }

    this.flashTimer -= dt;
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vx = approach(this.vx, 0, S.knockbackDecel * dt);
    } else {
      this.vx = this.dir * S.moveSpeed;
    }

    this.vy = Math.min(this.vy + S.gravity * dt, S.maxFallSpeed);
    moveAndCollide(this, world, dt);

    if (this.stunTimer <= 0 && this.onGround) {
      if (this.hitWall || !this.groundAhead(world)) this.dir *= -1;
    }

    if (this.y > world.pixelHeight + GAME.fallRespawnMargin) this.die();
  }

  // 진행 방향 발밑 앞쪽에 땅이 있는지
  groundAhead(world) {
    const T = GAME.tileSize;
    const footX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return world.isSolid(Math.floor(footX / T), Math.floor((this.y + this.h + 1) / T));
  }

  takeHit(damage, fromDir, knockX, knockY, hitId) {
    if (!this.alive || hitId === this.lastHitId) return false;
    this.lastHitId = hitId;
    this.hp -= damage;
    this.vx = fromDir * knockX;
    this.vy = -knockY;
    this.stunTimer = this.stats.stunTime;
    this.flashTimer = this.stats.hitFlashTime;
    this.dir = -fromDir; // 때린 쪽을 바라보게
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    this.alive = false;
    this.respawnTimer = this.stats.respawnTime;
  }

  draw(ctx, cam) {
    if (!this.alive) return;
    const px = Math.round(this.x - cam.x);
    const py = Math.round(this.y - cam.y);
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#c0392b';
    ctx.fillRect(px, py, this.w, this.h);
    // 눈
    ctx.fillStyle = '#111';
    const eyeX = px + this.w / 2 + this.dir * 5;
    ctx.fillRect(eyeX - 5, py + 8, 4, 5);
    ctx.fillRect(eyeX + 2, py + 8, 4, 5);
    // 체력 칸
    const pip = 6, gap = 2;
    const total = this.stats.maxHp * (pip + gap) - gap;
    for (let i = 0; i < this.stats.maxHp; i++) {
      ctx.fillStyle = i < this.hp ? '#2ecc71' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(px + this.w / 2 - total / 2 + i * (pip + gap), py - 9, pip, 4);
    }
  }
}
