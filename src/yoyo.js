// 요요 투척 (투척 갈래 1단계): 앞 입력 + 당기기로 끌어온 적을 사슬이 붙은 채 앞으로 던지고,
// 최대 거리(yoyoRange)나 벽에서 되감아 플레이어 앞으로 돌아오게 한다.
//   가는 길(out)·돌아오는 길(back)에서 부딪힌 적이 각각 피해(왕복 2회, 구간마다 hitId 가 달라 다시 맞음)
//   던진 적은 벽에 부딪히면 추가 피해(yoyoWallDamage), 다른 적에 부딪히면 추가 피해(yoyoBumpDamage, 구간당 적마다 1회)
//   다른 적과의 충돌 피해는 combat.js 가 enemy.flight(damage > 0) 를 보고 처리한다. 수치는 player.json pullChain.yoyo*
import { moveAndCollide } from './physics.js';

// e: 던져질 적, dir: ±1, C: pullChain 수치, unit: 사슬 데미지(배수 단위)
export function startYoyo(e, dir, C, hitId, unit) {
  e.release();
  e.pull = null;
  e.vx = 0;
  e.vy = 0;
  e.flight = {
    kind: 'yoyo',
    leg: 'out',
    dir,
    C,
    unit,
    baseId: hitId,
    traveled: 0,
    t: 0,
    damage: C.throwDamage * unit,
    knockbackX: C.throwKnockbackX,
    knockbackY: C.throwKnockbackY,
    hitstop: C.throwHitstop,
    bumpDamage: C.yoyoBumpDamage * unit,
    bumped: new Set(),
    hitId: `${hitId}-out`,
    ignoreWall: true,
  };
}

// 매 프레임 (enemy.update 가 flight.kind === 'yoyo' 일 때 호출). player: 되감길 목표
export function updateYoyo(e, dt, world, player) {
  const F = e.flight;
  const C = F.C;
  F.t += dt;
  e.stunTimer = Math.max(e.stunTimer, dt * 2); // 날아가는 동안은 몸통 피해 없음
  if (F.leg === 'out') {
    e.vx = F.dir * C.yoyoSpeed;
    e.vy = 0;
    const x0 = e.x;
    moveAndCollide(e, world, dt);
    F.traveled += Math.abs(e.x - x0);
    if (e.hitWall) {
      e.takeHit(C.yoyoWallDamage * F.unit, -F.dir, 0, 0, `${F.baseId}-wall`); // 벽에 부딪힌 추가 피해
      F.wallHit = { x: e.x + e.w / 2 + F.dir * e.w / 2, y: e.y + e.h / 2 }; // combat.js 가 충격 이펙트를 낸다
      turn(F);
    } else if (F.traveled >= C.yoyoRange) turn(F);
    return;
  }
  // back: 플레이어 앞(pullStopGap)까지 되감김
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const dx = px - (e.x + e.w / 2), dy = py - (e.y + e.h / 2);
  const gap = Math.max(Math.abs(dx) - (player.w + e.w) / 2, Math.abs(dy) - (player.h + e.h) / 2);
  if (gap <= C.pullStopGap || F.t >= C.yoyoMaxTime) return end(e, C);
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(C.yoyoReturnSpeed * dt, d);
  e.vx = (dx / d) * (step / dt);
  e.vy = (dy / d) * (step / dt);
  moveAndCollide(e, world, dt);
}

function turn(F) {
  F.leg = 'back';
  F.t = 0;
  F.bumped = new Set();
  F.hitId = `${F.baseId}-back`; // 새 hitId: 같은 적도 돌아오는 길에 다시 맞는다
}

function end(e, C) {
  e.flight = null;
  e.vx = 0;
  e.vy = 0;
  e.stunTimer = Math.max(e.stunTimer, C.pullStun);
  e.pullLockTimer = C.repullLock || 0;
}
