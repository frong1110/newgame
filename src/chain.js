// 던지는 사슬. 두 곳에서 쓴다 (수치는 player.json):
//   - 대시 사슬 (대시 트리 스킬, stats.chain): 대시 키를 두 번 쓴다 (twoPress)
//   - 당기기 (사슬 무기 특수 버튼, stats.pullChain): 한 번에 적을 끌어온다
// 흐름:
//   던지기(throw) → 사거리 끝까지 아무것도 없으면 되감기(retract)
//     → 걸림: twoPress 면 걸어 둔 상태(hooked: 플레이어는 자유롭게 움직임. 시간이 지나거나,
//             너무 멀어지거나, 적이 죽으면 풀림)에서 다시 누를 때, 아니면 바로 아래로
//     → 잠깐 멈칫(latch: 사슬이 팽팽해지며 떨림, 플레이어 정지)
//     → 지형: onTerrain 'zip' 이면 그 위치로 날아감, 'retract' 면 튕겨 나옴(걸리지 않음)
//     → 적: onEnemy 'zip' 이면 적에게 날아가 붙으며 피해, 'pull' 이면 적을 끌어옴
//            끌어온 뒤 onPullArrive 'stop' 이면 앞에 세움, 'throw' 면 휘둘러 앞으로 던짐(회전 투척)
import { GAME } from './data/index.js';
import { moveAndCollide, overlaps } from './physics.js';

const SUBSTEP = 4; // 사슬 끝이 한 번에 움직이는 최대 거리(px). 얇은 지형을 뚫지 않게

export class Chain {
  // statsKey: 쓸 수치 (stats.chain / stats.pullChain), cooldownProp: 재사용 대기시간을 적을 플레이어 속성
  constructor(statsKey = 'chain', cooldownProp = 'dashCooldownTimer') {
    this.key = statsKey;
    this.cooldownProp = cooldownProp;
    this.phase = null; // null | 'throw' | 'hooked' | 'latch' | 'zip' | 'pull' | 'retract'
    this.count = 0;
    this.hitstop = 0;
  }

  get active() {
    return this.phase !== null;
  }

  get hooked() {
    return this.phase === 'hooked';
  }

  get zipping() {
    return this.phase === 'zip';
  }

  // 플레이어 조작을 막는 단계 (멈칫 + 날아가기)
  get locksPlayer() {
    return this.phase === 'latch' || this.phase === 'zip';
  }

  start(p, dx, dy) {
    const C = p.stats[this.key];
    this.phase = 'throw';
    this.dx = dx;
    this.dy = dy;
    [this.hx, this.hy] = center(p);
    this.traveled = 0;
    this.target = null; // 걸린 적
    this.anchor = null; // 박힌 지형 위치
    this.timer = 0;
    this.count++;
    p[this.cooldownProp] = C.cooldown;
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
    const C = p.stats[this.key];
    if (this.phase === 'throw') this.updateThrow(dt, p, world, enemies, C);
    else if (this.phase === 'retract') this.updateRetract(dt, p, C);
    else if (this.phase === 'hooked') this.updateHooked(dt, p, C);
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
        enemy.flashTimer = enemy.stats.hitFlashTime;
        return C.twoPress ? this.hook(C) : this.begin(p, C);
      }
      const T = GAME.tileSize;
      if (world.isSolid(Math.floor(this.hx / T), Math.floor(this.hy / T))) {
        if (C.onTerrain === 'retract') {
          this.phase = 'retract';
          return;
        }
        // 박힌 지점에서 살짝 물러난 곳을 목표로 (몸이 지형에 끼지 않게)
        this.anchor = { x: this.hx - this.dx * (p.w / 2 + 2), y: this.hy - this.dy * (p.h / 2 + 2) };
        return C.twoPress ? this.hook(C) : this.begin(p, C);
      }
    }
  }

  hook(C) {
    this.phase = 'hooked';
    this.timer = C.hookHoldTime;
  }

  // 걸어 둔 상태: 사슬 끝이 대상을 따라다니고, 두 번째 시전(trigger)을 기다린다
  updateHooked(dt, p, C) {
    if (this.target) {
      if (!this.target.alive) return this.release();
      [this.hx, this.hy] = center(this.target);
    }
    const [cx, cy] = center(p);
    const tooFar = Math.hypot(this.hx - cx, this.hy - cy) > C.range * C.hookBreakMultiplier;
    this.timer -= dt;
    if (this.timer <= 0 || tooFar) this.release();
  }

  // 두 번째 시전 (twoPress)
  trigger(p) {
    if (!this.hooked) return false;
    this.begin(p, p.stats[this.key]);
    return true;
  }

  // 멈칫 후 날아가기 / 끌어오기 시작
  begin(p, C) {
    const pulling = this.target && C.onEnemy === 'pull';
    if (this.target) {
      // 멈칫하는 동안 적을 그 자리에 붙잡아 둔다 (속도 0 으로 끌기)
      const [ex, ey] = center(this.target);
      this.target.pull = { x: ex, y: ey, speed: 0 };
    }
    this.latch(pulling ? 'pull' : 'zip', pulling ? C.pullLatchTime : C.latchTime);
  }

  // 사슬을 풀고 되감기
  release() {
    if (this.target) this.target.pull = null;
    this.target = null;
    this.phase = 'retract';
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
    if (this.next === 'zip') p.dodgeTimer = Math.max(p.dodgeTimer, C.invincibleExtra);
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
      if (enemy.takeHit(C.damage, dir, C.knockbackX, C.knockbackY, `${this.key}-${this.count}`)) this.hitstop = C.hitstop;
      p.facing = dir;
      p.vx = 0;
      p.vy = -C.attachBounce; // 적에게 붙은 뒤 살짝 떠서 이어서 공격하기 좋게
      p.airDashesUsed = 0;
      this.phase = null;
      p.onChainArrive?.(this);
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
    p.onChainArrive?.(this);
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
      const hitId = `${this.key}-${this.count}`;
      if (C.onPullArrive === 'throw') {
        // 회전 투척: 끌어온 적을 휘둘러 바라보는 쪽으로 던진다. 던진 적도, 날아가다 맞은 적도 피해
        const dir = p.facing;
        enemy.takeHit(C.throwSelfDamage, dir, 0, 0, hitId);
        enemy.throwAway(dir, C, hitId);
        this.hitstop = C.throwHitstop;
      } else {
        const dir = Math.sign(this.hx - cx) || p.facing;
        if (enemy.takeHit(C.pullDamage, dir, C.pullKnockbackX, C.pullKnockbackY, hitId)) this.hitstop = C.hitstop;
        enemy.stunTimer = Math.max(enemy.stunTimer, C.pullStun);
        p.facing = dir;
      }
      this.phase = null;
      this.target = null;
      return;
    }
    if (this.timer >= C.pullMaxTime) this.cancel();
  }

  draw(ctx, cam, p) {
    if (!this.active) return;
    const C = p.stats[this.key];
    const [cx, cy] = center(p);
    const x0 = cx - cam.x, y0 = cy - cam.y;
    const latching = this.phase === 'latch';
    // 멈칫하는 동안 사슬 끝이 떨리고, 사슬이 굵고 밝아진다
    const shake = latching ? C.latchShake * (Math.random() * 2 - 1) : 0;
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
    const hooked = latching || this.phase === 'hooked';
    ctx.fillStyle = hooked ? '#ffcc4d' : '#e8eef5';
    const hs = latching ? 5 : 4;
    if (this.phase === 'hooked' && this.target) {
      // 걸어 둔 적 표시 (남은 시간만큼 줄어드는 테두리)
      const t = this.target;
      const k = Math.max(0, this.timer / C.hookHoldTime);
      ctx.strokeStyle = 'rgba(255,204,77,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x + t.w / 2 - cam.x, t.y + t.h / 2 - cam.y, Math.max(t.w, t.h) * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
    ctx.fillRect(x1 - hs, y1 - hs, hs * 2, hs * 2);
  }
}

function center(b) {
  return [b.x + b.w / 2, b.y + b.h / 2];
}

function expand(b, m) {
  return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 };
}
