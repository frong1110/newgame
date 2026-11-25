// 결박 갈래 2·3단계: 묶인 적들 사이의 팽팽한 줄과, C 로 묶인 적을 한 점에 끌어모으는 동작
//   팽팽한 줄: 묶인 적들 사이 사슬 선에 닿은 다른 적은 피해와 속박. 묶인 적이 2명 이상일 때 C → 서로를 향해 날아가 충돌(피해·기절)
//   사슬 감옥: 같은 C 가 충돌 대신 한 점으로 끌어모아 조인 뒤 폭발 (묶은 수가 많을수록 피해·반경이 커짐)
import { overlaps } from './physics.js';

const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const easeOut = (k) => 1 - (1 - k) * (1 - k);

export class BindPull {
  constructor(player, enemies, effects, hitstop) {
    this.player = player;
    this.enemies = enemies;
    this.effects = effects;
    this.hitstop = hitstop;
    this.state = null; // { mode, targets, from, cx, cy, t, phase, count }
    this.lineCd = new Map(); // 선에 닿은 적이 연달아 맞지 않게
    this.seq = 0;
  }

  get W() {
    return this.player.stats.chainWeapon;
  }

  bound() {
    return this.enemies.filter((e) => e.alive && e.chainTimer > 0);
  }

  // 묶인 적이 2명 이상이면 끌어모으기 시작 (player.js 의 C 입력에서 부른다). 시작했으면 true
  tryStart() {
    const W = this.W;
    if (!this.player.usesChainWeapon || !W.tautEnabled || this.state) return false;
    const targets = this.bound();
    if (targets.length < 2) return false;
    const cs = targets.map(center);
    const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length, cy = cs.reduce((s, c) => s + c[1], 0) / cs.length;
    this.state = { mode: W.prisonEnabled ? 'explode' : 'collide', targets, from: cs.map((c) => c[0]), cx, cy, t: 0, phase: 'gather', count: targets.length };
    return true;
  }

  update(dt) {
    for (const [e, t] of this.lineCd) {
      if (t - dt <= 0 || !e.alive) this.lineCd.delete(e);
      else this.lineCd.set(e, t - dt);
    }
    if (!this.player.usesChainWeapon) this.state = null;
    if (this.state) return this.updateGather(dt);
    if (this.W.tautEnabled) this.updateLines();
  }

  // 사슬 선에 닿은 묶이지 않은 적: 피해(넉백 없음) + 속박 (묶을 수 있는 수가 남아 있을 때만)
  updateLines() {
    const W = this.W;
    const bound = this.bound().sort((a, b) => a.x - b.x);
    if (bound.length < 2) return;
    const pad = W.tautLineThickness / 2;
    for (const e of this.enemies) {
      if (!e.alive || e.chainTimer > 0 || this.lineCd.has(e)) continue;
      if (!bound.some((b, i) => i > 0 && this.touches(center(bound[i - 1]), center(b), e, pad))) continue;
      this.lineCd.set(e, W.tautLineTick);
      e.takeShare(W.tautLineDamage);
      if (e.alive && bound.length < W.bindMaxTargets) e.bind(W.tautLineBindTime);
    }
  }

  // 선분 a-b 가 적 e 의 사각형(+pad)에 닿는지: 선을 따라 점을 찍어 검사
  touches(a, b, e, pad) {
    const len = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let d = 0; d <= len; d += 6) {
      const k = d / len, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
      if (x >= e.x - pad && x <= e.x + e.w + pad && y >= e.y - pad && y <= e.y + e.h + pad) return true;
    }
    return false;
  }

  updateGather(dt) {
    const S = this.state, W = this.W;
    S.targets = S.targets.filter((e) => e.alive);
    S.t += dt;
    if (S.targets.length === 0) { this.state = null; return; }
    // 끌려가는 동안 속박 유지 + 한 점으로 이동 (지형은 무시: 짧은 거리라 단순하게)
    const k = S.phase === 'gather' ? easeOut(Math.min(1, S.t / W.tautGatherTime)) : 1;
    S.targets.forEach((e) => {
      const i = this.state.targets.indexOf(e);
      e.bindTimer = Math.max(e.bindTimer, 0.3);
      e.chainTimer = Math.max(e.chainTimer, 0.3);
      e.bindTotal = Math.max(e.bindTotal ?? 0, e.bindTimer);
      e.vx = 0;
      e.x = S.from[i] + (S.cx - e.w / 2 - S.from[i]) * k;
    });
    if (S.phase === 'gather') {
      if (S.t < W.tautGatherTime) return;
      if (S.mode === 'collide') return this.collide();
      S.phase = 'squeeze';
      S.t = 0;
    } else if (S.t >= W.prisonSqueezeTime) this.explode();
  }

  // 팽팽한 줄: 가운데에서 부딪혀 피해와 기절, 사슬은 풀림
  collide() {
    const S = this.state, W = this.W;
    for (const e of S.targets) {
      e.takeHit(W.tautCollideDamage, Math.sign(e.x + e.w / 2 - S.cx) || 1, 0, 0, `bp${++this.seq}`);
      if (e.alive) { e.stunTimer = Math.max(e.stunTimer, W.tautCollideStun); e.release(); }
    }
    this.effects.addImpact(S.cx, S.cy, 50, 4, 0.15, 0.25);
    this.hitstop.t = Math.max(this.hitstop.t, 0.1);
    this.state = null;
  }

  // 사슬 감옥: 묶은 수에 비례한 폭발. 반경 안의 모든 적이 맞는다 (죽은 묶인 적은 전이 효과도 발동)
  explode() {
    const S = this.state, W = this.W;
    const damage = W.prisonBaseDamage + W.prisonDamagePerTarget * (S.count - 1);
    const radius = W.prisonRadiusBase + W.prisonRadiusPerTarget * S.count;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = Math.max(e.x - S.cx, 0, S.cx - (e.x + e.w)), dy = Math.max(e.y - S.cy, 0, S.cy - (e.y + e.h));
      if (Math.hypot(dx, dy) > radius) continue;
      e.takeHit(damage, Math.sign(e.x + e.w / 2 - S.cx) || 1, 0, 0, `bp${++this.seq}`);
    }
    // 살아남은 대상은 사슬이 풀린다. 방금 전이로 새로 묶인 적(앵커가 점)은 그대로 둔다
    for (const e of S.targets) {
      if (e.alive && (e.bindAnchor === 'player' || e.bindAnchor === null)) { e.release(); e.stunTimer = Math.max(e.stunTimer, W.tautCollideStun); }
    }
    this.effects.addImpact(S.cx, S.cy, radius, 8, 0.25, 0.35);
    this.hitstop.t = Math.max(this.hitstop.t, 0.15);
    this.state = null;
  }

  draw(ctx, view) {
    const S = this.state;
    if (!S) return;
    ctx.strokeStyle = '#e8d4ff';
    ctx.lineWidth = 2;
    if (S.phase === 'squeeze') {
      const W = this.W;
      const full = W.prisonRadiusBase + W.prisonRadiusPerTarget * S.count;
      const r = full * (1 - 0.8 * Math.min(1, S.t / W.prisonSqueezeTime)); // 점점 조여든다
      ctx.beginPath();
      ctx.arc(S.cx - view.x, S.cy - view.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const e of S.targets) {
      ctx.beginPath();
      ctx.moveTo(S.cx - view.x, S.cy - view.y);
      ctx.lineTo(e.x + e.w / 2 - view.x, e.y + e.h / 2 - view.y);
      ctx.stroke();
    }
  }
}
