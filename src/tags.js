// 공용 증강 '태그 효과' 연결 지점. 공용 증강(번개 연쇄, 화상 등)은 아직 없으므로 지금은 듣는 쪽이 없다.
// 사슬 분동 3단계(채찍 폭풍)가 반사 투사체·방출 타격이 적에게 닿을 때 emitTag 를 부르고,
// 공용 증강이 생기면 onTag 로 구독해서 태그 효과(번개 연쇄·화상 등)를 건다.
//   kind: 'reflectHit'(반사 투사체 적중) | 'releaseHit'(최대 스택 방출 타격 적중)
//   payload: { enemy, source: 'weapon', point: [x, y] }
const listeners = [];

export function onTag(fn) {
  listeners.push(fn);
  return () => listeners.splice(listeners.indexOf(fn), 1);
}

export function emitTag(kind, payload) {
  for (const fn of listeners) fn(kind, payload);
}
