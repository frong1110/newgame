import { PLAYER, GAME } from './data/index.js';
import { Input } from './input.js';
import { moveAndCollide, approach, overlaps } from './physics.js';
import { Chain } from './chain.js';

const ATTACK_KEY = 'KeyX';
const SPECIAL_KEY = 'KeyC'; // 특수 버튼 (사슬: 당기기)
const DASH_KEYS = ['ShiftLeft', 'ShiftRight'];

export class Player {
  constructor(x, y, stats = PLAYER) {
    // 스킬로 바뀐 수치를 쓰기 위해 PLAYER 대신 this.stats 를 읽는다
    this.stats = stats;
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.attackId = 0; // 공격할 때마다 증가. 적이 같은 공격에 중복으로 맞지 않게 하는 용도
    this.chain = new Chain('chain', 'dashCooldownTimer'); // 대시 트리의 사슬 스킬
    this.pullChain = new Chain('pullChain', 'specialCooldownTimer'); // 사슬 무기 특수 버튼: 당기기
    this.respawn(x, y);
  }

  respawn(x, y) {
    this.x = x + (GAME.tileSize - this.w) / 2;
    this.y = y + (GAME.tileSize - this.h);
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpsUsed = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.facing = 1;
    this.squash = 0; // 점프/착지 연출용
    this.attackTimer = 0; // 남은 공격 시간 (0이면 공격 중 아님)
    this.comboStep = 0; // 현재(또는 마지막) 콤보 단계 인덱스
    this.comboTimer = 0; // 공격이 끝난 뒤 다음 타를 이어갈 수 있는 남은 시간
    this.attackBufferTimer = 0; // 미리 누른 공격 입력을 기억하는 시간
    this.dashTimer = 0; // 남은 대시 시간 (0보다 크면 대시 중)
    this.dashDirX = 1; // 대시 방향 (단위 벡터)
    this.dashDirY = 0;
    if (this.chain) this.chain.cancel();
    if (this.pullChain) this.pullChain.cancel();
    this.specialCooldownTimer = 0;
    this.slamReadyTimer = 0; // 내리꽂기를 쓸 수 있는 남은 시간 (사슬 이동 직후)
    this.slamState = null; // null | 'dive' | 'recover'
    this.slamTimer = 0;
    this.slamImpact = null; // 분동이 땅에 닿는 순간 main.js 가 가져가 처리하는 충격파 정보
    this.slamWeight = null; // 내리꽂는 분동 위치 [x, y]
    this.slamCount = 0;
    this.swingLengthScale = 1; // 이번 타의 사슬 길이 배율 (분동 조율로 바뀜)
    this.swingDeg = null; // 이번 프레임 휘두르기 각도 (사슬 판정용)
    this.prevSwingDeg = null;
    this.dashCooldownTimer = 0;
    this.dodgeTimer = 0; // 대시 무적 (대시 직후 약간 더 유지)
    this.airDashesUsed = 0;
    this.ghosts = []; // 대시 잔상
    this.ghostTimer = 0;
    this.stunTimer = 0;
    this.invincibleTimer = 0;
  }

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
      damage: tip ? Math.round(S.tipDamage * W.tipDamageMultiplier) : S.damage,
      knockbackX: S.knockbackX,
      knockbackY: S.knockbackY,
      hitstop: tip ? S.tipHitstop : S.hitstop,
      tip,
      bind: tip ? W.tipBindTime : 0,
      stun: tip ? W.tipStun : 0,
      point,
    };
  }

  startAttack(step, enemies = []) {
    this.comboStep = step;
    this.swingTuned = false;
    this.swingLengthScale = this.usesChainWeapon && this.weapon.tuneEnabled ? this.tuneSwingLength(enemies) : 1;
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
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (wasAttacking && this.attackTimer <= 0) {
      // 마무리 타 이후엔 콤보 초기화(꾹 누르고 있으면 1타부터 다시), 그 외에는 잠깐 이어갈 시간을 준다
      this.comboTimer = this.comboStep < lastStep ? A.comboWindow : 0;
    } else if (this.attackTimer <= 0) {
      this.comboTimer -= dt;
    }

    if (Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = A.inputBuffer;
    else this.attackBufferTimer -= dt;
    // 미리 누른 입력이 있거나, 공격 키를 꾹 누르고 있으면 계속 이어서 공격
    const wantsAttack = this.attackBufferTimer > 0 || Input.isDown(ATTACK_KEY);
    if (stunned || this.dashTimer > 0 || !wantsAttack) return;

    if (this.attackTimer > 0) {
      // 회수 동작 중 chainDelay 가 지난 뒤 입력이 있으면 남은 회수를 끊고 다음 타로
      if (this.canChain && this.comboStep < lastStep) this.startAttack(this.comboStep + 1, enemies);
    } else {
      this.startAttack(this.comboTimer > 0 && this.comboStep < lastStep ? this.comboStep + 1 : 0, enemies);
    }
  }

  // 대시 중이거나 사슬로 멈칫·날아가는 중 (조작 불가)
  get isDashing() {
    return this.dashTimer > 0 || this.chain.locksPlayer || this.pullChain.locksPlayer || this.slamState !== null;
  }

  // 사슬 이동이 끝났을 때 (chain.js 가 호출). 내리꽂기 스킬이 있으면 잠깐 동안 공격 키로 내리꽂을 수 있다
  onChainArrive(chain) {
    if (chain === this.chain && this.stats.chain.slamAfterZip) this.slamReadyTimer = this.stats.slam.readyTime;
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
      x: this.slamWeight[0],
      y: groundY,
      left: Math.min(near, far),
      right: Math.max(near, far),
      hitId: `slam-${this.slamCount}`,
    };
    this.nextSlamState('recover');
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

  // main.js 가 착지 충격파를 한 번 가져간다
  takeSlamImpact() {
    const s = this.slamImpact;
    this.slamImpact = null;
    return s;
  }

  get isInvincible() {
    return this.invincibleTimer > 0 || this.dodgeTimer > 0;
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

  get usesChain() {
    return this.stats.dash.mode === 'chain';
  }

  canDash(stunned) {
    if (stunned || this.isDashing || this.chain.active || this.pullChain.active || this.dashCooldownTimer > 0) return false;
    if (this.usesChain) return true; // 사슬은 대기시간만 있고 공중 횟수 제한 없음
    return this.onGround || this.airDashesUsed < this.stats.dash.maxAirDashes;
  }

  // 방향키 입력 → 대시/사슬 방향 (단위 벡터). 대각선 대시 스킬이 없으면 좌우만
  aim(ix, iy, eightWay = this.stats.dash.directions === 8) {
    const y = eightWay ? iy : 0;
    if (ix === 0 && y === 0) return [this.facing, 0];
    const len = Math.hypot(ix, y);
    return [ix / len, y / len];
  }

  // 대시 키: 대시, 또는 사슬 스킬이 있으면 사슬 던지기
  useDash(ix, iy) {
    const [dx, dy] = this.aim(ix, iy);
    if (dx !== 0) this.facing = Math.sign(dx);
    // 공격을 끊고 사용 (캔슬)
    this.attackTimer = 0;
    this.comboTimer = 0;
    this.ghostTimer = 0;
    if (this.usesChain) {
      this.chain.start(this, dx, dy);
      return;
    }
    const D = this.stats.dash;
    this.dashDirX = dx;
    this.dashDirY = dy;
    this.dashTimer = D.duration;
    this.dashCooldownTimer = D.cooldown;
    this.dodgeTimer = D.duration + D.invincibleExtra;
    if (!this.onGround) this.airDashesUsed++;
  }

  endDash() {
    const D = this.stats.dash;
    this.dashTimer = 0;
    this.vx = this.dashDirX * D.endSpeed;
    this.vy = this.dashDirY < 0 ? this.dashDirY * D.endSpeedY : 0; // 위로 대시했으면 상승을 조금 남긴다
  }

  // 대시 중 이동: 중력 무시, 일정 속도로 직진. 막혀서 거의 못 움직이면 종료
  updateDash(dt, world) {
    const D = this.stats.dash;
    this.dashTimer -= dt;
    this.vx = this.dashDirX * D.speed;
    this.vy = this.dashDirY * D.speed;
    const [x0, y0] = [this.x, this.y];
    moveAndCollide(this, world, dt);
    const moved = Math.hypot(this.x - x0, this.y - y0);
    if (moved < D.speed * dt * 0.3 || this.dashTimer <= 0) this.endDash();
  }

  updateGhosts(dt) {
    const D = this.stats.dash;
    for (const g of this.ghosts) g.t += dt;
    while (this.ghosts.length && this.ghosts[0].t > D.ghostLifetime) this.ghosts.shift();
    if (this.dashTimer > 0 || this.chain.zipping) {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, t: 0 });
        this.ghostTimer = D.ghostInterval;
      }
    }
  }

  update(dt, world, enemies = []) {
    const C = this.stats;
    const stunned = this.stunTimer > 0;
    this.stunTimer -= dt;
    this.invincibleTimer -= dt;
    this.dodgeTimer -= dt;
    this.dashCooldownTimer -= dt;
    this.specialCooldownTimer -= dt;
    this.slamReadyTimer -= dt;
    if (this.onGround) this.airDashesUsed = 0;
    this.updateGhosts(dt);

    // --- 대시 / 사슬 ---
    const inputDir = stunned ? 0 : (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
    const inputY = stunned ? 0 : (Input.isDown('ArrowDown') ? 1 : 0) - (Input.isDown('ArrowUp') ? 1 : 0);
    if (DASH_KEYS.some((k) => Input.wasPressed(k)) && !stunned) {
      if (this.chain.hooked) {
        // 사슬을 걸어 둔 상태에서 다시 누르면 발동 (공격 캔슬)
        this.attackTimer = 0;
        this.comboTimer = 0;
        this.chain.trigger(this);
      } else if (this.canDash(stunned)) this.useDash(inputDir, inputY);
    }
    // --- 특수 버튼: 사슬 당기기 (사슬 무기일 때). ↑↓ 로 위아래·대각선 조준 ---
    this.holdingUp = !stunned && Input.isDown('ArrowUp'); // 회전 투척: 당기는 동안 ↑ 면 띄우기
    if (Input.wasPressed(SPECIAL_KEY) && this.canUseSpecialChain(stunned)) {
      // 내리찍기: 공중 상태 적이 사거리 안에 있으면 그 적을 노린다 (대기시간 무시 → 띄운 직후 바로 이어짐)
      const airTarget = this.stats.pullChain.slamAirborne ? this.findAirborneTarget(enemies) : null;
      if (airTarget || this.specialCooldownTimer <= 0) {
        this.attackTimer = 0;
        this.comboTimer = 0;
        if (airTarget) {
          this.facing = Math.sign(airTarget.x + airTarget.w / 2 - (this.x + this.w / 2)) || this.facing;
          this.pullChain.startSlam(this, airTarget);
        } else {
          // 회전 투척이 있으면 ↑ 는 조준이 아니라 '띄우기' 입력: 사슬은 좌우로만 던지고, ↑ 를 기억해 둔다
          const throwSkill = ['throw', 'storm'].includes(this.stats.pullChain.onPullArrive);
          const [dx, dy] = this.aim(inputDir, inputY, !throwSkill);
          if (dx !== 0) this.facing = Math.sign(dx);
          this.pullChain.start(this, dx, dy);
          if (throwSkill) this.pullChain.launchWanted = this.holdingUp;
        }
      }
    }
    if (this.chain.active) this.chain.update(dt, this, world, enemies);
    if (this.pullChain.active) this.pullChain.update(dt, this, world, enemies);
    // 내리꽂기: 사슬 이동 직후 공격 키 (이동 중에 미리 누른 것도 인정)
    if (
      this.slamReadyTimer > 0 && !this.slamState && !this.chain.locksPlayer && !stunned &&
      (Input.wasPressed(ATTACK_KEY) || this.attackBufferTimer > 0)
    ) this.startSlam();
    if (this.slamState) this.updateSlam(dt, world);
    if (this.isDashing) {
      if (this.dashTimer > 0) this.updateDash(dt, world);
      // 대시 중 눌린 점프·공격은 버퍼에 남겨서 대시가 끝나면 이어지게
      if (Input.wasPressed('Space')) this.jumpBufferTimer = C.jumpBuffer;
      if (Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = this.weapon.inputBuffer;
      return;
    }

    // --- 공격 ---
    this.updateAttack(dt, stunned, enemies);
    const attacking = this.attackTimer > 0;
    if (attacking) {
      // 사슬 판정은 지난 프레임 → 이번 프레임 각도 사이를 훑는다
      const deg = this.swingAngle(this.attackElapsed);
      this.prevSwingDeg = this.swingDeg ?? deg;
      this.swingDeg = deg;
    }
    const lunging = attacking && this.attackElapsed < this.step.lungeTime;

    // --- 좌우 이동 ---
    const dir = inputDir;
    if (dir !== 0 && !attacking) this.facing = dir; // 공격 중에는 방향 고정
    const maxSpeed = C.moveSpeed * (attacking && this.onGround ? this.weapon.moveSpeedMultiplier : 1);
    const accel = this.onGround ? C.groundAccel : C.airAccel;
    const decel = this.onGround ? C.groundDecel : C.airDecel;
    if (stunned) {
      // 넉백 중에는 조작 불가, 공중 감속만
      this.vx = approach(this.vx, 0, C.airDecel * dt);
    } else if (lunging) {
      // 공격하면서 앞으로 살짝 내딛기
      this.vx = this.facing * this.step.lungeSpeed * (this.onGround ? 1 : this.weapon.airLungeMultiplier);
    } else if (dir !== 0) {
      this.vx = approach(this.vx, dir * maxSpeed, accel * dt);
    } else {
      this.vx = approach(this.vx, 0, decel * dt);
    }

    // --- 점프 (코요테 타임 + 점프 버퍼 + 2단 점프) ---
    if (this.onGround) {
      this.coyoteTimer = C.coyoteTime;
      this.jumpsUsed = 0;
    } else {
      this.coyoteTimer -= dt;
      // 점프 없이 발판에서 떨어졌다면 코요테 시간 이후엔 1단 점프를 쓴 것으로 처리
      if (this.coyoteTimer <= 0 && this.jumpsUsed === 0) this.jumpsUsed = 1;
    }

    if (Input.wasPressed('Space')) this.jumpBufferTimer = C.jumpBuffer;
    else this.jumpBufferTimer -= dt;

    if (this.jumpBufferTimer > 0 && !stunned) {
      const canGroundJump = this.coyoteTimer > 0 && this.jumpsUsed === 0;
      const canAirJump = !canGroundJump && this.jumpsUsed < C.maxJumps;
      if (canGroundJump) {
        this.vy = -C.jumpSpeed;
        this.jumpsUsed = 1;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.squash = -C.jumpStretch;
      } else if (canAirJump && Input.wasPressed('Space')) {
        // 공중 점프는 "이번 프레임에 누른 경우"에만 (버퍼로 자동 소모되지 않게)
        this.vy = -C.doubleJumpSpeed;
        this.jumpsUsed++;
        this.jumpBufferTimer = 0;
        this.squash = -C.jumpStretch;
        this.spawnPuff = true;
      }
    }

    // 스페이스를 일찍 떼면 낮게 점프
    if (Input.wasReleased('Space') && this.vy < 0 && !stunned) this.vy *= C.jumpCut;

    // --- 중력 + 충돌 ---
    this.vy = Math.min(this.vy + C.gravity * dt, C.maxFallSpeed);
    const wasOnGround = this.onGround;
    moveAndCollide(this, world, dt);
    if (this.onGround && !wasOnGround) this.squash = C.landSquash;

    this.squash = approach(this.squash, 0, C.squashRecovery * dt);
  }

  // 적과 부딪혔을 때. fromDir: 적 → 플레이어 방향 (+1 / -1)
  hurt(fromDir) {
    if (this.isInvincible) return false; // 피격 무적 또는 대시 회피 중
    const H = this.stats.hurt;
    this.vx = fromDir * H.knockbackX;
    this.vy = -H.knockbackY;
    this.stunTimer = H.stunTime;
    this.invincibleTimer = H.invincibleTime;
    this.attackTimer = 0;
    this.comboTimer = 0;
    this.attackBufferTimer = 0;
    this.dashTimer = 0;
    this.chain.cancel();
    this.pullChain.cancel();
    this.slamState = null;
    this.slamReadyTimer = 0;
    return true;
  }

  draw(ctx, cam) {
    this.chain.draw(ctx, cam, this);
    this.pullChain.draw(ctx, cam, this);
    this.drawSlamChain(ctx, cam);
    // 대시 잔상
    const D = this.stats.dash;
    for (const g of this.ghosts) {
      ctx.fillStyle = `rgba(120,220,255,${0.45 * (1 - g.t / D.ghostLifetime)})`;
      ctx.fillRect(g.x - cam.x, g.y - cam.y, this.w, this.h);
    }

    // 무적 시간 동안 깜빡임
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / this.stats.hurt.blinkInterval) % 2 === 0) return;

    // squash > 0: 납작, < 0: 길쭉
    const sx = 1 + this.squash;
    const sy = 1 - this.squash;
    const w = this.w * sx;
    const h = this.h * sy;
    const px = this.x + this.w / 2 - cam.x;
    const py = this.y + this.h - cam.y; // 발 기준

    if (this.usesChainWeapon) this.drawChainWhip(ctx, cam);
    else this.drawSword(ctx, px, py - h / 2);

    if (this.slamReadyTimer > 0) {
      // 내리꽂기 가능 표시: 머리 위 아래쪽 화살표
      ctx.fillStyle = '#ffcc4d';
      ctx.beginPath();
      ctx.moveTo(px - 7, py - h - 16);
      ctx.lineTo(px + 7, py - h - 16);
      ctx.lineTo(px, py - h - 7);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = this.stunTimer > 0 ? '#ff8a65' : this.dodgeTimer > 0 ? '#bff3ff' : '#ffcc4d';
    ctx.fillRect(px - w / 2, py - h, w, h);
    // 눈 (바라보는 방향 표시)
    ctx.fillStyle = '#222';
    const eyeX = px + this.facing * w * 0.18;
    ctx.fillRect(eyeX - 2, py - h * 0.72, 4, 6);
    ctx.fillRect(eyeX + this.facing * 7 - 2, py - h * 0.72, 4, 6);
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
    const t = this.attackElapsed;
    if (t < 0) return;
    const S = this.step;
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
