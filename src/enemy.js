// 테스트용 적. 좌우로 순찰하다가 벽이나 낭떠러지에서 돌아선다.
// 맞으면 넉백·경직, 체력이 0이 되면 사라진다. (respawnTime > 0 이면 그 시간 뒤 다시 나타남)
import { ENEMIES, GAME } from './data/index.js';
import { moveAndCollide, approach } from './physics.js';

export class Enemy {
  // 묶인 적 관련 알림 (main.js 가 연결·사슬 감옥 스킬을 처리하려고 채워 넣는다)
  //   onBoundDamaged(enemy, damage): 묶인 적이 피해를 받음
  //   onBoundDied(enemy): 묶인 적이 죽음
  static hooks = { onBoundDied: null };

  constructor(type, spawn) {
    this.type = type;
    this.stats = ENEMIES[type];
    this.spawn = spawn;
    this.w = this.stats.width;
    this.h = this.stats.height;
    this.reset();
  }

  reset() {
    this.x = this.spawn.x + (GAME.tileSize - this.w) / 2;
    this.y = this.spawn.y + (GAME.tileSize - this.h);
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.hp = this.stats.maxHp;
    this.alive = true;
    this.stunTimer = 0;
    this.flashTimer = 0;
    this.respawnTimer = 0;
    this.lastHitId = -1; // 같은 공격에 여러 번 맞지 않도록
    this.pull = null; // 사슬에 끌려오는 중이면 { x, y, speed } (목표 지점)
    this.bindTimer = 0; // 사슬에 묶여(속박) 움직이지 못하는 남은 시간 (감기 스킬)
    this.chainTimer = 0; // 사슬이 이어져 있는 남은 시간 (속박보다 길 수 있음). 이어진 동안은 팽팽한 줄·끌어모으기·감옥 전이 대상
    this.chainTotal = 1;
    this.bindAnchor = null; // 묶은 사슬이 이어진 곳: 'player'(감기) 또는 { x, y }(사슬 감옥: 옮겨 오기 전 적이 죽은 자리)
    // 공중 상태: 던져지거나(throw) 띄워져서(launch) 날아가는 중이면 { kind, damage, knockbackX, knockbackY, hitstop, hitId, hangLeft }
    // 머리 위에 '공중' 표시가 붙고, 내리찍기 스킬의 대상이 된다
    this.flight = null;
    this.held = false; // 철퇴 폭풍으로 붙잡혀 돌려지고 있으면 true (위치는 flailStorm.js 가 정함)
    this.blast = null; // 날려진 뒤 벽·바닥에 닿아 터질 폭발 정보 (combat.js 가 한 번 처리)
    this.grabbable = true; // false 면 철퇴 폭풍이 붙잡지 못함 (보스 본체 등)
    this.push = null; // 정해진 x 까지 미끄러지듯 밀려나는 중이면 { x, speed, stun } (내리꽂기)
  }

  update(dt, world) {
    const S = this.stats;
    if (!this.alive) {
      // respawnTime 이 0 이면 다시 나타나지 않음 (방 클리어 방식)
      if (S.respawnTime > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.reset();
      }
      return;
    }

    this.flashTimer -= dt;
    if (this.held) {
      // 철퇴 폭풍: 사슬 끝에 매달려 돌아가는 중. 위치는 chain.js 가 정한다
      this.vx = 0;
      this.vy = 0;
      this.stunTimer = Math.max(this.stunTimer, dt * 2);
      return;
    }
    if (this.pull) {
      // 사슬에 끌려오는 중: 중력·순찰 무시하고 목표 지점으로 직진
      const dx = this.pull.x - (this.x + this.w / 2);
      const dy = this.pull.y - (this.y + this.h / 2);
      const d = Math.hypot(dx, dy) || 1;
      const step = Math.min(this.pull.speed * dt, d);
      this.vx = (dx / d) * (step / dt);
      this.vy = (dy / d) * (step / dt);
      this.stunTimer = Math.max(this.stunTimer, dt * 2); // 끌려오는 동안은 몸통 피해 없음
      moveAndCollide(this, world, dt);
      return;
    }
    if (this.push) {
      // 밀려나기: 목표 x 까지 일정 속도로 미끄러진 뒤 경직 (벽에 막히면 그 자리에서 멈춤)
      const dx = this.push.x - this.x;
      const step = Math.min(this.push.speed * dt, Math.abs(dx));
      this.vx = Math.sign(dx) * (step / dt);
      this.vy = Math.min(this.vy + S.gravity * dt, S.maxFallSpeed);
      this.stunTimer = Math.max(this.stunTimer, dt * 2);
      moveAndCollide(this, world, dt);
      if (Math.abs(this.push.x - this.x) < 0.5 || this.hitWall) {
        this.stunTimer = Math.max(this.stunTimer, this.push.stun);
        this.vx = 0;
        this.push = null;
      }
      if (this.y > world.pixelHeight + GAME.fallRespawnMargin) this.die();
      return;
    }
    if (this.flight) {
      // 공중 상태: 순찰 없이 날아감. 띄워진 적은 꼭대기에서 hangLeft 동안 머문 뒤 떨어진다
      // 땅에 닿으면(던져진 적은 벽에 닿아도) 공중 상태가 끝나고 경직 (다른 적과의 충돌은 main.js)
      const F = this.flight;
      const hovering = F.kind === 'launch' && this.vy >= 0 && F.hangLeft > 0;
      if (hovering) {
        F.hangLeft -= dt;
        this.vx = 0;
        this.vy = 0;
      } else {
        this.vy = Math.min(this.vy + (F.gravity ?? S.thrownGravity) * dt, S.maxFallSpeed);
      }
      this.stunTimer = Math.max(this.stunTimer, dt * 2);
      moveAndCollide(this, world, dt);
      const landed = this.onGround && this.vy >= 0;
      const wall = F.kind === 'throw' && this.hitWall && !F.ignoreWall;
      if (landed || wall) {
        // 철퇴 폭풍으로 날려졌다면 벽(wall)·바닥(land)에 닿는 순간 폭발 (combat.js 가 처리)
        const B = F.blast && ((wall && F.blast.wall) || (landed && F.blast.land)) ? F.blast : null;
        if (B) this.blast = { ...B, group: F.group, x: this.x + this.w / 2, y: this.y + this.h };
        this.flight = null;
        this.vx = 0;
        this.stunTimer = Math.max(this.stunTimer, B ? B.stun : S.stunTime);
      }
      if (this.y > world.pixelHeight + GAME.fallRespawnMargin) this.die();
      return;
    }
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.release(); // 사슬이 풀림
    }
    if (this.bindTimer > 0) {
      // 속박: 제자리에 묶임 (몸통 피해도 없음)
      this.bindTimer -= dt;
      this.stunTimer = Math.max(this.stunTimer, dt * 2);
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vx = this.bindTimer > 0 ? 0 : approach(this.vx, 0, S.knockbackDecel * dt);
    } else {
      this.vx = this.dir * S.moveSpeed;
    }

    this.vy = Math.min(this.vy + S.gravity * dt, S.maxFallSpeed);
    moveAndCollide(this, world, dt);

    if (this.stunTimer <= 0 && this.onGround) {
      if (this.hitWall || !this.groundAhead(world)) this.dir *= -1;
    }

    if (this.y > world.pixelHeight + GAME.fallRespawnMargin) this.die();
  }

  // 진행 방향 발밑 앞쪽에 땅이 있는지
  groundAhead(world) {
    const T = GAME.tileSize;
    const footX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return world.isSolid(Math.floor(footX / T), Math.floor((this.y + this.h + 1) / T));
  }

  // 회전 투척: dir 쪽으로 포물선을 그리며 날아간다. C = 던진 사슬의 수치
  throwAway(dir, C, hitId) {
    if (!this.alive) return;
    this.release();
    this.vx = dir * C.throwSpeedX;
    this.vy = -C.throwSpeedY;
    this.flight = {
      kind: 'throw',
      damage: C.throwDamage,
      knockbackX: C.throwKnockbackX,
      knockbackY: C.throwKnockbackY,
      hitstop: C.throwHitstop,
      hitId: `${hitId}-thrown`,
      hangLeft: 0,
    };
  }

  // 위로 띄우기: height(px) 만큼 솟아올라 꼭대기에서 hang 초 머문 뒤 떨어진다 (다른 적에게 부딪혀도 피해 없음)
  // gravity: 오르내리는 중력 (높이는 그대로, 클수록 빨리 솟고 빨리 떨어짐), vx: 올라가는 동안 옆으로 밀리는 속도
  launch(height, hang, gravity, vx = 0) {
    if (!this.alive) return;
    this.release();
    this.vx = vx; // 올라가는 동안 옆으로 밀리는 속도 (꼭대기에서는 멈춤)
    this.vy = -Math.sqrt(2 * gravity * height);
    this.flight = { kind: 'launch', damage: 0, hangLeft: hang, gravity };
  }

  get airborne() {
    return this.alive && this.flight !== null;
  }

  // x(왼쪽 끝) 까지 time 초 동안 밀려난 뒤 stun 초 경직. 묶인 적은 밀리지 않는다
  pushTo(x, time, stun) {
    if (!this.alive || this.bindTimer > 0) return;
    this.push = { x, speed: Math.abs(x - this.x) / Math.max(time, 1e-3), stun };
    this.vx = 0;
    this.vy = 0;
  }

  // 속박: 그 자리에 묶는다. 넉백으로 튕겨 나가지 않게 속도를 없앤다
  // time: 속박(제자리 고정) 시간, chainTime: 사슬이 이어져 있는 시간 (기본은 속박과 같음, 속박보다 짧을 수 없음)
  bind(time, anchor = null, chainTime = time) {
    if (!this.alive) return;
    if (anchor) this.bindAnchor = anchor;
    this.bindTimer = Math.max(this.bindTimer, time);
    this.bindTotal = this.bindTimer;
    this.chainTimer = Math.max(this.chainTimer, time, chainTime);
    this.chainTotal = this.chainTimer;
    this.vx = 0;
    this.vy = Math.max(this.vy, 0);
  }

  takeHit(damage, fromDir, knockX, knockY, hitId) {
    if (!this.alive || hitId === this.lastHitId) return false;
    this.lastHitId = hitId;
    this.hp -= damage;
    this.vx = fromDir * knockX;
    this.vy = -knockY;
    this.stunTimer = this.stats.stunTime;
    this.flashTimer = this.stats.hitFlashTime;
    this.dir = -fromDir; // 때린 쪽을 바라보게
    if (this.bindTimer > 0) {
      // 묶인 적은 맞아도 밀려나지 않는다
      this.vx = 0;
      this.vy = Math.max(this.vy, 0);
    }
    if (this.hp <= 0) this.die();
    return true;
  }

  // 연결 스킬로 나눠 받는 피해 (넉백·경직 없음, 다시 나눠 주지 않음)
  takeShare(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flashTimer = this.stats.hitFlashTime;
    if (this.hp <= 0) this.die();
  }

  // 속박 풀기 (사슬이 끊어짐)
  release() {
    this.bindTimer = 0;
    this.chainTimer = 0;
    this.bindAnchor = null;
  }

  die() {
    if (!this.alive) return;
    const wasBound = this.chainTimer > 0;
    this.alive = false;
    this.release();
    this.respawnTimer = this.stats.respawnTime;
    if (wasBound) Enemy.hooks.onBoundDied?.(this); // 사슬 감옥
  }

  draw(ctx, cam) {
    if (!this.alive) return;
    const px = Math.round(this.x - cam.x);
    const py = Math.round(this.y - cam.y);
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : this.bindTimer > 0 ? '#7d5a8c' : '#c0392b';
    ctx.fillRect(px, py, this.w, this.h);
    // 눈
    ctx.fillStyle = '#111';
    const eyeX = px + this.w / 2 + this.dir * 5;
    ctx.fillRect(eyeX - 5, py + 8, 4, 5);
    ctx.fillRect(eyeX + 2, py + 8, 4, 5);
    // 속박: 몸에 X 자로 감긴 사슬 + 남은 시간 막대
    if (this.bindTimer > 0) {
      ctx.strokeStyle = '#e8eef5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 1);
      ctx.lineTo(px + this.w + 3, py + this.h + 1);
      ctx.moveTo(px + this.w + 3, py - 1);
      ctx.lineTo(px - 3, py + this.h + 1);
      ctx.moveTo(px - 3, py + this.h / 2);
      ctx.lineTo(px + this.w + 3, py + this.h / 2);
      ctx.stroke();
      ctx.fillStyle = '#e8eef5';
      ctx.fillRect(px, py + this.h + 3, this.w * Math.min(1, this.bindTimer / this.bindTotal), 3);
    }
    // 사슬이 이어져 있는 남은 시간 (속박이 풀린 뒤에도 유지): 가는 보라색 막대
    if (this.chainTimer > 0) {
      ctx.fillStyle = '#b58cff';
      ctx.fillRect(px, py + this.h + 7, this.w * Math.min(1, this.chainTimer / this.chainTotal), 2);
    }
    // 공중 상태 표시: 머리 위 하늘색 화살표 + 테두리
    if (this.flight) {
      ctx.strokeStyle = '#78d6ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 1.5, py - 1.5, this.w + 3, this.h + 3);
      ctx.fillStyle = '#78d6ff';
      const ax = px + this.w / 2, ay = py - 22;
      ctx.beginPath();
      ctx.moveTo(ax - 6, ay + 5);
      ctx.lineTo(ax + 6, ay + 5);
      ctx.lineTo(ax, ay - 3);
      ctx.closePath();
      ctx.fill();
    }
    // 체력 칸
    const pip = 6, gap = 2;
    const total = this.stats.maxHp * (pip + gap) - gap;
    for (let i = 0; i < this.stats.maxHp; i++) {
      ctx.fillStyle = i < this.hp ? '#2ecc71' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(px + this.w / 2 - total / 2 + i * (pip + gap), py - 9, pip, 4);
    }
  }
}
