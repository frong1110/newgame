// 적 상태이상 (태그 공명 효과가 건다): 화상·둔화·빙결·감전 스턴·도주.
//   enemy.status 에 상태가 들어 있고 Enemy.update 가 매 프레임 updateStatus 를 부른다.
//   화상이 끝날 때의 폭발 같은 '다른 적에게 번지는' 효과는 Status.hooks 로 tagEffects.js 가 처리한다.
import { TAGS } from './data/index.js';

export const Status = {
  hooks: { onBurnEnd: null }, // (enemy, burn) — 화상이 끝나는 순간
};

export function newStatus() {
  return {
    burn: null, // { stacks, timer, pct(스택당 최대 체력 비율), tickLeft }
    slowStacks: 0,
    slowTimer: 0,
    freeze: 0,
    shock: 0, // 번개 스턴 남은 시간
    ctrlImmune: 0, // 스턴·빙결이 풀린 직후 새 제어를 받지 않는 시간 (제어 저항)
    flee: 0,
    fleeDir: 1,
  };
}

const pctDamage = (e, amount) => amount * (e.boss ? TAGS.bossPercentMul : 1); // 최대 체력 비례 피해는 보스에게 절반

export function updateStatus(e, dt) {
  const s = e.status;
  if (s.burn) {
    s.burn.timer -= dt;
    s.burn.tickLeft -= dt;
    while (s.burn && s.burn.tickLeft <= 0) {
      s.burn.tickLeft += TAGS.fire.tick;
      e.takeShare(pctDamage(e, e.stats.maxHp * s.burn.pct * s.burn.stacks * TAGS.fire.tick));
      if (!e.alive) return;
    }
    if (s.burn && s.burn.timer <= 0) {
      const b = s.burn;
      s.burn = null;
      Status.hooks.onBurnEnd?.(e, b);
    }
  }
  if (s.slowTimer > 0) {
    s.slowTimer -= dt;
    if (s.slowTimer <= 0) s.slowStacks = 0;
  }
  if (s.flee > 0) s.flee -= dt;
  if (s.ctrlImmune > 0) s.ctrlImmune -= dt;
  if (s.shock > 0) {
    s.shock -= dt;
    if (s.shock <= 0) s.ctrlImmune = TAGS.controlResistTime;
  }
  if (s.freeze > 0) {
    s.freeze -= dt;
    e.stunTimer = Math.max(e.stunTimer, dt * 2); // 빙결: 얼어서 못 움직임
    if (s.freeze <= 0) s.ctrlImmune = TAGS.controlResistTime;
  }
}

// 이동 속도 배율 (둔화)
export function speedMul(e) {
  const s = e.status;
  return s.slowStacks > 0 ? TAGS.ice.slowSpeedMul : 1;
}

export function isFrozen(e) {
  return e.status.freeze > 0;
}

// 감전 스턴. 보스는 면역, 풀린 직후 1초는 새 제어 불가. 걸렸으면 true
export function applyShock(e, time) {
  const s = e.status;
  if (!e.alive || e.boss || s.ctrlImmune > 0 || s.freeze > 0) return false;
  s.shock = Math.max(s.shock, time);
  e.stunTimer = Math.max(e.stunTimer, time);
  return true;
}

export function applyFreeze(e, time) {
  const s = e.status;
  if (!e.alive || e.boss || s.ctrlImmune > 0 || s.freeze > 0) return false;
  s.freeze = time;
  s.slowStacks = 0;
  s.slowTimer = 0;
  e.stunTimer = Math.max(e.stunTimer, time);
  return true;
}

// 화상: 스택 쌓기(최대 maxStacks), 지속 시간 갱신
export function applyBurn(e, pct, maxStacks, duration) {
  if (!e.alive) return;
  const b = e.status.burn;
  if (b) {
    b.stacks = Math.min(maxStacks, b.stacks + 1);
    b.pct = Math.max(b.pct, pct);
    b.timer = Math.max(b.timer, duration);
  } else e.status.burn = { stacks: 1, timer: duration, pct, tickLeft: TAGS.fire.tick };
}

// 둔화: 스택 쌓기. 스택이 maxStacks 에 닿으면 true (빙결 조건)
export function applySlow(e, maxStacks, time) {
  const s = e.status;
  if (!e.alive) return false;
  s.slowStacks = Math.min(maxStacks, s.slowStacks + 1);
  s.slowTimer = Math.max(s.slowTimer, time);
  return s.slowStacks >= maxStacks;
}

// 도주: time 초 동안 fromX 반대쪽으로 달아난다
export function applyFlee(e, fromX, time) {
  if (!e.alive || e.boss) return;
  e.status.flee = time;
  e.status.fleeDir = Math.sign(e.x + e.w / 2 - fromX) || 1;
}
