import { Input } from './input.js';
import { overlaps } from './physics.js';
import { ATTACK_KEY } from './controls.js';

// 플레이어 주 무기: 사슬 휘두르기(콤보·끝부분·분동 조율) / 검, 특수 버튼 대상 찾기, 무기 그리기.
// player.js 의 Player 에 메서드로 붙는다 (applyMixins). this 는 Player.
export class PlayerWeapon {
  // 현재 주 무기 수치: 사슬(chainWeapon) 또는 검(attack, 테스트용)
  get weapon() {
    return this.usesChainWeapon ? this.stats.chainWeapon : this.stats.attack;
  }

  get usesChainWeapon() {
    return this.stats.weapon === 'chain';
  }

  get step() {
    return this.weapon.combo[this.comboStep];
  }

  get attackDuration() {
    const S = this.step;
    return S.startup + S.active + S.recovery;
  }

  // 공격 시작 후 경과 시간 (공격 중이 아니면 -1)
  get attackElapsed() {
    return this.attackTimer > 0 ? this.attackDuration - this.attackTimer : -1;
  }

  get isAttackActive() {
    const S = this.step;
    const t = this.attackElapsed;
    return t >= S.startup && t < S.startup + S.active;
  }

  get inRecovery() {
    const S = this.step;
    return this.attackElapsed >= S.startup + S.active;
  }

  // 다음 콤보 타로 넘어갈 수 있는 시점인지 (회수 동작 중 chainDelay 만큼 지난 뒤)
  get canChain() {
    const S = this.step;
    return this.attackElapsed >= S.startup + S.active + S.chainDelay;
  }

  // 공격 판정 영역 (판정 프레임이 아니면 null)
  getAttackHitbox() {
    if (!this.isAttackActive) return null;
    const S = this.step;
    return {
      x: this.facing > 0 ? this.x + this.w : this.x - S.rangeWidth,
      y: this.y + this.h / 2 - S.rangeHeight / 2 + S.rangeOffsetY,
      w: S.rangeWidth,
      h: S.rangeHeight,
      damage: S.damage,
      knockbackX: S.knockbackX,
      knockbackY: S.knockbackY,
      hitstop: S.hitstop,
    };
  }

  // 공격 시작 후 t 초일 때 휘두르는 각도(도). 0 = 정면, 음수 = 위쪽
  swingAngle(t) {
    const S = this.step;
    const from = S.fromAngle, to = S.toAngle;
    const windup = from - Math.sign(to - from) * 15; // 반대쪽으로 살짝 젖혔다가 휘두름
    if (t < S.startup) return from + (windup - from) * (t / S.startup);
    if (t < S.startup + S.active) {
      const k = (t - S.startup) / S.active;
      return windup + (to - windup) * (1 - (1 - k) * (1 - k)); // 빠르게 시작해서 끝에서 감속
    }
    return to;
  }

  // 사슬이 뻗은 정도 (0~1): 준비 때 감겨 있다가 휘두르며 끝까지 뻗고, 회수하며 감긴다
  chainExtension(t) {
    const S = this.step;
    const coiled = 0.35;
    if (t < S.startup) return coiled;
    if (t < S.startup + S.active) {
      const k = (t - S.startup) / S.active;
      return coiled + (1 - coiled) * (1 - (1 - k) * (1 - k));
    }
    return Math.max(0, 1 - (t - S.startup - S.active) / S.recovery);
  }

  get chainLength() {
    return this.step.length * this.weapon.lengthMultiplier * (this.swingLengthScale ?? 1);
  }

  // 끝부분(분동) 판정 구간 길이 비율. 판정 배율(분동 조율)만큼 넓어진다
  get tipFractionEffective() {
    const W = this.weapon;
    return Math.min(0.9, W.tipFraction * W.tipHitMultiplier);
  }

  // 분동 조율: 앞쪽 최대 사거리 안에서 가장 가까운 적까지의 거리에 맞춰 이번 타의 사슬 길이 배율을 정한다.
  // 사슬은 뻗어 나가며 적의 앞쪽 끝에 먼저 닿으므로, 끝부분 구간의 가운데를 '적의 앞쪽 끝 + tuneAimInset' 에 맞춘다
  // (처음 닿는 순간 분동이 닿게). tuneStrength 만큼만 보정하고, 적이 없으면 1(기본 길이)
  tuneSwingLength(enemies) {
    const W = this.weapon;
    const base = this.step.length * W.lengthMultiplier;
    // 휘두르며 앞으로 내딛는 거리만큼 미리 앞에서 잰다
    const S = this.step;
    const lunge = S.lungeSpeed * S.lungeTime * (this.onGround ? 1 : W.airLungeMultiplier);
    const pivotX = this.x + this.w / 2 + this.facing * (W.pivotForward + lunge);
    const pivotY = this.y + this.h / 2;
    const maxReach = base * W.tuneMaxLengthMul * W.arcScaleX;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = (e.x + e.w / 2 - pivotX) * this.facing;
      const dy = Math.abs(e.y + e.h / 2 - pivotY);
      if (dx <= 0 || dy > W.tuneVerticalRange || dx - e.w / 2 > maxReach) continue;
      bestD = Math.min(bestD, dx - e.w / 2 + W.tuneAimInset); // 앞쪽 끝 + 조금 안쪽
    }
    this.tuneTargetDistance = Number.isFinite(bestD) ? bestD : null;
    this.swingTuned = Number.isFinite(bestD);
    if (!this.swingTuned) return 1;
    const tipMid = 1 - this.tipFractionEffective / 2;
    const ideal = bestD / (W.arcScaleX * tipMid);
    const clamped = Math.max(base * W.tuneMinLengthMul, Math.min(base * W.tuneMaxLengthMul, ideal));
    return (base + (clamped - base) * W.tuneStrength) / base;
  }

  // 사슬 휘두르기 궤적의 점: 플레이어 앞쪽 축을 중심으로, 가로·세로 배율을 준 타원 위
  chainPoint(deg, r) {
    const W = this.weapon;
    const rad = (deg * Math.PI) / 180;
    const ox = this.x + this.w / 2 + this.facing * W.pivotForward;
    const oy = this.y + this.h / 2;
    return [ox + this.facing * Math.cos(rad) * r * W.arcScaleX, oy + Math.sin(rad) * r * W.arcScaleY];
  }

  // 이번 프레임 공격이 적 e 에 맞는지. 맞으면 피해 정보, 아니면 null
  attackHitTest(e) {
    if (!this.isAttackActive) return null;
    const S = this.step;
    if (this.usesChainWeapon && this.swingStorm) {
      // 채찍 폭풍 최대 스택 방출: 플레이어 중심 원형 범위, 전부 끝부분 취급
      const W = this.weapon;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = Math.max(e.x - cx, 0, cx - (e.x + e.w)), dy = Math.max(e.y - cy, 0, cy - (e.y + e.h));
      if (Math.hypot(dx, dy) > W.stormRadius) return null;
      const ex = e.x + e.w / 2;
      return {
        damage: (S.damage + (S.tipDamage - S.damage) * W.tipBonusMultiplier) * this.chargeDamageMul,
        knockbackX: S.knockbackX,
        knockbackY: S.knockbackY,
        hitstop: S.tipHitstop,
        tip: true,
        omni: true,
        bind: W.tipBindTime,
        point: [ex, e.y + e.h / 2],
        dir: Math.sign(ex - cx) || this.facing,
      };
    }
    if (!this.usesChainWeapon) {
      const hb = this.getAttackHitbox();
      if (!overlaps(hb, e)) return null;
      return { damage: S.damage, knockbackX: S.knockbackX, knockbackY: S.knockbackY, hitstop: S.hitstop, tip: false };
    }
    // 사슬: 지난 프레임 각도 → 이번 프레임 각도 사이를 훑으며, 바깥(끝부분)부터 검사
    const W = this.weapon;
    const L = this.chainLength;
    const reach = L * this.chainExtension(this.attackElapsed);
    // 분동은 언제나 사슬 끝에 있으므로, 지금 뻗은 끝에서 tipFraction 만큼이 끝부분 판정
    const tipFrom = reach - L * this.tipFractionEffective;
    // 끝부분은 판정 배율만큼 두껍게 (분동 조율), 몸통은 기본 두께
    const pad = W.hitThickness / 2;
    const tipPad = pad * W.tipHitMultiplier;
    const inBox = (px, py, p) => px >= e.x - p && px <= e.x + e.w + p && py >= e.y - p && py <= e.y + e.h + p;
    const a0 = this.prevSwingDeg ?? this.swingDeg, a1 = this.swingDeg;
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 3));
    let best = -1;
    let point = null;
    for (let i = 0; i <= n; i++) {
      const deg = a0 + ((a1 - a0) * i) / n;
      for (let r = reach; r > 8; r -= 5) {
        const [px, py] = this.chainPoint(deg, r);
        if (inBox(px, py, r >= tipFrom ? tipPad : pad)) {
          if (r > best) {
            best = r;
            point = [px, py];
          }
          break;
        }
      }
    }
    if (best < 0) return null;
    // 분동 조율로 길이를 맞춘 타는 덜 뻗어도 끝부분 (거리를 일부러 맞췄으므로)
    const minExt = this.swingTuned ? W.tuneMinTipExtension : W.minTipExtension;
    const tip = best >= tipFrom && reach >= L * minExt;
    return {
      // 끝부분 피해 = 몸통 피해 + 추가 피해 × tipBonusMultiplier(회전 차지 리스크), 방출 휘두르기는 × chargeDamageMul. 소수 그대로
      damage: (tip ? S.damage + (S.tipDamage - S.damage) * W.tipBonusMultiplier : S.damage) * this.chargeDamageMul,
      knockbackX: S.knockbackX,
      knockbackY: S.knockbackY,
      hitstop: tip ? S.tipHitstop : S.hitstop,
      tip,
      bind: tip ? W.tipBindTime : 0,
      point,
    };
  }

  startAttack(step, enemies = []) {
    this.comboStep = step;
    this.swingTuned = false;
    // 방출 휘두르기(회전 차지를 놓은 타)만 차지량·길이 자동 보정·원형 범위가 적용된다
    this.releaseCharge = this.pendingRelease;
    this.pendingRelease = null;
    this.swingStorm = this.releaseCharge != null && this.releaseOmni;
    this.releaseOmni = false;
    const tuned = this.releaseCharge != null && this.usesChainWeapon && this.weapon.tuneEnabled;
    this.swingLengthScale = tuned ? this.tuneSwingLength(enemies) : 1;
    this.swingDeg = null;
    this.prevSwingDeg = null;
    this.attackTimer = this.attackDuration;
    this.attackBufferTimer = 0;
    this.attackId++;
  }

  // 공격 입력·콤보 진행
  updateAttack(dt, stunned, enemies = []) {
    const A = this.weapon;
    const lastStep = A.combo.length - 1;
    const wasAttacking = this.attackTimer > 0;
    if (this.attackTimer > 0) this.attackTimer -= dt * this.attackSpeedMul;
    if (wasAttacking && this.attackTimer <= 0) {
      this.releaseCharge = null;
      // 마무리 타 이후엔 콤보 초기화(꾹 누르고 있으면 1타부터 다시), 그 외에는 잠깐 이어갈 시간을 준다
      this.comboTimer = this.comboStep < lastStep ? A.comboWindow : 0;
    } else if (this.attackTimer <= 0) {
      this.comboTimer -= dt;
    }

    // 회전 차지가 있으면 탭/홀드를 먼저 가른다 (꾹 누르기는 연속 공격이 아니라 차지)
    const charge = this.chargeOn;
    if (charge) {
      this.updateCharge(dt, stunned, enemies);
      this.attackBufferTimer -= dt;
    } else {
      this.cancelCharge();
      if (Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = A.inputBuffer;
      else this.attackBufferTimer -= dt;
    }
    // 미리 누른 입력이 있거나, 공격 키를 꾹 누르고 있으면 계속 이어서 공격
    const wantsAttack = this.attackBufferTimer > 0 || (!charge && Input.isDown(ATTACK_KEY));
    if (stunned || this.dashTimer > 0 || !wantsAttack) return;

    if (this.attackTimer > 0) {
      // 회수 동작 중 chainDelay 가 지난 뒤 입력이 있으면 남은 회수를 끊고 다음 타로
      if (this.canChain && this.comboStep < lastStep) this.startAttack(this.comboStep + 1, enemies);
    } else {
      this.startAttack(this.comboTimer > 0 && this.comboStep < lastStep ? this.comboStep + 1 : 0, enemies);
    }
  }

  // 특수 버튼 사슬을 쓸 수 있는 상태인지 (대기시간은 따로 본다: 내리찍기는 대기시간 무시)
  canUseSpecialChain(stunned) {
    return !stunned && this.usesChainWeapon && !this.isDashing && !this.pullChain.active && !this.chain.locksPlayer;
  }

  // 사거리 안에서 가장 가까운 공중 상태 적 (내리찍기 대상)
  findAirborneTarget(enemies) {
    const R = this.stats.pullChain.slamRange;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = R;
    for (const e of enemies) {
      if (!e.airborne || e.held) continue;
      const d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  // 사슬 휘두르기 1타의 끝부분(분동)이 닿는 거리: 적의 가까운 쪽 끝을 둘 x (side = +1 오른쪽, -1 왼쪽)
  // 내리꽂기에 맞은 적을 여기까지 밀어내서 바로 끝부분으로 이어 칠 수 있게 한다
  tipRangeX(side, enemyWidth) {
    const W = this.stats.chainWeapon;
    const L = W.combo[0].length * W.lengthMultiplier * W.arcScaleX;
    const tipMid = L * (1 - W.tipFraction / 2); // 끝부분 구간의 가운데
    const pivotX = this.x + this.w / 2 + side * W.pivotForward;
    const nearEdge = pivotX + side * tipMid;
    return side > 0 ? nearEdge : nearEdge - enemyWidth;
  }

  // 공격 모션: 준비(반대쪽으로 젖히기) → 판정(앞쪽으로 길고 납작한 아치 궤적) → 회수(궤적이 사라짐)
  drawSword(ctx, cx, cy) {
    const t = this.attackElapsed;
    if (t < 0) return;
    const A = this.stats.attack;
    const S = this.step;
    const L = S.swordLength;
    const from = S.fromAngle, to = S.toAngle; // 각도(도). 0 = 정면, 음수 = 위쪽
    const windup = from - Math.sign(to - from) * 15;
    const ox = cx + this.facing * A.pivotForward;
    const deg = this.swingAngle(t);
    // 타원형 궤적: 가로(앞)로 늘리고 세로로 눌러서 납작한 아치를 만든다
    const at = (d, r) => {
      const rad = (d * Math.PI) / 180;
      return [ox + this.facing * Math.cos(rad) * r * A.arcScaleX, cy + Math.sin(rad) * r * A.arcScaleY];
    };

    // 초승달 궤적: 바깥 호(칼끝) ~ 안쪽 호 사이를 채운다
    const recoveryT = t - S.startup - S.active;
    const trailAlpha = t < S.startup ? 0 : recoveryT < 0 ? 0.55 : 0.55 * Math.max(0, 1 - recoveryT / (S.recovery * 0.5));
    if (trailAlpha > 0) {
      const inner = L * A.trailInner;
      const steps = 16;
      ctx.fillStyle = `rgba(255,255,255,${trailAlpha})`;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) ctx.lineTo(...at(windup + ((deg - windup) * i) / steps, L));
      for (let i = steps; i >= 0; i--) ctx.lineTo(...at(windup + ((deg - windup) * i) / steps, inner * (0.6 + 0.4 * (i / steps))));
      ctx.closePath();
      ctx.fill();
    }

    const fade = recoveryT > 0 ? Math.max(0, 1 - recoveryT / S.recovery) : 1;
    ctx.strokeStyle = `rgba(220,230,255,${fade})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...at(deg, 6));
    ctx.lineTo(...at(deg, L));
    ctx.stroke();
  }

  // 사슬 휘두르기: 감긴 사슬이 채찍처럼 뻗으며 휘어지고, 끝의 분동이 궤적을 남긴다
  drawChainWhip(ctx, cam) {
    if (this.charging) return this.drawChargeSpin(ctx, cam);
    const t = this.attackElapsed;
    if (t < 0) return;
    const S = this.step;
    if (this.swingStorm) return this.drawStormSpin(ctx, cam, t);
    const from = S.fromAngle, to = S.toAngle;
    const sweep = Math.sign(to - from);
    const windup = from - sweep * 15;
    const deg = this.swingAngle(t);
    const L = this.chainLength;
    const reach = L * this.chainExtension(t);
    const at = (d, r) => {
      const [x, y] = this.chainPoint(d, r);
      return [x - cam.x, y - cam.y];
    };
    const active = t >= S.startup && t < S.startup + S.active;
    const recoveryT = t - S.startup - S.active;

    // 분동 궤적 (휘두르는 동안 + 회수 초반)
    const trailAlpha = t < S.startup ? 0 : recoveryT < 0 ? 0.5 : 0.5 * Math.max(0, 1 - recoveryT / (S.recovery * 0.4));
    if (trailAlpha > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${trailAlpha})`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const steps = 16;
      const end = active ? deg : to;
      for (let i = 0; i <= steps; i++) ctx.lineTo(...at(windup + ((end - windup) * i) / steps, L * (0.6 + 0.4 * (i / steps))));
      ctx.stroke();
      // 끝부분 판정 구간 표시
      const tipStart = L - L * this.tipFractionEffective;
      ctx.strokeStyle = `rgba(255,204,77,${trailAlpha * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(...at(end, tipStart));
      ctx.lineTo(...at(end, L));
      ctx.stroke();
    }

    // 사슬 몸통: 손 → 분동까지, 휘두르는 반대쪽으로 처져서 채찍처럼 휜다
    const [x0, y0] = at(deg, 4);
    const [x2, y2] = at(deg, reach);
    const lag = active ? 22 : 0;
    const [x1, y1] = at(deg - sweep * lag, reach * 0.55);
    const len = Math.max(1, Math.hypot(x2 - x0, y2 - y0));
    const n = Math.max(2, Math.floor(len / 7));
    ctx.fillStyle = '#b8c4d2';
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const bx = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * x1 + k * k * x2;
      const by = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * y1 + k * k * y2;
      ctx.fillRect(bx - 2, by - 2, 4, 4);
    }
    // 분동 (분동 조율이면 weightModelScale 만큼 크게)
    const ws = 10 * this.weapon.weightModelScale;
    ctx.fillStyle = '#5b6573';
    ctx.fillRect(x2 - ws / 2, y2 - ws / 2, ws, ws);
    ctx.strokeStyle = '#e8eef5';
    ctx.lineWidth = 1;
    ctx.strokeRect(x2 - ws / 2 + 0.5, y2 - ws / 2 + 0.5, ws - 1, ws - 1);
  }

  // 채찍 폭풍 최대: 플레이어 둘레를 한 바퀴 도는 사슬과 원형 범위
  drawStormSpin(ctx, cam, t) {
    const S = this.step, R = this.weapon.stormRadius;
    const k = Math.min(1, Math.max(0, (t - S.startup) / S.active));
    const fade = t < S.startup ? 0.3 : t < S.startup + S.active ? 1 : Math.max(0, 1 - (t - S.startup - S.active) / S.recovery);
    const cx = this.x + this.w / 2 - cam.x, cy = this.y + this.h / 2 - cam.y;
    const a = k * 2 * Math.PI * this.facing;
    ctx.strokeStyle = `rgba(255,204,77,${0.5 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = `rgba(220,230,255,${fade})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
    ctx.fillStyle = '#5b6573';
    ctx.fillRect(cx + Math.cos(a) * R - 6, cy + Math.sin(a) * R - 6, 12, 12);
  }
}
