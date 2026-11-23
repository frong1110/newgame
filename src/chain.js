// 사슬 (대시 트리 2·3번째 스킬). 대시 키로 사슬을 던진다.
//   던지기(throw) → 걸리면 잠깐 멈칫(latch: 사슬이 팽팽해지며 떨림, 플레이어 정지) → 아래 동작
//                 → 지형에 박히면: 그 위치로 빠르게 날아감(zip)
//                 → 적에게 닿으면: onEnemy 가 'zip' 이면 적에게 날아가 붙으며 피해,
//                                   'pull' 이면 적을 내 쪽으로 끌어오며 피해
//                 → 사거리 끝까지 아무것도 없으면: 되감기(retract)
// 수치는 player.json 의 chain 에 있다.
import { GAME } from './data/index.js';
import { moveAndCollide, overlaps } from './physics.js';

const SUBSTEP = 4; // 사슬 끝이 한 번에 움직이는 최대 거리(px). 얇은 지형을 뚫지 않게

export class Chain {
  constructor() {
    this.phase = null; // null | 'throw' | 'latch' | 'zip' | 'pull' | 'retract'
    this.count = 0;
    this.hitstop = 0;
  }

  get active() {
    return this.phase !== null;
  }

  get zipping() {
    return this.phase === 'zip';
  }

  // 플레이어 조작을 막는 단계 (멈칫 + 날아가기)
  get locksPlayer() {
    return this.phase === 'latch' || this.phase === 'zip';
  }

  start(p, dx, dy) {
    const C = p.stats.chain;
    this.phase = 'throw';
    this.dx = dx;
    this.dy = dy;
    [this.hx, this.hy] = center(p);
    this.traveled = 0;
    this.target = null; // 걸린 적
    this.anchor = null; // 박힌 지형 위치
    this.timer = 0;
    this.count++;
    p.dashCooldownTimer = C.cooldown;
  }

  cancel() {
    if (this.target) this.target.pull = null;
    this.phase = null;
    this.target = null;
  }

  // 다음 프레임에 쓸 히트스톱을 꺼내 간다 (main.js)
  takeHitstop() {
    const h = this.hitstop;
    this.hitstop = 0;
    return h;
  }

  update(dt, p, world, enemies) {
    const C = p.stats.chain;
    if (this.phase === 'throw') this.updateThrow(dt, p, world, enemies, C);
    else if (this.phase === 'retract') this.updateRetract(dt, p, C);
    else if (this.phase === 'latch') this.updateLatch(dt, p, C);
    else if (this.phase === 'zip') this.updateZip(dt, p, world, C);
    else if (this.phase === 'pull') this.updatePull(dt, p, C);
  }

  updateThrow(dt, p, world, enemies, C) {
    let remaining = C.speed * dt;
    while (remaining > 0) {
      const step = Math.min(SUBSTEP, remaining, C.range - this.traveled);
      if (step <= 0) {
        this.phase = 'retract';
        return;
      }
      this.hx += this.dx * step;
      this.hy += this.dy * step;
      this.traveled += step;
      remaining -= step;

      const hook = { x: this.hx - C.hookSize / 2, y: this.hy - C.hookSize / 2, w: C.hookSize, h: C.hookSize };
      const enemy = enemies.find((e) => e.alive && overlaps(hook, e));
      if (enemy) {
        this.target = enemy;
        const pulling = C.onEnemy === 'pull';
        // 멈칫하는 동안 적도 그 자리에 붙잡아 둔다 (속도 0 으로 끌기)
        const [ex, ey] = center(enemy);
        enemy.pull = { x: ex, y: ey, speed: 0 };
        enemy.flashTimer = enemy.stats.hitFlashTime;
        return this.latch(pulling ? 'pull' : 'zip', pulling ? C.pullLatchTime : C.latchTime);
      }
      const T = GAME.tileSize;
      if (world.isSolid(Math.floor(this.hx / T), Math.floor(this.hy / T))) {
        // 박힌 지점에서 살짝 물러난 곳을 목표로 (몸이 지형에 끼지 않게)
        this.anchor = { x: this.hx - this.dx * (p.w / 2 + 2), y: this.hy - this.dy * (p.h / 2 + 2) };
        return this.latch('zip', C.latchTime);
      }
    }
  }

  latch(next, time) {
    this.phase = 'latch';
    this.next = next;
    this.timer = time;
    this.latchTotal = time;
  }

  // 걸린 직후 멈칫: 플레이어는 공중에 정지(무적), 끝나면 날아가거나 끌어오기 시작
  updateLatch(dt, p, C) {
    p.vx = 0;
    p.vy = 0;
    p.dodgeTimer = Math.max(p.dodgeTimer, C.invincibleExtra);
    if (this.target) {
      if (!this.target.alive) return this.cancel();
      [this.hx, this.hy] = center(this.target);
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.phase = this.next;
    this.timer = 0;
    if (this.phase === 'pull') this.target.pull.speed = C.pullSpeed;
    else if (this.target) this.target.pull = null; // 적에게 날아갈 때는 적을 놓아준다
  }

  updateRetract(dt, p, C) {
    const [cx, cy] = center(p);
    const ddx = cx - this.hx, ddy = cy - this.hy;
    const dist = Math.hypot(ddx, ddy);
    const step = C.retractSpeed * dt;
    if (dist <= step) {
      this.phase = null;
      return;
    }
    this.hx += (ddx / dist) * step;
    this.hy += (ddy / dist) * step;
  }

  // 목표(지형 또는 적)로 날아가기. 중력 무시, 무적
  updateZip(dt, p, world, C) {
    this.timer += dt;
    const enemy = this.target;
    if (enemy && !enemy.alive) return this.finishZip(p, C, true);
    const [tx, ty] = enemy ? center(enemy) : [this.anchor.x, this.anchor.y];
    [this.hx, this.hy] = [tx, ty];

    const [cx, cy] = center(p);
    const ddx = tx - cx, ddy = ty - cy;
    const dist = Math.hypot(ddx, ddy) || 1;
    this.zdx = ddx / dist;
    this.zdy = ddy / dist;
    p.dodgeTimer = Math.max(p.dodgeTimer, C.invincibleExtra);

    // 적에게 닿으면 붙으면서 피해
    if (enemy && overlaps(expand(p, C.attachDistance), enemy)) {
      const dir = Math.sign(ddx) || p.facing;
      if (enemy.takeHit(C.damage, dir, C.knockbackX, C.knockbackY, `chain-${this.count}`)) this.hitstop = C.hitstop;
      p.facing = dir;
      p.vx = 0;
      p.vy = -C.attachBounce; // 적에게 붙은 뒤 살짝 떠서 이어서 공격하기 좋게
      p.airDashesUsed = 0;
      this.phase = null;
      return;
    }
    if (!enemy && dist <= C.arriveDistance) return this.finishZip(p, C, true);

    const before = [p.x, p.y];
    const step = Math.min(C.zipSpeed * dt, dist);
    p.vx = this.zdx * (step / dt);
    p.vy = this.zdy * (step / dt);
    moveAndCollide(p, world, dt);
    const moved = Math.hypot(p.x - before[0], p.y - before[1]);
    if (moved < step * 0.3 || this.timer >= C.zipMaxTime) this.finishZip(p, C, false);
  }

  finishZip(p, C, keepMomentum) {
    p.vx = keepMomentum ? (this.zdx || 0) * C.endSpeed : 0;
    p.vy = keepMomentum ? (this.zdy || 0) * C.endSpeed : 0;
    if (this.zdx) p.facing = Math.sign(this.zdx);
    this.phase = null;
    this.target = null;
  }

  // 걸린 적을 내 쪽으로 끌어오기. 적 이동은 enemy.update 가 enemy.pull 을 보고 처리한다
  updatePull(dt, p, C) {
    this.timer += dt;
    const enemy = this.target;
    if (!enemy || !enemy.alive) return this.cancel();
    const [cx, cy] = center(p);
    enemy.pull.x = cx;
    enemy.pull.y = cy;
    [this.hx, this.hy] = center(enemy);

    const gapX = Math.abs(this.hx - cx) - (p.w + enemy.w) / 2;
    const gapY = Math.abs(this.hy - cy) - (p.h + enemy.h) / 2;
    if (Math.max(gapX, gapY) <= C.pullStopGap) {
      enemy.pull = null;
      const dir = Math.sign(this.hx - cx) || p.facing;
      if (enemy.takeHit(C.pullDamage, dir, C.pullKnockbackX, C.pullKnockbackY, `chain-${this.count}`)) this.hitstop = C.hitstop;
      enemy.stunTimer = Math.max(enemy.stunTimer, C.pullStun);
      p.facing = dir;
      this.phase = null;
      this.target = null;
      return;
    }
    if (this.timer >= C.pullMaxTime) this.cancel();
  }

  draw(ctx, cam, p) {
    if (!this.active) return;
    const [cx, cy] = center(p);
    const x0 = cx - cam.x, y0 = cy - cam.y;
    const latching = this.phase === 'latch';
    // 멈칫하는 동안 사슬 끝이 떨리고, 사슬이 굵고 밝아진다
    const shake = latching ? p.stats.chain.latchShake * (Math.random() * 2 - 1) : 0;
    const x1 = this.hx - cam.x + shake, y1 = this.hy - cam.y + shake;
    ctx.strokeStyle = latching ? '#ffffff' : '#9aa7b8';
    ctx.lineWidth = latching ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // 사슬 고리
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.fillStyle = '#cfd8e3';
    for (let d = 8; d < len; d += 10) {
      const k = d / len;
      ctx.fillRect(x0 + (x1 - x0) * k - 2, y0 + (y1 - y0) * k - 2, 4, 4);
    }
    // 갈고리 머리
    ctx.fillStyle = latching ? '#ffcc4d' : '#e8eef5';
    const hs = latching ? 5 : 4;
    ctx.fillRect(x1 - hs, y1 - hs, hs * 2, hs * 2);
  }
}

function center(b) {
  return [b.x + b.w / 2, b.y + b.h / 2];
}

function expand(b, m) {
  return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 };
}
