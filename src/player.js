import { PLAYER, GAME } from './data/index.js';
import { Input } from './input.js';
import { moveAndCollide, approach } from './physics.js';
import { Chain } from './chain.js';

const ATTACK_KEY = 'KeyX';
const DASH_KEYS = ['ShiftLeft', 'ShiftRight'];

export class Player {
  constructor(x, y, stats = PLAYER) {
    // 스킬로 바뀐 수치를 쓰기 위해 PLAYER 대신 this.stats 를 읽는다
    this.stats = stats;
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.attackId = 0; // 공격할 때마다 증가. 적이 같은 공격에 중복으로 맞지 않게 하는 용도
    this.chain = new Chain(); // 사슬 스킬
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
    this.dashCooldownTimer = 0;
    this.dodgeTimer = 0; // 대시 무적 (대시 직후 약간 더 유지)
    this.airDashesUsed = 0;
    this.ghosts = []; // 대시 잔상
    this.ghostTimer = 0;
    this.stunTimer = 0;
    this.invincibleTimer = 0;
  }

  get step() {
    return this.stats.attack.combo[this.comboStep];
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

  startAttack(step) {
    this.comboStep = step;
    this.attackTimer = this.attackDuration;
    this.attackBufferTimer = 0;
    this.attackId++;
  }

  // 공격 입력·콤보 진행
  updateAttack(dt, stunned) {
    const A = this.stats.attack;
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
      if (this.canChain && this.comboStep < lastStep) this.startAttack(this.comboStep + 1);
    } else {
      this.startAttack(this.comboTimer > 0 && this.comboStep < lastStep ? this.comboStep + 1 : 0);
    }
  }

  // 대시 중이거나 사슬로 멈칫·날아가는 중 (조작 불가)
  get isDashing() {
    return this.dashTimer > 0 || this.chain.locksPlayer;
  }

  get isInvincible() {
    return this.invincibleTimer > 0 || this.dodgeTimer > 0;
  }

  get usesChain() {
    return this.stats.dash.mode === 'chain';
  }

  canDash(stunned) {
    if (stunned || this.isDashing || this.chain.active || this.dashCooldownTimer > 0) return false;
    if (this.usesChain) return true; // 사슬은 대기시간만 있고 공중 횟수 제한 없음
    return this.onGround || this.airDashesUsed < this.stats.dash.maxAirDashes;
  }

  // 방향키 입력 → 대시/사슬 방향 (단위 벡터). 대각선 대시 스킬이 없으면 좌우만
  aim(ix, iy) {
    const y = this.stats.dash.directions === 8 ? iy : 0;
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
    if (this.onGround) this.airDashesUsed = 0;
    this.updateGhosts(dt);

    // --- 대시 / 사슬 ---
    const inputDir = stunned ? 0 : (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
    const inputY = stunned ? 0 : (Input.isDown('ArrowDown') ? 1 : 0) - (Input.isDown('ArrowUp') ? 1 : 0);
    if (DASH_KEYS.some((k) => Input.wasPressed(k)) && this.canDash(stunned)) this.useDash(inputDir, inputY);
    if (this.chain.active) this.chain.update(dt, this, world, enemies);
    if (this.isDashing) {
      if (this.dashTimer > 0) this.updateDash(dt, world);
      // 대시 중 눌린 점프·공격은 버퍼에 남겨서 대시가 끝나면 이어지게
      if (Input.wasPressed('Space')) this.jumpBufferTimer = C.jumpBuffer;
      if (Input.wasPressed(ATTACK_KEY)) this.attackBufferTimer = C.attack.inputBuffer;
      return;
    }

    // --- 공격 ---
    this.updateAttack(dt, stunned);
    const attacking = this.attackTimer > 0;
    const lunging = attacking && this.attackElapsed < this.step.lungeTime;

    // --- 좌우 이동 ---
    const dir = inputDir;
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
    return true;
  }

  draw(ctx, cam) {
    this.chain.draw(ctx, cam, this);
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

    this.drawSword(ctx, px, py - h / 2);

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
