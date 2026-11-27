// 요요 투척 (투척 갈래 1단계, 설계안 '사슬 트리 변경 사항'): 앞 입력 + 당기기로 끌어온 적을 사슬이 붙은 채 던진다.
//   나갈 때(out): 위로 휘는 호를 그리며 최대 거리(yoyoRange)까지, 벽에 부딪히면(추가 피해 yoyoWallDamage) 거기서 반전
//   돌아올 때(back): 아래로 휘는 호(타원 궤적)로 플레이어 앞까지. 돌아오는 길에 부딪힌 적을 휘감아 함께 끌어온다(최대 yoyoDragMax 마리, 보스 본체 제외)
//   도착: 던진 적과 끌려온 적에게 마무리 타격(yoyoFinishDamage) + 살짝 띄움(→ 위+투척 내리찍기 콤보로 이어 칠 수 있음)
//   호의 휘는 정도(yoyoArcHeight)는 직선 방향의 적이 여전히 맞을 만큼(몸이 겹칠 만큼)만 — 기본 20px, 몸 높이의 절반 이하로 제한
//   가는 길·돌아오는 길 각각 적중(왕복 2회, 구간마다 hitId 가 달라 다시 맞음), 던진 적은 다른 적에 부딪히면 추가 피해(yoyoBumpDamage, 구간당 상대마다 1회)
//   다른 적과의 충돌·끌어오기 목록 추가는 combat.js 가 enemy.flight(damage > 0) 를 보고 처리한다. 수치는 player.json pullChain.yoyo*
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
    baseY: e.y,
    arc: Math.min(C.yoyoArcHeight, e.h / 2), // 직선 방향의 같은 높이 적이 맞도록 몸 높이의 절반을 넘지 않게
    traveled: 0,
    t: 0,
    dragged: [],
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
    // 위로 휘는 호: 진행률 s(0~1)에 따라 y = baseY - arc·sin(πs). 속도로 바꿔서 충돌 처리를 그대로 씀
    const s = Math.min(1, F.traveled / C.yoyoRange);
    e.vx = F.dir * C.yoyoSpeed;
    e.vy = -F.arc * Math.PI * Math.cos(Math.PI * s) * (C.yoyoSpeed / C.yoyoRange);
    const x0 = e.x;
    moveAndCollide(e, world, dt);
    F.traveled += Math.abs(e.x - x0);
    if (e.hitWall) {
      e.takeHit(C.yoyoWallDamage * F.unit, -F.dir, 0, 0, `${F.baseId}-wall`); // 벽에 부딪힌 추가 피해
      e.yoyoFx = { x: e.x + e.w / 2 + (F.dir * e.w) / 2, y: e.y + e.h / 2, mul: C.yoyoWallImpactMul, C }; // combat.js 가 충격 이펙트를 낸다
      turn(e, F, player);
    } else if (F.traveled >= C.yoyoRange) turn(e, F, player);
    return;
  }
  // back: 반전 지점에서 플레이어 앞(pullStopGap)까지, 아래로 휘는 호
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const gap = Math.max(Math.abs(px - cx) - (player.w + e.w) / 2, Math.abs(py - cy) - (player.h + e.h) / 2);
  if (gap <= C.pullStopGap || F.t >= C.yoyoMaxTime) return finish(e, F);
  F.u = Math.min(1, F.u + (C.yoyoReturnSpeed * dt) / F.backLen);
  const tx = F.turnX + (px - F.turnX) * F.u;
  const ty = F.turnY + (py - F.turnY) * F.u + F.arc * Math.sin(Math.PI * F.u); // 아래로 휨(+y)
  e.vx = (tx - cx) / dt;
  e.vy = (ty - cy) / dt;
  moveAndCollide(e, world, dt);
  for (const d of F.dragged) if (d.alive) d.pull = { x: e.x + e.w / 2, y: e.y + e.h / 2, speed: C.yoyoReturnSpeed * 1.3 }; // 휘감긴 적은 따라옴
}

// 돌아오는 길 시작: 새 hitId(같은 적도 다시 맞음), 반전 지점·거리 기록
function turn(e, F, player) {
  F.leg = 'back';
  F.t = 0;
  F.u = 0;
  F.bumped = new Set();
  F.hitId = `${F.baseId}-back`;
  F.turnX = e.x + e.w / 2;
  F.turnY = e.y + e.h / 2;
  F.backLen = Math.max(1, Math.hypot(player.x + player.w / 2 - F.turnX, player.y + player.h / 2 - F.turnY));
}

// 도착: 던진 적 + 끌려온 적에게 마무리 타격과 살짝 띄우기
function finish(e, F) {
  const C = F.C;
  const group = [e, ...F.dragged.filter((d) => d.alive)];
  e.flight = null;
  e.vx = 0;
  e.vy = 0;
  group.forEach((g, i) => {
    g.pull = null;
    g.takeHit(C.yoyoFinishDamage * F.unit, F.dir, 0, 0, `${F.baseId}-finish-${i}`);
    g.launch(C.yoyoFinishHeight, C.yoyoFinishHang, C.launchGravity);
    g.pullLockTimer = C.repullLock || 0;
  });
  e.yoyoFx = { x: e.x + e.w / 2, y: e.y + e.h / 2, mul: 1.2, C };
}
