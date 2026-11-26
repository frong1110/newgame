import { TAGS } from './data/index.js';

// 공용 증강 태그 연결 지점과 단계 계산.
//   태그 개수는 player.stats.tags.<번개|불|얼음|구속|처형> (공용 증강/스킬 효과가 add 로 올린다).
//   개수 1/3/5 가 단계 0/1/2 (TAGS.thresholds). 효과 본체는 tagEffects.js, 상태이상은 status.js.
// 연결 지점 이벤트 (사슬 무기): emitTag(kind, { enemy, damage, point })
//   기본 지점: 'tipHit'(휘두르기 끝부분 적중) · 'releaseHit'(채찍 폭풍 최대 스택 방출 타격) · 'reflectHit'(반사 투사체 적중)
//   부가 지점: 'pullArrive'(당기기 도착) · 'tautLine'(묶인 적 사이 사슬 선에 닿음). 확률은 기본 지점의 절반
const listeners = [];

export function onTag(fn) {
  listeners.push(fn);
  return () => listeners.splice(listeners.indexOf(fn), 1);
}

export function emitTag(kind, payload) {
  for (const fn of listeners) fn(kind, payload);
}

export const TAG_NAMES = { lightning: '번개', fire: '불', ice: '얼음', bind: '구속', execute: '처형' };

// 태그 단계: -1(없음) | 0 | 1 | 2
export function tagStage(player, tag) {
  const n = player.stats.tags?.[tag] ?? 0;
  let stage = -1;
  TAGS.thresholds.forEach((t, i) => {
    if (n >= t) stage = i;
  });
  return stage;
}

// 구속 태그: 동시 속박 상한 증가 (1/3/5개 → +1/+2/+3), 3개부터 속박 시간 +0.5초
export function bindCapBonus(player) {
  const s = tagStage(player, 'bind');
  return s < 0 ? 0 : (s + 1) * TAGS.bind.capPerStage;
}

export function bindTimeBonus(player) {
  return tagStage(player, 'bind') >= 1 ? TAGS.bind.timeBonus : 0;
}
