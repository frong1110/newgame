import { GAME } from './data/index.js';
import { moveAndCollide } from './physics.js';

// 대시 트리 '내리꽂기': 사슬 이동 직후 공격 키로 분동을 머리 위로 휘둘러 땅에 꽂는다.
// player.js 의 Player 에 메서드로 붙는다 (applyMixins). this 는 Player.
export class PlayerSlam {
  // 사슬 이동이 끝났을 때 (chain.js 가 호출). 내리꽂기 스킬이 있으면 잠깐 동안 공격 키로 내리꽂을 수 있다
  onChainArrive(chain) {
    const C = this.stats.chain;
    if (chain === this.chain && C.slamAfterZip) this.slamReadyTimer = this.stats.slam.readyTime;
    if (chain === this.chain && C.recoilEnabled) {
      this.recoilTimer = C.recoilWindow; // 반동: 도착 직후 첫 공격 강화 + 잠깐 무적
      this.dodgeTimer = Math.max(this.dodgeTimer, C.recoilInvincible);
    }
  }

  startSlam() {
    this.slamState = 'windup';
    this.slamTimer = 0;
    this.slamReadyTimer = 0;
    this.attackTimer = 0;
    this.comboTimer = 0;
    this.attackBufferTimer = 0;
    this.slamCount++;
    this.slamWeight = this.slamPoint(160);
  }

  // 내리꽂기용 손 위치 (사슬이 나오는 곳)
  slamHand() {
    return [this.x + this.w / 2 + this.facing * this.stats.chainWeapon.pivotForward, this.y + this.h / 2 - 4];
  }

  // 손을 중심으로 한 분동 위치. 각도(도): 180 = 뒤, 270 = 머리 위, 360 = 앞. 반지름 = 휘두르기 끝부분 거리
  slamPoint(deg) {
    const W = this.stats.chainWeapon;
    const r = W.combo[0].length * W.lengthMultiplier * W.arcScaleX * (1 - W.tipFraction / 2);
    const [hx, hy] = this.slamHand();
    const rad = (deg * Math.PI) / 180;
    return [hx + this.facing * Math.cos(rad) * r, hy + Math.sin(rad) * r * this.stats.slam.overheadScaleY];
  }

  // 내리꽂기: 분동을 뒤에서 머리 위로 끌어올렸다가(windup) 앞으로 내려치고(strike),
  // 앞쪽에서 땅까지 수직으로 꽂는다(drop). 분동이 떨어진 지점에서 충격파. 그동안 플레이어는 공중에 멈춤(무적)
  updateSlam(dt, world) {
    const S = this.stats.slam;
    const T = GAME.tileSize;
    this.slamTimer += dt;
    const hold = this.slamState !== 'recover';
    if (hold) {
      this.vx = 0;
      this.vy = 0;
      this.dodgeTimer = Math.max(this.dodgeTimer, dt * 2);
    }

    if (this.slamState === 'windup') {
      const k = Math.min(1, this.slamTimer / S.windupTime);
      this.slamAngle = 160 + 110 * k;
      this.slamWeight = this.slamPoint(this.slamAngle);
      if (k >= 1) this.nextSlamState('strike');
    } else if (this.slamState === 'strike') {
      const k = Math.min(1, this.slamTimer / S.strikeTime);
      this.slamAngle = 270 + 90 * k * k; // 점점 빨라지며 내려침
      this.slamWeight = this.slamPoint(this.slamAngle);
      if (k >= 1) {
        this.slamDropStart = this.slamWeight[1];
        // 앞이 벽이면 그 자리에서 충격
        if (world.isSolid(Math.floor(this.slamWeight[0] / T), Math.floor(this.slamWeight[1] / T))) this.slamHit(this.slamWeight[1]);
        else this.nextSlamState('drop');
      }
    } else if (this.slamState === 'drop') {
      let remaining = S.dropSpeed * dt;
      while (remaining > 0) {
        const step = Math.min(4, remaining);
        remaining -= step;
        const [wx, wy] = this.slamWeight;
        const ny = wy + step;
        if (world.isSolid(Math.floor(wx / T), Math.floor(ny / T))) return this.slamHit(Math.floor(ny / T) * T);
        this.slamWeight = [wx, ny];
        if (ny - this.slamDropStart >= S.maxDrop) return this.slamHit(ny);
      }
    } else if (this.slamState === 'recover') {
      // 사슬을 거두는 동안 중력은 다시 받는다
      this.vx = 0;
      this.vy = Math.min(this.vy + this.stats.gravity * dt, this.stats.maxFallSpeed);
      moveAndCollide(this, world, dt);
      if (this.slamTimer >= S.recovery) this.slamState = null;
    }
  }

  nextSlamState(state) {
    this.slamState = state;
    this.slamTimer = 0;
  }

  // 분동이 땅(groundY)에 닿음: 충격파 정보를 남기고 거두기로
  slamHit(groundY) {
    const S = this.stats.slam;
    this.slamWeight = [this.slamWeight[0], groundY - S.weightSize / 2];
    this.slamImpactPoint = [...this.slamWeight];
    // 맞는 범위: 몸쪽(플레이어 중심 + areaNear) ~ 분동이 떨어진 곳 + areaFar
    const cx = this.x + this.w / 2;
    const near = cx + this.facing * S.areaNear;
    const far = this.slamWeight[0] + this.facing * S.areaFar;
    this.slamImpact = {
      ...S,
      damage: S.damage * this.chainDamage, // 사슬 데미지 단위의 배수
      x: this.slamWeight[0],
      y: groundY,
      left: Math.min(near, far),
      right: Math.max(near, far),
      hitId: `slam-${this.slamCount}`,
    };
    this.nextSlamState('recover');
  }

  // main.js 가 착지 충격파를 한 번 가져간다
  takeSlamImpact() {
    const s = this.slamImpact;
    this.slamImpact = null;
    return s;
  }

  // 내리꽂기 사슬: 손 → 분동. 내려칠 때는 머리 위 궤적, 떨어질 때는 수직 잔상, 거둘 때는 손으로 돌아옴
  drawSlamChain(ctx, cam) {
    if (!this.slamState || !this.slamWeight) return;
    const S = this.stats.slam;
    const [hx, hy] = this.slamHand();
    let [wx, wy] = this.slamWeight;
    let alpha = 1;
    if (this.slamState === 'recover') {
      const k = Math.min(1, this.slamTimer / S.recovery);
      [wx, wy] = [this.slamImpactPoint[0] + (hx - this.slamImpactPoint[0]) * k, this.slamImpactPoint[1] + (hy - this.slamImpactPoint[1]) * k];
      alpha = 1 - k;
    }
    const x0 = hx - cam.x, y0 = hy - cam.y, x1 = wx - cam.x, y1 = wy - cam.y;

    // 궤적: 내려치는 동안 머리 위 호, 떨어지는 동안 수직 잔상
    if (this.slamState === 'strike' || this.slamState === 'drop') {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const end = this.slamState === 'strike' ? this.slamAngle : 360;
      for (let d = 250; d <= end; d += 6) {
        const [px, py] = this.slamPoint(d);
        ctx.lineTo(px - cam.x, py - cam.y);
      }
      if (this.slamState === 'drop') ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // 사슬 고리
    const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
    ctx.fillStyle = `rgba(184,196,210,${alpha})`;
    for (let d = 6; d < len; d += 7) {
      const k = d / len;
      ctx.fillRect(x0 + (x1 - x0) * k - 2, y0 + (y1 - y0) * k - 2, 4, 4);
    }
    // 분동 (내리꽂기용으로 크게)
    const ws = S.weightSize;
    ctx.fillStyle = `rgba(91,101,115,${alpha})`;
    ctx.fillRect(x1 - ws / 2, y1 - ws / 2, ws, ws);
    ctx.strokeStyle = this.slamState === 'recover' ? `rgba(255,214,90,${alpha})` : '#e8eef5';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1 - ws / 2 + 0.5, y1 - ws / 2 + 0.5, ws - 1, ws - 1);
  }
}
