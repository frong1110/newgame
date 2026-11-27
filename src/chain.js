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
//            끌어온 뒤 onPullArrive 'stop' 이면 앞에 세움, 'throw' 면 앞 입력일 때 요요 투척(yoyo.js)
//            'throw' 에서 당기는 동안 ↑ 를 누르고 있었으면 대신 위로 띄움(launch)
//   철퇴 폭풍(C 길게 누르기, 여러 적을 붙잡아 돌리다 날림)은 flailStorm.js
//   내리찍기 (startSlam): 공중 상태 적을 따라가 감고 → 멈칫 → 바닥에 꽂음(slamdown) → 충격파
import { GAME } from './data/index.js';
import { moveAndCollide, overlaps, overlapsSolid } from './physics.js';
import { emitTag } from './tags.js';
import { startYoyo } from './yoyo.js';

const SUBSTEP = 4; // 사슬 끝이 한 번에 움직이는 최대 거리(px). 얇은 지형을 뚫지 않게

export class Chain {
  // statsKey: 쓸 수치 (stats.chain / stats.pullChain), cooldownProp: 재사용 대기시간을 적을 플레이어 속성
  constructor(statsKey = 'chain', cooldownProp = 'dashCooldownTimer') {
    this.key = statsKey;
    this.cooldownProp = cooldownProp;
    this.phase = null; // null | 'throw' | 'hooked' | 'latch' | 'zip' | 'pull' | 'slamdown' | 'retract'
    this.impact = null; // 내리찍기 충격 (main.js 가 화면 흔들림·충격파 이펙트에 씀)
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
    this.homing = null; // 내리찍기: 따라갈 적
    this.launchWanted = false; // 당기는 동안 ↑ 를 눌렀는지 (요요 투척 띄우기)
    this.forwardWanted = false; // 당기기를 시작할 때·당기는 동안 앞 입력이 있었는지 (요요 투척)
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

  // 내리찍기: 공중 상태인 적을 향해 사슬을 던지고, 날아가는 동안 그 적을 따라간다
  startSlam(p, enemy) {
    const [cx, cy] = center(p);
    const [ex, ey] = center(enemy);
    const d = Math.hypot(ex - cx, ey - cy) || 1;
    this.start(p, (ex - cx) / d, (ey - cy) / d);
    this.homing = enemy;
  }

  // main.js 가 충격 정보를 한 번 가져간다
  takeImpact() {
    const i = this.impact;
    this.impact = null;
    return i;
  }

  cancel() {
    if (this.target) {
      this.target.pull = null;
      this.target.held = false;
    }
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
    else if (this.phase === 'slamdown') this.updateSlamDown(dt, p, enemies, C);
  }

  updateThrow(dt, p, world, enemies, C) {
    if (this.homing) return this.updateHomingThrow(dt, p, C);
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
      if (enemy && C.onEnemy === 'pull' && (enemy.boss || enemy.pullLockTimer > 0)) {
        // 당기기 면역: 보스 본체, 방금 당긴 적(같은 적은 repullLock 초 동안 다시 못 당김). 맞은 것처럼 번쩍이고 사슬은 되감김
        enemy.flashTimer = enemy.stats.hitFlashTime;
        this.phase = 'retract';
        return;
      }
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

  // 내리찍기 사슬: 지형·다른 적은 무시하고 노린 적에게 곧장 날아간다
  updateHomingThrow(dt, p, C) {
    const enemy = this.homing;
    if (!enemy.alive) return (this.phase = 'retract');
    const [ex, ey] = center(enemy);
    const ddx = ex - this.hx, ddy = ey - this.hy;
    const dist = Math.hypot(ddx, ddy);
    const step = C.speed * dt;
    if (dist <= step + C.hookSize) {
      this.target = enemy;
      this.homing = null;
      enemy.flashTimer = enemy.stats.hitFlashTime;
      enemy.pull = { x: ex, y: ey, speed: 0 }; // 멈칫하는 동안 공중에 붙잡아 둔다
      enemy.flight = null;
      return this.latch('slamdown', C.slamLatchTime);
    }
    this.hx += (ddx / dist) * step;
    this.hy += (ddy / dist) * step;
    this.traveled += step;
    if (this.traveled > C.slamRange * 1.5) this.phase = 'retract';
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
    else if (this.phase === 'slamdown') {
      // 바로 아래로 곧장 꽂는다 (땅에 닿을 때까지)
      const [ex, ey] = center(this.target);
      this.target.pull = { x: ex, y: ey + 10000, speed: C.slamDownSpeed };
    } else if (this.target) this.target.pull = null; // 적에게 날아갈 때는 적을 놓아준다
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
    [this.hx, this.hy] = enemy ? center(enemy) : [this.anchor.x, this.anchor.y];
    // 적에게 날아갈 때는 몸 중심이 아니라 '내 발이 적의 발보다 살짝 위'를 노린다.
    // 같은 높이의 적에게 수평으로 날아가다 조금씩 내려가 절벽 모서리에 걸리는 것을 막는다
    const tx = this.hx;
    const ty = enemy ? Math.min(this.hy, enemy.y + enemy.h - p.h / 2 - C.feetClearance) : this.hy;

    const [cx, cy] = center(p);
    const ddx = tx - cx, ddy = ty - cy;
    const dist = Math.hypot(ddx, ddy) || 1;
    this.zdx = ddx / dist;
    this.zdy = ddy / dist;
    p.dodgeTimer = Math.max(p.dodgeTimer, C.invincibleExtra);

    // 적에게 닿으면 붙으면서 피해
    if (enemy && overlaps(expand(p, C.attachDistance), enemy)) {
      const dir = Math.sign(ddx) || p.facing;
      if (enemy.takeHit(C.damage * p.chainDamage, dir, C.knockbackX, C.knockbackY, `${this.key}-${this.count}`)) this.hitstop = C.hitstop;
      p.facing = dir;
      p.vx = 0;
      p.vy = -C.attachBounce; // 적에게 붙은 뒤 살짝 떠서 이어서 공격하기 좋게
      p.airDashesUsed = 0;
      if (C.recoilEnabled) {
        enemy.stunTimer = Math.max(enemy.stunTimer, C.recoilStun); // 반동: 걸어 날아간 적은 경직되고 하던 공격이 취소됨
        enemy.ai?.interrupt();
      }
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
    if (p.hitWall) this.ledgeAssist(p, world, dt, before, C);
    const moved = Math.hypot(p.x - before[0], p.y - before[1]);
    if (moved < step * 0.3 || this.timer >= C.zipMaxTime) this.finishZip(p, C, false);
  }

  // 모서리 보정: 옆으로 막혔을 때 조금 위로 올리면 지나갈 수 있으면 올려서 다시 움직인다 (낭떠러지 건너편 턱 등)
  ledgeAssist(p, world, dt, before, C) {
    const [vx, vy] = [p.vx, p.vy];
    for (let lift = 2; lift <= C.ledgeAssist; lift += 2) {
      p.x = before[0];
      p.y = before[1] - lift;
      if (overlapsSolid(p, world)) continue;
      p.vx = this.zdx * Math.hypot(vx, vy);
      p.vy = Math.min(0, this.zdy * Math.hypot(vx, vy)); // 올라선 뒤 다시 파고들지 않게 아래로는 움직이지 않음
      moveAndCollide(p, world, dt);
      if (!p.hitWall) return;
    }
    // 올려도 안 되면 원래 결과로 (막힘)
    p.x = before[0];
    p.y = before[1];
    p.vx = vx;
    p.vy = vy;
    moveAndCollide(p, world, dt);
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
    if (p.holdingUp) this.launchWanted = true;
    if (p.holdingForward) this.forwardWanted = true;
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
      const throwing = C.onPullArrive === 'throw';
      const launching = throwing && (this.launchWanted || p.holdingUp);
      if (launching) {
        // 회전 투척 + ↑: 위로 띄운다 (공중 상태 → 내리찍기로 이어 칠 수 있음)
        enemy.takeHit(C.launchSelfDamage * p.chainDamage, p.facing, 0, 0, hitId);
        enemy.launch(C.launchHeight, C.launchHangTime, C.launchGravity);
        this.hitstop = C.throwHitstop;
      } else if (throwing && (this.forwardWanted || p.holdingForward)) {
        // 요요 투척(앞 + 당기기): 끌어온 적을 사슬이 붙은 채 던지고 최대 거리에서 되감는다 (왕복 2회 적중: yoyo.js)
        const dir = p.facing;
        enemy.takeHit(C.throwSelfDamage * p.chainDamage, dir, 0, 0, hitId);
        startYoyo(enemy, dir, C, hitId, p.chainDamage);
        this.hitstop = C.throwHitstop;
      } else {
        const dir = Math.sign(this.hx - cx) || p.facing;
        if (enemy.takeHit(C.pullDamage * p.chainDamage, dir, C.pullKnockbackX, C.pullKnockbackY, hitId)) this.hitstop = C.hitstop;
        enemy.stunTimer = Math.max(enemy.stunTimer, C.pullStun);
        if (C.repullLock) enemy.pullLockTimer = C.repullLock;
        p.facing = dir;
      }
      this.phase = null;
      this.target = null;
      // 태그 효과 부가 연결 지점: 당기기 도착
      if (this.key === 'pullChain' && enemy.alive) emitTag('pullArrive', { enemy, damage: p.chainDamage });
      return;
    }
    if (this.timer >= C.pullMaxTime) this.cancel();
  }

  // 내리찍기: 감은 적을 땅까지 꽂는다. 닿으면 그 적과 주변 적에게 피해 + 충격파
  updateSlamDown(dt, p, enemies, C) {
    const enemy = this.target;
    if (!enemy.alive) return this.cancel();
    this.timer += dt;
    [this.hx, this.hy] = center(enemy);
    if (!enemy.onGround && this.timer < C.slamMaxTime) return;

    enemy.pull = null;
    const ix = enemy.x + enemy.w / 2;
    const groundY = enemy.y + enemy.h;
    const hitId = `${this.key}-${this.count}-slam`;
    enemy.takeHit(C.slamDamage * p.chainDamage, p.facing, 0, C.slamKnockbackY * 0.3, hitId);
    const area = { x: ix - C.slamRadiusX, y: groundY - C.slamHeight, w: C.slamRadiusX * 2, h: C.slamHeight + 8 };
    for (const e of enemies) {
      if (e === enemy || !e.alive || !overlaps(area, e)) continue;
      const dir = Math.sign(e.x + e.w / 2 - ix) || p.facing;
      e.takeHit(C.slamAoEDamage * p.chainDamage, dir, C.slamKnockbackX, C.slamKnockbackY, `${hitId}-aoe`);
    }
    this.hitstop = C.slamHitstop;
    this.impact = { x: ix, y: groundY, r: C.slamRadiusX, shake: C.slamShake, shakeTime: C.slamShakeTime, waveTime: C.slamWaveTime };
    this.phase = null;
    this.target = null;
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
