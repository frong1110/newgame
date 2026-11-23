class Player {
  constructor(x, y) {
    this.w = 24;
    this.h = 30;
    this.respawn(x, y);
  }

  respawn(x, y) {
    this.x = x + (CONFIG.TILE - this.w) / 2;
    this.y = y + (CONFIG.TILE - this.h);
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpsUsed = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.facing = 1;
    this.squash = 0; // 점프/착지 연출용
  }

  update(dt, world) {
    const C = CONFIG;

    // --- 좌우 이동 ---
    const dir = (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const accel = this.onGround ? C.GROUND_ACCEL : C.AIR_ACCEL;
    const decel = this.onGround ? C.GROUND_DECEL : C.AIR_DECEL;
    if (dir !== 0) {
      this.vx = approach(this.vx, dir * C.MOVE_SPEED, accel * dt);
    } else {
      this.vx = approach(this.vx, 0, decel * dt);
    }

    // --- 점프 (코요테 타임 + 점프 버퍼 + 2단 점프) ---
    if (this.onGround) {
      this.coyoteTimer = C.COYOTE_TIME;
      this.jumpsUsed = 0;
    } else {
      this.coyoteTimer -= dt;
      // 점프 없이 발판에서 떨어졌다면 코요테 시간 이후엔 1단 점프를 쓴 것으로 처리
      if (this.coyoteTimer <= 0 && this.jumpsUsed === 0) this.jumpsUsed = 1;
    }

    if (Input.wasPressed('Space')) this.jumpBufferTimer = C.JUMP_BUFFER;
    else this.jumpBufferTimer -= dt;

    if (this.jumpBufferTimer > 0) {
      const canGroundJump = this.coyoteTimer > 0 && this.jumpsUsed === 0;
      const canAirJump = !canGroundJump && this.jumpsUsed < C.MAX_JUMPS;
      if (canGroundJump) {
        this.vy = -C.JUMP_SPEED;
        this.jumpsUsed = 1;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.squash = -0.3;
      } else if (canAirJump && Input.wasPressed('Space')) {
        // 공중 점프는 "이번 프레임에 누른 경우"에만 (버퍼로 자동 소모되지 않게)
        this.vy = -C.DOUBLE_JUMP_SPEED;
        this.jumpsUsed++;
        this.jumpBufferTimer = 0;
        this.squash = -0.3;
        this.spawnPuff = true;
      }
    }

    // 스페이스를 일찍 떼면 낮게 점프
    if (Input.wasReleased('Space') && this.vy < 0) this.vy *= C.JUMP_CUT;

    // --- 중력 ---
    this.vy = Math.min(this.vy + C.GRAVITY * dt, C.MAX_FALL_SPEED);

    // --- 충돌 처리 (축별로 분리) ---
    this.x += this.vx * dt;
    this.resolveX(world);

    const wasOnGround = this.onGround;
    this.y += this.vy * dt;
    this.onGround = false;
    this.resolveY(world);
    if (this.onGround && !wasOnGround) this.squash = 0.25;

    this.squash = approach(this.squash, 0, 2.5 * dt);
  }

  resolveX(world) {
    const T = CONFIG.TILE;
    const top = Math.floor(this.y / T);
    const bottom = Math.floor((this.y + this.h - 0.01) / T);
    if (this.vx > 0) {
      const tx = Math.floor((this.x + this.w) / T);
      for (let ty = top; ty <= bottom; ty++) {
        if (world.isSolid(tx, ty)) { this.x = tx * T - this.w; this.vx = 0; return; }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.x / T);
      for (let ty = top; ty <= bottom; ty++) {
        if (world.isSolid(tx, ty)) { this.x = (tx + 1) * T; this.vx = 0; return; }
      }
    }
  }

  resolveY(world) {
    const T = CONFIG.TILE;
    const left = Math.floor(this.x / T);
    const right = Math.floor((this.x + this.w - 0.01) / T);
    if (this.vy > 0) {
      const ty = Math.floor((this.y + this.h) / T);
      for (let tx = left; tx <= right; tx++) {
        if (world.isSolid(tx, ty)) {
          this.y = ty * T - this.h; this.vy = 0; this.onGround = true; return;
        }
      }
    } else if (this.vy < 0) {
      const ty = Math.floor(this.y / T);
      for (let tx = left; tx <= right; tx++) {
        if (world.isSolid(tx, ty)) { this.y = (ty + 1) * T; this.vy = 0; return; }
      }
    }
  }

  draw(ctx, cam) {
    // squash > 0: 납작, < 0: 길쭉
    const sx = 1 + this.squash;
    const sy = 1 - this.squash;
    const w = this.w * sx;
    const h = this.h * sy;
    const px = this.x + this.w / 2 - cam.x;
    const py = this.y + this.h - cam.y; // 발 기준

    ctx.fillStyle = '#ffcc4d';
    ctx.fillRect(px - w / 2, py - h, w, h);
    // 눈 (바라보는 방향 표시)
    ctx.fillStyle = '#222';
    const eyeX = px + this.facing * w * 0.18;
    ctx.fillRect(eyeX - 2, py - h * 0.72, 4, 6);
    ctx.fillRect(eyeX + this.facing * 7 - 2, py - h * 0.72, 4, 6);
  }
}

function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  return Math.max(value - delta, target);
}
