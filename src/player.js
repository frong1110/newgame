import { PLAYER, GAME } from './data/index.js';
import { Input } from './input.js';
import { moveAndCollide, approach } from './physics.js';

const ATTACK_KEY = 'KeyX';

export class Player {
  constructor(x, y) {
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.attackId = 0; // 공격할 때마다 증가. 적이 같은 공격에 중복으로 맞지 않게 하는 용도
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
    this.stunTimer = 0;
    this.invincibleTimer = 0;
  }

  get step() {
    return PLAYER.attack.combo[this.comboStep];
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

  startAttack(step) {
    this.comboStep = step;
    this.attackTimer = this.attackDuration;
    this.attackBufferTimer = 0;
    this.attackId++;
  }

  // 공격 입력·콤보 진행
  updateAttack(dt, stunned) {
    const A = PLAYER.attack;
    const lastStep = A.combo.length - 1;
    const wasAttacking = this.attackTimer > 0;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (wasAttacking && this.attackTimer <= 0) {
      // 마무리 타 이후엔 콤보 초기화, 그 외에는 잠깐 이어갈 시간을 준다
      this.comboTimer = this.comboStep < lastStep ? A.comboWindow : 0;
    } else if (this.attackTimer <= 0) {
      this.comboTimer -= dt;
    }

    if (Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = A.inputBuffer;
    else this.attackBufferTimer -= dt;
    if (stunned || this.attackBufferTimer <= 0) return;

    if (this.attackTimer > 0) {
      // 회수 동작 중에 입력이 있으면 회수를 끊고 다음 타로
      if (this.inRecovery && this.comboStep < lastStep) this.startAttack(this.comboStep + 1);
    } else {
      this.startAttack(this.comboTimer > 0 && this.comboStep < lastStep ? this.comboStep + 1 : 0);
    }
  }

  update(dt, world) {
    const C = PLAYER;
    const stunned = this.stunTimer > 0;
    this.stunTimer -= dt;
    this.invincibleTimer -= dt;

    // --- 공격 ---
    this.updateAttack(dt, stunned);
    const attacking = this.attackTimer > 0;
    const lunging = attacking && this.attackElapsed < this.step.lungeTime;

    // --- 좌우 이동 ---
    const dir = stunned ? 0 : (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
    if (dir !== 0 && !attacking) this.facing = dir; // 공격 중에는 방향 고정
    const maxSpeed = C.moveSpeed * (attacking && this.onGround ? C.attack.moveSpeedMultiplier : 1);
    const accel = this.onGround ? C.groundAccel : C.airAccel;
    const decel = this.onGround ? C.groundDecel : C.airDecel;
    if (stunned) {
      // 넉백 중에는 조작 불가, 공중 감속만
      this.vx = approach(this.vx, 0, C.airDecel * dt);
    } else if (lunging) {
      // 공격하면서 앞으로 살짝 내딛기
      this.vx = this.facing * this.step.lungeSpeed * (this.onGround ? 1 : C.attack.airLungeMultiplier);
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
    if (this.invincibleTimer > 0) return false;
    const H = PLAYER.hurt;
    this.vx = fromDir * H.knockbackX;
    this.vy = -H.knockbackY;
    this.stunTimer = H.stunTime;
    this.invincibleTimer = H.invincibleTime;
    this.attackTimer = 0;
    this.comboTimer = 0;
    this.attackBufferTimer = 0;
    return true;
  }

  draw(ctx, cam) {
    // 무적 시간 동안 깜빡임
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / PLAYER.hurt.blinkInterval) % 2 === 0) return;

    // squash > 0: 납작, < 0: 길쭉
    const sx = 1 + this.squash;
    const sy = 1 - this.squash;
    const w = this.w * sx;
    const h = this.h * sy;
    const px = this.x + this.w / 2 - cam.x;
    const py = this.y + this.h - cam.y; // 발 기준

    this.drawSword(ctx, px, py - h / 2);

    ctx.fillStyle = this.stunTimer > 0 ? '#ff8a65' : '#ffcc4d';
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
    const A = PLAYER.attack;
    const S = this.step;
    const L = S.swordLength;
    const from = S.fromAngle, to = S.toAngle; // 각도(도). 0 = 정면, 음수 = 위쪽
    const sweep = Math.sign(to - from);
    const windup = from - sweep * 15;
    const ox = cx + this.facing * A.pivotForward;

    let deg;
    if (t < S.startup) {
      deg = from + (windup - from) * (t / S.startup);
    } else if (t < S.startup + S.active) {
      const k = (t - S.startup) / S.active;
      deg = windup + (to - windup) * (1 - (1 - k) * (1 - k)); // 빠르게 시작해서 끝에서 감속
    } else {
      deg = to;
    }
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
}
