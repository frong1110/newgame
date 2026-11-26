// 원거리형 몬스터 AI (맵·몬스터 설계안 '몬스터 원형: 원거리형 — 거리를 유지하며 투사체').
//   순찰 → 플레이어가 가까이(aggroRange) 오면 바라보며 거리를 유지(keepMin 보다 가까우면 물러나고, keepMax 보다 멀면 다가옴)
//   → 발사 가능(사거리 안·시야 확보·대기시간 끝)하면 준비 동작(windup): 공격 궤도를 빨간 선으로 보여 줌
//     (처음에는 플레이어를 따라 움직이는 옅은 선, 마지막 aimLockTime 동안은 고정된 진한 선 = 피할 틈)
//   → 준비가 끝나면 탄속이 빠른 탄을 선 방향으로 발사(fire) → 지침(recover) → 대기시간(cooldown) 뒤 반복
// 준비 중 맞아서 경직되거나 속박·빙결 등 제어를 받으면 조준이 끊긴다(interrupt). 수치는 enemies.json 의 ai 항목.
// 난이도(difficulty.json)가 오르면 준비시간(windupTime)이 rangedWindupMul 배로 줄어든다.
import { DIFFICULTY, GAME } from './data/index.js';

export class RangedAI {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.state = 'idle'; // idle | windup | recover
    this.timer = 0;
    this.cooldown = 0;
    this.aim = [1, 0]; // 발사 방향(단위 벡터)
    this.lineEnd = null; // 빨간 선의 끝(세계 좌표: 사거리 끝 또는 처음 닿는 지형)
    this.locked = false;
    this.flash = 0; // 발사 순간 총구 번쩍임
  }

  // 현재 난이도가 반영된 준비시간
  get windupTime() {
    const mul = DIFFICULTY.levels[DIFFICULTY.level]?.rangedWindupMul ?? 1;
    return Math.max(DIFFICULTY.rangedWindupMin, this.cfg.windupTime * mul);
  }

  get holdsFacing() {
    return this.state === 'windup';
  }

  get armored() {
    return false;
  }

  attackBox() {
    return null; // 근접 공격 없음
  }

  interrupt() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.locked = false;
    this.lineEnd = null;
    this.cooldown = this.cfg.cooldown;
  }

  // 총구(몸 중심) → (ax, ay) 방향으로 사거리까지 쏘았을 때 처음 닿는 지형 앞의 점
  rayEnd(e, world, ax, ay) {
    const T = GAME.tileSize, step = 8;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    let x = cx, y = cy;
    for (let d = step; d <= this.cfg.projectileRange; d += step) {
      const nx = cx + ax * d, ny = cy + ay * d;
      if (world.isSolid(Math.floor(nx / T), Math.floor(ny / T))) break;
      x = nx;
      y = ny;
    }
    return [x, y];
  }

  // 플레이어를 향해 지형에 막히지 않는가
  clearShot(e, target, world) {
    const T = GAME.tileSize;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
    const d = Math.hypot(tx - cx, ty - cy) || 1;
    for (let s = 8; s < d; s += 8) {
      if (world.isSolid(Math.floor((cx + ((tx - cx) * s) / d) / T), Math.floor((cy + ((ty - cy) * s) / d) / T))) return false;
    }
    return true;
  }

  aimAt(e, target, world) {
    const dx = target.x + target.w / 2 - (e.x + e.w / 2), dy = target.y + target.h / 2 - (e.y + e.h / 2);
    const d = Math.hypot(dx, dy) || 1;
    this.aim = [dx / d, dy / d];
    this.lineEnd = this.rayEnd(e, world, this.aim[0], this.aim[1]);
  }

  fire(e) {
    const C = this.cfg;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    e.constructor.projectiles?.spawn(cx + this.aim[0] * 16, cy + this.aim[1] * 16, this.aim[0] * C.projectileSpeed, this.aim[1] * C.projectileSpeed, 'enemy', 1, C.projectileRange / C.projectileSpeed);
    this.flash = 0.12;
  }

  update(e, dt, target, world) {
    const C = this.cfg;
    if (this.flash > 0) this.flash -= dt;
    if (this.state === 'windup') {
      this.timer -= dt;
      if (this.timer > C.aimLockTime && target) this.aimAt(e, target, world); // 마지막 aimLockTime 전까지는 플레이어를 따라감
      else this.locked = true;
      if (this.timer <= 0) {
        this.fire(e);
        this.state = 'recover';
        this.timer = C.recoverTime;
        this.locked = false;
        this.lineEnd = null;
      }
      return 0;
    }
    if (this.state === 'recover') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.cooldown = C.cooldown;
      }
      return 0;
    }
    this.cooldown -= dt;
    if (!target) return e.dir * e.stats.moveSpeed;
    const dx = target.x + target.w / 2 - (e.x + e.w / 2), dy = target.y + target.h / 2 - (e.y + e.h / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > C.aggroRange) return e.dir * e.stats.moveSpeed; // 순찰
    e.dir = Math.sign(dx) || e.dir; // 플레이어를 바라봄
    // 너무 가까우면 먼저 물러난다 (뒤가 막혀 물러날 수 없을 때만 그 자리에서 쏨)
    const away = -e.dir;
    const canRetreat = e.groundAhead(world, away) && !e.hitWall;
    if (dist < C.keepMin && canRetreat) return away * C.retreatSpeed;
    if (this.cooldown <= 0 && dist <= C.fireRange && this.clearShot(e, target, world)) {
      this.state = 'windup';
      this.timer = this.windupTime;
      this.locked = false;
      this.aimAt(e, target, world);
      return 0;
    }
    if (dist > C.keepMax) return e.groundAhead(world) ? e.dir * C.approachSpeed : 0;
    return 0;
  }

  // 준비 중: 공격 궤도를 따라 빨간 선(추적 중은 옅게, 고정된 뒤는 진하고 굵게)과 총구 점. 발사 순간 번쩍임
  draw(ctx, px, py, e) {
    const ox = e.x - px, oy = e.y - py; // 세계 좌표 → 화면 좌표 변환
    const cx = e.x + e.w / 2 - ox, cy = e.y + e.h / 2 - oy;
    if (this.state === 'windup' && this.lineEnd) {
      const k = 1 - this.timer / this.windupTime;
      ctx.strokeStyle = this.locked ? 'rgba(255,40,40,0.95)' : `rgba(255,80,80,${0.3 + 0.25 * k})`;
      ctx.lineWidth = this.locked ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(this.lineEnd[0] - ox, this.lineEnd[1] - oy);
      ctx.stroke();
      ctx.fillStyle = this.locked ? '#ff2828' : '#ff7a7a';
      ctx.fillRect(cx + this.aim[0] * 14 - 3, cy + this.aim[1] * 14 - 3, 6, 6);
    }
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(cx + this.aim[0] * 18 - 5, cy + this.aim[1] * 18 - 5, 10, 10);
    }
  }
}
