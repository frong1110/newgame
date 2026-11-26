import { Input } from './input.js';
import { SPECIAL_KEY, ATTACK_KEY, DASH_KEYS } from './controls.js';
import { overlapsSolid } from './physics.js';

// 투척 갈래 3단계 철퇴 폭풍 (player.flail). 당기기(C)를 탭하면 기존 당기기, 길게 누르면(stormHoldThreshold) 회전:
//   사슬이 플레이어 둘레를 돌며 닿는 적(stormGrabReach 타원 안, 최대 stormMaxHeld 마리)을 모두 붙잡아 같이 돌린다.
//   C 를 놓으면 방향 입력대로 한꺼번에 날린다:
//     앞(기본): 전방으로 날려 부딪힌 적에게 피해, 벽·맵 끝에 닿으면 폭발(주변 피해)과 기절
//     ↑: 위로 띄움(공중 상태 → 내리찍기 콤보로 이어짐)   ↓: 바로 내리찍어 충격파(바닥 폭발)
//   회전 중 공격·대시 키 또는 피격이면 취소(붙잡은 적은 떨어짐). 같이 날린 적끼리는 서로 피해를 주지 않는다(group).
//   보스 본체처럼 붙잡을 수 없는 적은 enemy.grabbable = false. 수치는 player.json pullChain.storm*
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

export class FlailStorm {
  constructor() {
    this.seq = 0;
    this.hitstop = 0;
    this.reset();
  }

  reset() {
    this.pending = null; // C 를 누른 직후 탭/홀드를 가리는 중: { t, inputDir, inputY }
    this.phase = null; // null | 'spin'
    this.held = []; // 붙잡은 적: { e, ang, r, lastX, lastY }
    this.angle = 0; // 사슬이 돌아가는 각도
    this.timer = 0;
    this.lift = 0; // 궤도 전체를 위로 띄운 정도 (땅에 닿지 않게)
  }

  get active() {
    return this.phase === 'spin';
  }

  takeHitstop() {
    const h = this.hitstop;
    this.hitstop = 0;
    return h;
  }

  press(inputDir, inputY) {
    this.pending = { t: 0, inputDir, inputY };
  }

  // 회전 취소 (피격·대시·공격 키·무기 바꾸기): 붙잡은 적은 떨어진다
  cancel(stun = 0) {
    for (const h of this.held) {
      h.e.held = false;
      if (h.e.alive) h.e.stunTimer = Math.max(h.e.stunTimer, stun);
    }
    this.reset();
  }

  update(dt, p, world, enemies, stunned) {
    const C = p.stats.pullChain;
    if (!C.stormEnabled || !p.usesChainWeapon || stunned) {
      if (this.pending || this.active) this.cancel(C.stormCancelStun);
      return;
    }
    const down = Input.isDown(SPECIAL_KEY);
    if (this.pending) {
      this.pending.t += dt;
      if (!down) {
        const { inputDir, inputY } = this.pending; // 탭: 기존 당기기
        this.pending = null;
        if (!p.pullChain.active && !p.chain.locksPlayer) p.beginPull(inputDir, inputY);
      } else if (this.pending.t >= C.stormHoldThreshold) {
        this.pending = null;
        this.begin(p);
      }
    }
    if (this.active) this.updateSpin(dt, p, world, enemies, C, down);
  }

  begin(p) {
    this.phase = 'spin';
    this.held = [];
    this.angle = p.facing > 0 ? 0 : Math.PI; // 앞에서 시작해 위 → 뒤 → 아래로 돈다
    this.timer = 0;
    this.lift = 0;
  }

  updateSpin(dt, p, world, enemies, C, down) {
    if (Input.wasPressed(ATTACK_KEY) || DASH_KEYS.some((k) => Input.wasPressed(k))) return this.finish(p, C, 'cancel');
    p.vx = 0;
    p.vy = 0;
    p.dodgeTimer = Math.max(p.dodgeTimer, dt * 2);
    this.timer += dt;
    const dAng = -p.facing * ((Math.PI * 2) / C.stormTime) * dt;
    this.angle += dAng;
    const [cx, cy0] = center(p);

    // 궤도 맨 아래가 땅에 닿으면 궤도 전체를 부드럽게 들어 올린다
    let need = 0;
    const probe = { x: cx - p.w / 2, y: 0, w: p.w, h: p.h };
    while (need < C.stormGroundLift) {
      probe.y = cy0 - need + C.stormRadius * C.stormScaleY - p.h / 2;
      if (!overlapsSolid(probe, world)) break;
      need += 2;
    }
    this.lift += Math.sign(need - this.lift) * Math.min(Math.abs(need - this.lift), C.stormLiftSpeed * dt);
    const cy = cy0 - this.lift;

    // 닿는 적을 붙잡는다
    this.held = this.held.filter((h) => h.e.alive);
    for (const e of enemies) {
      if (this.held.length >= C.stormMaxHeld) break;
      if (!e.alive || e.held || e.grabbable === false) continue;
      const [ex, ey] = center(e);
      const dx = ex - cx, dy = ey - cy0;
      if ((dx / C.stormGrabReachX) ** 2 + (dy / C.stormGrabReachY) ** 2 > 1) continue;
      e.pull = null;
      e.flight = null;
      e.push = null;
      e.release();
      e.held = true;
      e.takeHit(C.stormDamage * p.chainDamage, Math.sign(dx) || p.facing, 0, 0, `flail${this.seq}-grab-${this.held.length}-${this.timer.toFixed(3)}`);
      const r = Math.max(35, Math.min(C.stormRadius, Math.hypot(dx, dy / C.stormScaleY)));
      this.held.push({ e, ang: Math.atan2(dy / C.stormScaleY, dx), r, lastX: e.x, lastY: e.y });
      this.hitstop = Math.max(this.hitstop, C.stormHitstop);
    }

    // 붙잡은 적을 궤도 위로 돌린다 (땅에 파묻히면 올리고, 안 되면 직전 위치)
    for (const h of this.held) {
      const e = h.e;
      h.ang += dAng;
      e.x = cx + Math.cos(h.ang) * h.r - e.w / 2;
      e.y = cy + Math.sin(h.ang) * h.r * C.stormScaleY - e.h / 2;
      let lifted = 0;
      while (lifted < C.stormGroundLift && overlapsSolid(e, world)) {
        e.y -= 2;
        lifted += 2;
      }
      if (overlapsSolid(e, world)) {
        e.x = h.lastX;
        e.y = h.lastY;
      }
      h.lastX = e.x;
      h.lastY = e.y;
    }
    if (!down || this.timer >= C.stormMaxTime) this.finish(p, C, 'release');
  }

  finish(p, C, how) {
    if (how === 'cancel') {
      this.cancel(C.stormCancelStun);
    } else this.release(p, C);
    p.specialCooldownTimer = C.stormCooldown; // 쿨타임 슬롯 (값은 이후 추가)
  }

  // 놓음: 입력 방향(↑ 위 / ↓ 아래 / 그 외 앞)으로 붙잡은 적 전부를 한 번에 날린다
  release(p, C) {
    const mode = Input.isDown('ArrowUp') ? 'up' : Input.isDown('ArrowDown') ? 'down' : 'forward';
    const g = ++this.seq;
    const D = p.chainDamage; // 사슬 데미지 단위 (피해 수치는 이 값의 배수)
    const blast = (wall, land, selfDamage, stun) => ({
      wall, land, selfDamage: selfDamage * D, stun, radius: C.stormBlastRadius, damage: C.stormBlastDamage * D,
      knockX: C.stormBlastKnockbackX, knockY: C.stormBlastKnockbackY,
      shake: C.stormBlastShake, shakeTime: C.stormBlastShakeTime, waveTime: C.stormBlastWaveTime, hitstop: C.stormHitstop,
    });
    this.held.forEach(({ e }, i) => {
      e.held = false;
      const hitId = `flail${g}-${i}`;
      if (mode === 'up') {
        e.takeHit(C.launchSelfDamage * D, p.facing, 0, 0, hitId);
        e.launch(C.launchHeight, C.launchHangTime, C.launchGravity);
      } else if (mode === 'down') {
        e.flight = { kind: 'throw', damage: 0, hitId, hangLeft: 0, group: g, ignoreWall: true, blast: blast(false, true, C.stormDownDamage, C.stormDownStun) };
        e.vx = 0;
        e.vy = C.stormDownSpeed;
      } else {
        e.flight = {
          kind: 'throw', damage: C.stormForwardDamage * D, knockbackX: C.stormForwardKnockbackX, knockbackY: C.stormForwardKnockbackY,
          hitstop: C.stormHitstop, hitId, hangLeft: 0, gravity: C.stormForwardGravity, group: g,
          blast: blast(true, false, C.stormWallDamage, C.stormWallStun),
        };
        e.vx = p.facing * C.stormForwardSpeedX;
        e.vy = -C.stormForwardSpeedY;
        e.dir = p.facing;
      }
    });
    this.hitstop = Math.max(this.hitstop, this.held.length ? C.stormHitstop : 0);
    this.reset();
  }

  draw(ctx, cam, p) {
    const C = p.stats.pullChain;
    const [cx0, cy0] = center(p);
    if (this.pending) {
      // 홀드 판정 중: 머리 위 작은 막대
      const k = Math.min(1, this.pending.t / C.stormHoldThreshold);
      ctx.fillStyle = '#9aa7b8';
      ctx.fillRect(cx0 - cam.x - 12, cy0 - cam.y - p.h, 24 * k, 3);
    }
    if (!this.active) return;
    const cx = cx0 - cam.x, cy = cy0 - this.lift - cam.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, C.stormRadius, C.stormRadius * C.stormScaleY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#9aa7b8';
    ctx.lineWidth = 2;
    for (const { e } of this.held) {
      ctx.beginPath();
      ctx.moveTo(cx0 - cam.x, cy0 - cam.y);
      ctx.lineTo(e.x + e.w / 2 - cam.x, e.y + e.h / 2 - cam.y);
      ctx.stroke();
    }
    // 돌아가는 사슬 끝과 분동
    const wx = cx + Math.cos(this.angle) * C.stormRadius, wy = cy + Math.sin(this.angle) * C.stormRadius * C.stormScaleY;
    ctx.strokeStyle = '#e8eef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx0 - cam.x, cy0 - cam.y);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    ctx.fillStyle = '#5b6573';
    ctx.fillRect(wx - 6, wy - 6, 12, 12);
  }
}
