// 태그 공명 효과 (설계안 '공용 증강 > 태그 공명'): 번개·불·얼음·구속·처형.
// 사슬 무기의 연결 지점(tags.js 이벤트)에서 단계별 효과가 확률로 터진다 (부가 지점은 확률 절반).
// 구속의 상한·시간 보너스는 bindChains.js / bindPull.js 가 tags.js 의 도우미로 읽는다.
import { TAGS } from './data/index.js';
import { Enemy } from './enemy.js';
import { onTag, tagStage } from './tags.js';
import { Status, applyShock, applyBurn, applySlow, applyFreeze, applyFlee, isFrozen } from './status.js';

const MAIN_POINTS = new Set(['tipHit', 'releaseHit', 'reflectHit']);
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

export class TagEffects {
  constructor(player, enemies, effects, hitstop, rng = Math.random) {
    this.player = player;
    this.enemies = enemies;
    this.effects = effects;
    this.hitstop = hitstop;
    this.rng = rng;
    this.spreading = false;
    onTag((kind, payload) => this.handle(kind, payload));
    Enemy.hooks.damageMul = (e) => this.damageMul(e);
    Enemy.hooks.onDied = (e) => this.onDied(e);
    Status.hooks.onBurnEnd = (e, b) => this.onBurnEnd(e, b);
  }

  get on() {
    return this.player.usesChainWeapon;
  }

  stage(tag) {
    return tagStage(this.player, tag);
  }

  update(dt) {
    if (this.player.execBuffTimer > 0) this.player.execBuffTimer -= dt;
  }

  // 연결 지점 이벤트
  handle(kind, { enemy: e, damage = 0 }) {
    if (!this.on || !e) return;
    const mul = MAIN_POINTS.has(kind) ? 1 : TAGS.subPointChanceMul; // 부가 지점은 확률 절반
    this.apply(e, damage, mul);
    // 사슬 선으로 이어진 묶인 적들에게 감전·화상·빙결이 번진다 (같은 효과를 부가 확률로)
    if (!this.spreading && this.player.stats.chainWeapon.tautEnabled && e.chainTimer > 0) {
      this.spreading = true;
      for (const o of this.enemies) {
        if (o !== e && o.alive && o.chainTimer > 0) this.apply(o, damage, TAGS.subPointChanceMul);
      }
      this.spreading = false;
    }
  }

  apply(e, damage, chanceMul) {
    if (!e.alive) return;
    const roll = (stage) => this.rng() < TAGS.chance[stage] * chanceMul;
    const L = this.stage('lightning'), F = this.stage('fire'), I = this.stage('ice'), X = this.stage('execute');
    if (L >= 2 && e.status.shock > 0) e.takeShare(damage * TAGS.lightning.stunnedBonus); // 스턴 중인 적에게 +30%
    if (L >= 0 && e.alive && roll(L)) this.lightning(e, damage, L);
    if (F >= 0 && e.alive && roll(F)) applyBurn(e, TAGS.fire.pctPerStack[F], TAGS.fire.maxStacks[F], TAGS.fire.duration);
    if (I >= 0 && e.alive && roll(I)) {
      const full = applySlow(e, TAGS.ice.maxStacks[I], TAGS.ice.slowTime);
      if (I >= 1 && full) applyFreeze(e, TAGS.ice.freezeTime);
    }
    if (X >= 0 && e.alive && !e.boss && e.hp <= e.stats.maxHp * TAGS.execute.threshold[X]) this.execute(e, X);
  }

  // 번개: 감전 스턴 + 가까운 적 N명에게 연쇄 (연쇄 피해 = 맞은 피해 × chainDamageMul, 맞은 적도 스턴)
  lightning(e, damage, stage) {
    const L = TAGS.lightning;
    applyShock(e, L.stunTime[stage]);
    const [ex, ey] = center(e);
    const near = this.enemies
      .filter((o) => o !== e && o.alive)
      .map((o) => [o, Math.hypot(center(o)[0] - ex, center(o)[1] - ey)])
      .filter(([, d]) => d <= L.chainRange)
      .sort((a, b) => a[1] - b[1])
      .slice(0, L.chainTargets);
    for (const [o] of near) {
      this.effects.addBolt(ex, ey, ...center(o));
      o.takeShare(damage * L.chainDamageMul);
      applyShock(o, L.stunTime[stage]);
    }
  }

  // 처형: 체력이 기준 이하인 적을 즉사. 2단계부터 주변 적 도주, 3단계는 다음 공격 강화
  execute(e, stage) {
    const X = TAGS.execute;
    const [ex, ey] = center(e);
    e.takeShare(e.hp);
    this.effects.addImpact(ex, ey, 40, 3, 0.1, 0.25);
    if (stage >= 1) {
      for (const o of this.enemies) {
        if (o !== e && o.alive && Math.hypot(center(o)[0] - ex, center(o)[1] - ey) <= X.fleeRadius) applyFlee(o, ex, X.fleeTime);
      }
    }
    if (stage >= 2) this.player.execBuffTimer = X.buffTime;
  }

  damageMul(e) {
    let m = 1;
    if (!this.on) return m;
    if (this.stage('ice') >= 1 && isFrozen(e)) m += TAGS.ice.freezeDamageBonus;
    if (this.stage('bind') >= 1 && e.chainTimer > 0) m += TAGS.bind.boundDamageBonus;
    return m;
  }

  // 죽는 순간: 스턴 중 처치 → 번개 폭발(5개), 빙결 중 처치 → 얼음 파편(5개)
  onDied(e) {
    if (!this.on) return;
    const [ex, ey] = center(e);
    const around = (r) => this.enemies.filter((o) => o.alive && Math.hypot(center(o)[0] - ex, center(o)[1] - ey) <= r);
    if (this.stage('lightning') >= 2 && e.status.shock > 0) {
      for (const o of around(TAGS.lightning.burstRadius)) o.takeShare(TAGS.lightning.burstDamage * this.player.chainDamage);
      this.effects.addImpact(ex, ey, TAGS.lightning.burstRadius, 5, 0.15, 0.3);
    }
    if (this.stage('ice') >= 2 && e.status.freeze > 0) {
      for (const o of around(TAGS.ice.shardRadius)) {
        o.takeShare(TAGS.ice.shardDamage * this.player.chainDamage);
        applySlow(o, TAGS.ice.maxStacks[2], TAGS.ice.slowTime);
      }
      this.effects.addImpact(ex, ey, TAGS.ice.shardRadius, 4, 0.12, 0.3);
    }
  }

  // 화상이 끝나면 폭발(5개): 주변 적에게 최대 체력 비례 피해 (보스는 절반)
  onBurnEnd(e, b) {
    if (!this.on || this.stage('fire') < 2) return;
    const [ex, ey] = center(e);
    for (const o of this.enemies) {
      if (o === e || !o.alive || Math.hypot(center(o)[0] - ex, center(o)[1] - ey) > TAGS.fire.burstRadius) continue;
      o.takeShare(o.stats.maxHp * TAGS.fire.burstPctPerStack * b.stacks * (o.boss ? TAGS.bossPercentMul : 1));
    }
    this.effects.addImpact(ex, ey, TAGS.fire.burstRadius, 4, 0.12, 0.3);
  }
}
