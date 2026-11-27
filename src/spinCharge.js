import { Input } from './input.js';
import { ATTACK_KEY } from './controls.js';
import { TAGS } from './data/index.js';

// 사슬 무기 분동 갈래 (회전 차지 · 쳐내기 축적 · 채찍 폭풍). player.js 의 Player 에 메서드로 붙는다 (applyMixins).
//   회전 차지: 공격 키를 탭하면 일반 휘두르기, 꾹 누르면(chargeHoldThreshold) 사슬을 머리 위로 돌려 속도를 쌓고 놓으면 방출
//   쳐내기 축적: 도는 동안 쳐낸 투사체를 분동에 저장(storeMax), 방출하면 저장한 만큼 부채꼴로 반사
//   채찍 폭풍: 쳐내기·회전 중 분동 적중으로 회전 스택, 최대 스택 방출은 전방 넓은 아치 반사 (태그 효과는 tags.js 로 연결)
export class PlayerSpin {
  get chargeOn() {
    return this.usesChainWeapon && this.weapon.chargeEnabled;
  }

  get stormOn() {
    return this.usesChainWeapon && this.weapon.stormEnabled;
  }

  get stormMaxed() {
    return this.stormOn && this.spinStacks >= this.weapon.stormMaxStacks;
  }

  // 방출 휘두르기의 공격 속도·피해 배율 (차지한 만큼). 탭 휘두르기는 1
  get attackSpeedMul() {
    return this.releaseCharge != null ? 1 + this.releaseCharge * this.weapon.chargeSpeedBonus : 1;
  }

  // 방출 차지 배율 × 처형 태그 3단계 강화(처형 후 3초 안의 다음 휘두르기 +30%)
  get chargeDamageMul() {
    const charge = this.releaseCharge != null ? (1 + this.releaseCharge * this.weapon.chargeDamageBonus) * (1 + this.releaseStore * this.weapon.storeDamagePerCharge) : 1;
    const buffed = this.execBuffTimer > 0 || this.execBuffSwing === this.attackId;
    const recoil = this.recoilSwing === this.attackId ? 1 + this.stats.chain.recoilBonus : 1;
    return charge * recoil * (buffed ? 1 + TAGS.execute.buffBonus : 1);
  }

  // 돌고 있는 분동의 쳐내기·적중 반경 (회전 스택이 쌓일수록 넓어짐)
  get spinRadius() {
    const W = this.weapon;
    return W.deflectRadius * (1 + (this.stormOn ? this.spinStacks * W.stormRadiusPerStack : 0));
  }

  addSpinStack() {
    if (!this.stormOn) return;
    this.spinStacks = Math.min(this.weapon.stormMaxStacks, this.spinStacks + 1);
    this.spinStackTimer = this.weapon.stormStackTime;
  }

  cancelCharge() {
    this.charging = false;
    this.tapPending = false;
    this.chargeLevel = 0;
  }

  // 차징이 끊김(피격·대시·기절·내리꽂기): 차징 중이었다면 차지량·저장한 투사체·회전 스택을 모두 잃고, 다시 시전하면 처음부터 시작한다
  interruptCharge() {
    if (this.charging) {
      this.storedShots = 0;
      this.storeCharges = 0;
      this.spinStacks = 0;
      this.spinStackTimer = 0;
      this.spinAngle = 0;
      this.spinHitCd.clear();
    }
    this.cancelCharge();
  }

  // 공격 입력 처리 (회전 차지가 있을 때 updateAttack 대신 입력을 먼저 가른다)
  updateCharge(dt, stunned, enemies) {
    const W = this.weapon;
    if (this.spinStackTimer > 0) {
      this.spinStackTimer -= dt;
      if (this.spinStackTimer <= 0) this.spinStacks = 0;
    }
    if (!this.stormOn) this.spinStacks = 0;
    for (const [e, t] of this.spinHitCd) {
      if (t - dt <= 0 || !e.alive) this.spinHitCd.delete(e);
      else this.spinHitCd.set(e, t - dt);
    }
    if (stunned || this.dashTimer > 0 || this.slamState) return this.interruptCharge();

    const down = Input.isDown(ATTACK_KEY);
    if (this.chargeCooldownTimer > 0 && !this.charging) {
      // 차징 공격 쿨타임 중에는 차징하지 않고 기본 공격으로 처리 (꾹 누르면 연속)
      this.tapPending = false;
      if (down || Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = W.inputBuffer;
      return;
    }
    if (Input.wasPressed(ATTACK_KEY)) {
      if (this.attackTimer > 0) this.attackBufferTimer = W.inputBuffer; // 휘두르는 중 누르면 다음 타 예약
      else {
        this.tapPending = true;
        this.chargeHold = 0;
      }
    }
    if (this.tapPending) {
      if (!down) {
        // 탭: 일반 휘두르기
        this.tapPending = false;
        this.attackBufferTimer = W.inputBuffer;
      } else {
        this.chargeHold += dt;
        if (this.chargeHold >= W.chargeHoldThreshold && this.attackTimer <= 0) {
          this.tapPending = false;
          this.charging = true;
          this.chargeLevel = 0;
        }
      }
    }
    if (!this.charging) return;
    if (!down) return this.releaseCharge_(enemies);

    const speedMul = 1 + (this.stormOn ? this.spinStacks * W.stormChargeSpeedPerStack : 0);
    this.chargeLevel = Math.min(1, this.chargeLevel + (dt / W.chargeTime) * speedMul);
    this.spinAngle += dt * (6 + this.chargeLevel * 24) * this.facing;
    this.spinHits(enemies);
  }

  // 도는 분동이 적에게 닿으면 (채찍 폭풍) 피해 + 회전 스택
  spinHits(enemies) {
    if (!this.stormOn && !this.weapon.storeEnabled) return;
    const W = this.weapon, r = this.spinRadius;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    for (const e of enemies) {
      if (!e.alive || this.spinHitCd.has(e)) continue;
      const dx = Math.max(e.x - cx, 0, cx - (e.x + e.w)), dy = Math.max(e.y - cy, 0, cy - (e.y + e.h));
      if (Math.hypot(dx, dy) > r) continue;
      this.spinHitCd.set(e, W.stormHitCooldown);
      if (W.storeEnabled) this.storeCharges = Math.min(W.storeMax, this.storeCharges + 1); // 쳐내기 축적: 적에게 닿을 때마다 충전 (적 한 명당 stormHitCooldown 에 1회)
      if (!this.stormOn) continue;
      e.takeHit(W.stormHitDamage * this.chainDamage, Math.sign(e.x + e.w / 2 - cx) || 1, W.deflectKnockbackX, W.deflectKnockbackY, `spin${this.attackId}-${this.spinHitSeq++}`);
      this.addSpinStack();
    }
  }

  // 투사체 p 를 돌고 있는 분동이 쳐낼 수 있으면 처리하고 true (저장 또는 바로 반사)
  tryDeflect(p) {
    if (!this.charging) return false;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (Math.hypot(p.x - cx, p.y - cy) > this.spinRadius + 6) return false;
    const W = this.weapon;
    if (W.storeEnabled && this.storedShots < W.storeMax) {
      this.storedShots++;
      this.storeCharges = Math.min(W.storeMax, this.storeCharges + 1);
    }
    else this.projectiles?.spawn(p.x, p.y, -p.vx, -p.vy, 'player', W.deflectDamage * this.chainDamage); // 저장 없거나 가득 차면 바로 반사
    this.addSpinStack();
    return true;
  }

  // 놓아서 방출: 가장 센 타(chargeReleaseStep)로 휘두르고, 저장한 투사체를 반사한다 (최대 스택이면 전방 넓은 아치)
  releaseCharge_(enemies) {
    const W = this.weapon;
    const maxed = this.stormMaxed;
    this.chargeCooldownTimer = W.chargeCooldown; // 차징 공격을 썼으므로 쿨타임 시작
    this.pendingRelease = this.chargeLevel;
    this.releaseMax = maxed;
    this.cancelCharge();
    this.startAttack(W.chargeReleaseStep, enemies);
    const n = this.storedShots;
    this.storedShots = 0;
    this.releaseStore = this.storeCharges; // 충전 1개당 방출 피해 +storeDamagePerCharge
    this.storeCharges = 0;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    for (let i = 0; i < n; i++) {
      const spread = maxed ? W.stormFanAngle : W.reflectFanAngle; // 최대 스택은 전방으로 훨씬 넓게
      const a = n === 1 ? 0 : ((-spread / 2 + (spread * i) / (n - 1)) * Math.PI) / 180;
      const dx = this.facing * Math.cos(a);
      this.projectiles?.spawn(cx, cy, dx * W.reflectSpeed, Math.sin(a) * W.reflectSpeed, 'player', W.deflectDamage * this.chainDamage);
    }
    if (maxed) this.spinStacks = 0; // 최대 스택은 방출로 소모
  }

  // 돌리는 중: 머리 위 분동 궤도와 쳐내기 범위, 차지 막대, 저장한 투사체·스택 표시
  drawChargeSpin(ctx, cam) {
    const R = this.spinRadius;
    const cx = this.x + this.w / 2 - cam.x, cy = this.y + this.h / 2 - cam.y;
    ctx.strokeStyle = 'rgba(125,255,178,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    const a = this.spinAngle;
    const wx = cx + Math.cos(a) * R, wy = cy + Math.sin(a) * R * 0.5 - this.h * 0.5;
    ctx.strokeStyle = '#b8c4d2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - this.h * 0.5);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    ctx.fillStyle = '#5b6573';
    const ws = 10 * this.weapon.weightModelScale;
    ctx.fillRect(wx - ws / 2, wy - ws / 2, ws, ws);
    ctx.fillStyle = '#ffcc4d';
    ctx.fillRect(cx - 16, cy - this.h - 14, 32 * this.chargeLevel, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 16.5, cy - this.h - 14.5, 33, 5);
    ctx.fillStyle = '#7dffb2';
    for (let i = 0; i < this.storedShots; i++) ctx.fillRect(cx - 16 + i * 7, cy - this.h - 22, 5, 5);
  }
}
