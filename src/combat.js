// 한 프레임의 타격 판정을 모아서 처리한다. hitstop 은 { t } 객체로 받아 화면 멈춤 시간을 갱신한다
//   - 내리꽂기(대시 트리) 충격, 내리찍기(사슬 무기) 충격 이펙트
//   - 플레이어 공격(휘두르기·검) → 적, 끝부분 적중 효과(불꽃·번쩍임·효과음·감기, 최대 스택 방출 태그)
//   - 던져져 날아가는 적 → 다른 적 (회전 투척)
//   - 적 몸통 → 플레이어
import { overlaps } from './physics.js';
import { playSfx } from './audio.js';
import { bindWithCap } from './bindChains.js';
import { emitTag } from './tags.js';

// 내리꽂기: 몸쪽 ~ 분동이 떨어진 지점(left~right), 위로 height 안의 적에게 큰 피해
function resolveSlam(player, enemies, effects, hitstop) {
  // 사슬 무기 내리찍기 충격 (피해는 chain.js 에서 이미 처리)
  const ci = player.pullChain.takeImpact();
  if (ci) effects.addImpact(ci.x, ci.y, ci.r, ci.shake, ci.shakeTime, ci.waveTime);

  const s = player.takeSlamImpact();
  if (!s) return;
  const area = { x: s.left, y: s.y - s.height, w: s.right - s.left, h: s.height + 8 };
  for (const e of enemies) {
    if (!e.alive || !overlaps(area, e)) continue;
    // 밀어내는 방향은 플레이어 기준 (분동이 떨어진 곳 기준이면 플레이어 쪽으로 밀릴 수 있음)
    const dir = Math.sign(e.x + e.w / 2 - (player.x + player.w / 2)) || player.facing;
    if (!e.takeHit(s.damage, dir, s.knockbackX, s.knockbackY, s.hitId)) continue;
    // 사슬 무기면 휘두르기 끝부분 거리로 밀어낸다 (바로 X 로 끝부분 적중을 노릴 수 있게)
    if (s.pushToTip && player.usesChainWeapon) {
      const tx = player.tipRangeX(dir, e.w);
      if (dir > 0 ? tx > e.x : tx < e.x) e.pushTo(tx, s.pushTime, s.pushStun); // 바깥쪽으로만 민다
    }
  }
  hitstop.t = Math.max(hitstop.t, s.hitstop);
  // 충격파는 맞는 범위 전체에 퍼지게 (몸쪽 ~ 분동)
  effects.addImpact((s.left + s.right) / 2, s.y, (s.right - s.left) / 2, s.shake, s.shakeTime, s.waveTime);
}

export function resolveCombat(player, enemies, effects, hitstop) {
  resolveSlam(player, enemies, effects, hitstop);
  // 사슬(대시·당기기)로 적을 맞힌 경우
  for (const c of [player.chain, player.pullChain]) {
    const h = c.takeHitstop();
    if (h > 0) hitstop.t = Math.max(hitstop.t, h);
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    // 플레이어 공격 → 적
    const hit = player.attackHitTest(e);
    if (hit && e.takeHit(hit.damage, hit.dir ?? player.facing, hit.knockbackX, hit.knockbackY, player.attackId)) {
      hitstop.t = hit.hitstop;
      if (hit.tip) {
        effects.addTipHit(hit.point[0], hit.point[1]);
        playSfx('tipHit');
        if (hit.bind > 0) bindWithCap(player, enemies, e, hit.bind); // 감기: 캐릭터와 사슬로 이어 묶음 (동시에 bindMaxTargets 명까지)
        if (hit.max) emitTag('releaseHit', { enemy: e, source: 'weapon', point: hit.point }); // 채찍 폭풍: 공용 증강 태그 효과 연결
      }
    }
    // 던져져 날아가는 적(공중 상태) → 다른 적 (회전 투척). 띄워진 적은 피해 없음
    if (e.flight && e.flight.damage > 0) {
      for (const other of enemies) {
        if (other === e || !other.alive || !overlaps(e, other)) continue;
        const T = e.flight;
        if (other.takeHit(T.damage, Math.sign(e.vx) || 1, T.knockbackX, T.knockbackY, T.hitId)) hitstop.t = T.hitstop;
      }
    }
    // 적 몸통 → 플레이어 (경직 중인 적은 공격 판정 없음)
    if (e.stunTimer <= 0 && overlaps(player, e)) {
      const fromDir = player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1;
      player.hurt(fromDir);
    }
  }
}
