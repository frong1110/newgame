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
    this.stunTimer = 0;
    this.invincibleTimer = 0;
  }

  get attackDuration() {
    const A = PLAYER.attack;
    return A.startup + A.active + A.recovery;
  }

  // 공격 시작 후 경과 시간 (공격 중이 아니면 -1)
  get attackElapsed() {
    return this.attackTimer > 0 ? this.attackDuration - this.attackTimer : -1;
  }

  get isAttackActive() {
    const A = PLAYER.attack;
    const t = this.attackElapsed;
    return t >= A.startup && t < A.startup + A.active;
  }

  // 공격 판정 영역 (판정 프레임이 아니면 null)
  getAttackHitbox() {
    if (!this.isAttackActive) return null;
    const A = PLAYER.attack;
    return {
      x: this.facing > 0 ? this.x + this.w : this.x - A.rangeWidth,
      y: this.y + this.h / 2 - A.rangeHeight / 2,
      w: A.rangeWidth,
      h: A.rangeHeight,
    };
  }

  update(dt, world) {
    const C = PLAYER;
    const stunned = this.stunTimer > 0;
    this.stunTimer -= dt;
    this.invincibleTimer -= dt;

    // --- 공격 ---
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (!stunned && this.attackTimer <= 0 && Input.wasPressed(ATTACK_KEY)) {
      this.attackTimer = this.attackDuration;
      this.attackId++;
    }
    const attacking = this.attackTimer > 0;

    // --- 좌우 이동 ---
    const dir = stunned ? 0 : (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
    if (dir !== 0 && !attacking) this.facing = dir; // 공격 중에는 방향 고정
    const maxSpeed = C.moveSpeed * (attacking && this.onGround ? C.attack.moveSpeedMultiplier : 1);
    const accel = this.onGround ? C.groundAccel : C.airAccel;
    const decel = this.onGround ? C.groundDecel : C.airDecel;
    if (stunned) {
      // 넉백 중에는 조작 불가, 공중 감속만
      this.vx = approach(this.vx, 0, C.airDecel * dt);
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

  // 공격 모션: 준비(뒤로 들어올림) → 판정(앞으로 내려베기 + 궤적) → 회수
  drawSword(ctx, cx, cy) {
    const t = this.attackElapsed;
    if (t < 0) return;
    const A = PLAYER.attack;
    const L = A.swordLength;
    const START = -130, END = 60; // 각도(도). 0 = 정면, 음수 = 위쪽

    let deg;
    if (t < A.startup) {
      deg = START - 20 * (t / A.startup); // 살짝 더 젖히며 힘 모으기
    } else if (t < A.startup + A.active) {
      const k = (t - A.startup) / A.active;
      deg = START - 20 + (END - START + 20) * (1 - (1 - k) * (1 - k)); // 빠르게 휘두르기
    } else {
      deg = END;
    }
    const toXY = (d) => {
      const r = (d * Math.PI) / 180;
      return [cx + this.facing * Math.cos(r) * L, cy + Math.sin(r) * L];
    };

    // 베기 궤적
    if (this.isAttackActive) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let d = START - 20; d <= deg; d += 8) ctx.lineTo(...toXY(d));
      ctx.lineTo(...toXY(deg));
      ctx.closePath();
      ctx.fill();
    }

    const fade = t > A.startup + A.active ? 1 - (t - A.startup - A.active) / A.recovery : 1;
    ctx.strokeStyle = `rgba(220,230,255,${fade})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...toXY(deg));
    ctx.stroke();
  }
}
