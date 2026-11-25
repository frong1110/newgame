// 플레이어: 생성·리스폰, 매 프레임 업데이트(입력 → 대시/사슬/공격/이동/점프), 피격, 그리기.
// 기능별 메서드는 다른 파일에 있고 아래 applyMixins 로 붙는다:
//   playerWeapon.js (휘두르기·검·분동 조율·특수 대상), playerDash.js (대시·조준·잔상), playerSlam.js (내리꽂기),
//   spinCharge.js (분동 갈래: 회전 차지·쳐내기 축적·채찍 폭풍)
import { PLAYER, GAME } from './data/index.js';
import { Input } from './input.js';
import { moveAndCollide, approach } from './physics.js';
import { Chain } from './chain.js';
import { ATTACK_KEY, SPECIAL_KEY, DASH_KEYS } from './controls.js';
import { applyMixins } from './mixin.js';
import { PlayerWeapon } from './playerWeapon.js';
import { PlayerDash } from './playerDash.js';
import { PlayerSlam } from './playerSlam.js';
import { PlayerSpin } from './spinCharge.js';

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
    this.swingStorm = false; // 이번 휘두르기가 원형 범위인지 (최대 스택 방출)
    this.charging = false; // 회전 차지 중 (공격 키를 꾹 누름)
    this.tapPending = false; // 공격 키를 눌렀고 탭인지 홀드인지 가리는 중
    this.chargeHold = 0;
    this.chargeLevel = 0; // 차지량 0~1
    this.pendingRelease = null; // 방출 휘두르기를 시작할 때 startAttack 에 넘기는 차지량
    this.releaseCharge = null; // 이번 휘두르기가 방출 타라면 그때의 차지량 (아니면 null)
    this.releaseMax = false;
    this.storedShots = 0; // 쳐내기 축적: 분동에 저장된 투사체 수
    this.spinStacks = 0; // 채찍 폭풍 회전 스택
    this.spinStackTimer = 0; // 스택이 사라지기까지 남은 시간
    this.spinAngle = 0;
    this.spinHitCd = new Map(); // 회전 중 같은 적을 연달아 맞히지 않게
    this.spinHitSeq = 0;
    this.dashCooldownTimer = 0;
    this.dodgeTimer = 0; // 대시 무적 (대시 직후 약간 더 유지)
    this.airDashesUsed = 0;
    this.ghosts = []; // 대시 잔상
    this.ghostTimer = 0;
    this.stunTimer = 0;
    this.invincibleTimer = 0;
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
    // 철퇴 폭풍 회전 중 C 를 다시 누르면 적을 던진다 (회전 중에는 아래 특수 버튼 시작 처리가 막혀 있다)
    if (Input.wasPressed(SPECIAL_KEY) && this.pullChain.phase === 'spin') this.pullChain.releaseRequested = true;
    // 결박 갈래: 묶인 적이 2명 이상이면 C 가 당기기 대신 끌어모으기 (팽팽한 줄: 충돌, 사슬 감옥: 폭발)
    if (Input.wasPressed(SPECIAL_KEY) && this.canUseSpecialChain(stunned) && this.specialCooldownTimer <= 0 && this.bindPull?.tryStart()) {
      this.attackTimer = 0;
      this.comboTimer = 0;
      this.specialCooldownTimer = this.stats.chainWeapon.bindPullCooldown;
    } else if (Input.wasPressed(SPECIAL_KEY) && this.canUseSpecialChain(stunned)) {
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
    const maxSpeed = C.moveSpeed * (this.charging ? this.weapon.chargeMoveMultiplier : attacking && this.onGround ? this.weapon.moveSpeedMultiplier : 1);
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
    this.cancelCharge();
    this.storedShots = 0;
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
}

applyMixins(Player, PlayerWeapon, PlayerDash, PlayerSlam, PlayerSpin);
