// 한 프레임의 타격 판정을 모아서 처리한다. hitstop 은 { t } 객체로 받아 화면 멈춤 시간을 갱신한다
//   - 내리꽂기(대시 트리) 충격, 내리찍기(사슬 무기) 충격 이펙트
//   - 플레이어 공격(휘두르기·검) → 적, 끝부분 적중 효과(불꽃·번쩍임·효과음·감기, 최대 스택 방출 태그)
//   - 던져져 날아가는 적 → 다른 적 (회전 투척)
//   - 적 몸통·근접 공격(돌격형) → 플레이어
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

// 철퇴 폭풍으로 날려진 적이 벽·바닥에 닿아 터짐: 그 적이 피해·기절, 반경 안 다른 적은 피해
let blastSeq = 0;
function resolveBlasts(enemies, effects, hitstop) {
  for (const e of enemies) {
    const b = e.blast;
    if (!b) continue;
    e.blast = null;
    if (e.alive) e.takeShare(b.selfDamage);
    const id = `blast${++blastSeq}`;
    for (const o of enemies) {
      if (o === e || !o.alive) continue;
      if (b.group != null && o.flight?.group === b.group) continue; // 같이 날아가는 중인 적은 폭발에 밀리지 않고 각자 터진다
      const dx = Math.max(o.x - b.x, 0, b.x - (o.x + o.w)), dy = Math.max(o.y - b.y, 0, b.y - (o.y + o.h));
      if (Math.hypot(dx, dy) > b.radius) continue;
      o.takeHit(b.damage, Math.sign(o.x + o.w / 2 - b.x) || 1, b.knockX, b.knockY, id);
    }
    effects.addImpact(b.x, b.y, b.radius, b.shake, b.shakeTime, b.waveTime);
    hitstop.t = Math.max(hitstop.t, b.hitstop);
  }
}

// 돌격형 별의 힘 변이: 돌진이 끝나며 결정 파편이 터져 반경 안 플레이어에게 피해
function resolveShardBursts(player, enemies, effects) {
  for (const e of enemies) {
    const b = e.shardBurst;
    if (!b) continue;
    e.shardBurst = null;
    const dx = Math.max(player.x - b.x, 0, b.x - (player.x + player.w)), dy = Math.max(player.y - b.y, 0, b.y - (player.y + player.h));
    if (Math.hypot(dx, dy) <= b.r) player.hurt(Math.sign(player.x + player.w / 2 - b.x) || 1);
    effects.addImpact(b.x, b.y, b.r, 3, 0.1, 0.25);
  }
}

export function resolveCombat(player, enemies, effects, hitstop) {
  resolveSlam(player, enemies, effects, hitstop);
  resolveShardBursts(player, enemies, effects);
  resolveBlasts(enemies, effects, hitstop);
  hitstop.t = Math.max(hitstop.t, player.flail.takeHitstop());
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
      if (player.execBuffTimer > 0) {
        player.execBuffSwing = player.attackId; // 처형 3단계: 이번 휘두르기 전체가 강화, 다음 휘두르기부터는 소모됨
        player.execBuffTimer = 0;
      }
      if (hit.tip) {
        effects.addTipHit(hit.point[0], hit.point[1]);
        playSfx('tipHit');
        if (hit.bind > 0) bindWithCap(player, enemies, e, hit.bind, hit.chain); // 감기: 캐릭터와 사슬로 이어 묶음 (동시에 bindMaxTargets 명까지)
        // 태그 효과 연결 지점: 휘두르기 끝부분 적중(채찍 폭풍 최대 스택 방출은 releaseHit)
        if (player.usesChainWeapon) emitTag(hit.max ? 'releaseHit' : 'tipHit', { enemy: e, damage: hit.damage, point: hit.point });
      }
    }
    // 던져져 날아가는 적(공중 상태) → 다른 적 (회전 투척). 띄워진 적은 피해 없음
    if (e.flight && e.flight.damage > 0) {
      for (const other of enemies) {
        if (other === e || !other.alive || !overlaps(e, other)) continue;
        const T = e.flight;
        if (T.group != null && other.flight?.group === T.group) continue; // 같이 날린 적끼리는 서로 피해 없음
        if (other.takeHit(T.damage, Math.sign(e.vx) || 1, T.knockbackX, T.knockbackY, T.hitId)) hitstop.t = T.hitstop;
      }
    }
    // 적 몸통 → 플레이어 (경직 중인 적은 공격 판정 없음). 돌격형이 근접으로 휘두르는 영역도 같음
    const swing = e.ai?.attackBox(e);
    if (e.stunTimer <= 0 && (overlaps(player, e) || (swing && overlaps(player, swing)))) {
      const fromDir = player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1;
      // 돌격형의 돌진이 플레이어를 맞히면(무적·대시 회피로 피한 경우는 제외) 돌진이 끝나고 지침으로 넘어간다
      if (player.hurt(fromDir) && e.ai?.state === 'charge') e.ai.endCharge(e);
    }
  }
}
