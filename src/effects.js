// 화면 이펙트와 화면 흔들림. 게임 상태에는 영향을 주지 않고 보여 주기만 한다
//   puffs: 2단 점프 먼지, sparks + tipFlashes: 끝부분 적중, waves: 충격파,
//   transfers: 사슬 감옥이 옮겨 붙는 사슬, shake: 화면 흔들림
import { GAME } from './data/index.js';

export class Effects {
  constructor() {
    this.puffs = [];
    this.sparks = [];
    this.tipFlashes = [];
    this.waves = [];
    this.transfers = [];
    this.bolts = []; // 번개 연쇄 선
    this.shake = { time: 0, total: 0, mag: 0 };
  }

  addPuff(x, y) {
    this.puffs.push({ x, y, t: 0 });
  }

  // 끝부분 적중: 불꽃 + 번쩍임
  addTipHit(x, y) {
    this.sparks.push({ x, y, t: 0 });
    this.tipFlashes.push({ x, y, t: 0 });
  }

  // 충격(내리꽂기·내리찍기): 화면 흔들림 + 충격파
  addImpact(x, y, r, shakeMag, shakeTime, waveTime) {
    this.shake.time = this.shake.total = shakeTime;
    this.shake.mag = shakeMag;
    this.waves.push({ x, y, r, t: 0, total: waveTime });
  }

  addBolt(x0, y0, x1, y1) {
    this.bolts.push({ x0, y0, x1, y1, t: 0 });
  }

  addTransfer(x, y, e) {
    this.transfers.push({ x, y, e, t: 0 });
  }

  update(dt) {
    const age = (list, life) => {
      for (const it of list) it.t += dt;
      while (list.length && list[0].t > life(list[0])) list.shift();
    };
    age(this.puffs, () => GAME.puffDuration);
    age(this.transfers, () => GAME.chainTransferTime);
    age(this.bolts, () => 0.2);
    age(this.waves, (w) => w.total);
    this.shake.time -= dt;
    age(this.tipFlashes, () => GAME.tipFlashTime);
    age(this.sparks, () => GAME.sparkDuration);
  }

  // 화면 흔들림: 남은 시간에 비례해 약해지는 무작위 흔들림 (카메라 위치에 더함)
  shakeOffset() {
    const s = this.shake;
    const k = s.time > 0 ? s.time / s.total : 0;
    if (!k) return [0, 0];
    return [(Math.random() * 2 - 1) * s.mag * k, (Math.random() * 2 - 1) * s.mag * k];
  }

  // 캐릭터·적보다 아래에 그리는 것
  drawUnder(ctx, view) {
    for (const p of this.puffs) {
      const k = p.t / GAME.puffDuration;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x - view.x, p.y - view.y, 8 + 20 * k, 3 + 4 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 캐릭터·적보다 위에 그리는 것
  drawOver(ctx, view) {
    // 번개 연쇄: 두 적 사이를 잇는 지그재그 선
    for (const b of this.bolts) {
      ctx.strokeStyle = `rgba(255,236,120,${1 - b.t / 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x0 - view.x, b.y0 - view.y);
      for (let i = 1; i < 5; i++) {
        const k = i / 5;
        ctx.lineTo(b.x0 + (b.x1 - b.x0) * k - view.x + (i % 2 ? 7 : -7), b.y0 + (b.y1 - b.y0) * k - view.y + (i % 2 ? -5 : 5));
      }
      ctx.lineTo(b.x1 - view.x, b.y1 - view.y);
      ctx.stroke();
    }
    // 충격파: 착지 지점에서 좌우로 퍼지는 반원 + 먼지 선
    for (const w of this.waves) {
      const k = w.t / w.total;
      const r = w.r * (0.3 + 0.9 * k);
      ctx.strokeStyle = `rgba(255,230,160,${1 - k})`;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(w.x - view.x, w.y - view.y, r, r * 0.35, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
      ctx.fillRect(w.x - view.x - r, w.y - view.y - 3, r * 2, 3);
    }

    // 끝부분 적중 번쩍임: 짧게 밝아졌다 사라지는 흰 원
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.tipFlashes) {
      const k = f.t / GAME.tipFlashTime;
      const r = GAME.tipFlashRadius * (0.6 + 0.4 * k);
      const grad = ctx.createRadialGradient(f.x - view.x, f.y - view.y, 0, f.x - view.x, f.y - view.y, r);
      grad.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - k)})`);
      grad.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x - view.x, f.y - view.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 끝부분 적중: 노란 십자 불꽃
    for (const sp of this.sparks) {
      const k = sp.t / GAME.sparkDuration;
      const r = 6 + 16 * k;
      ctx.strokeStyle = `rgba(255,214,90,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 4) * (2 * i + 1);
        ctx.moveTo(sp.x - view.x + Math.cos(a) * r * 0.3, sp.y - view.y + Math.sin(a) * r * 0.3);
        ctx.lineTo(sp.x - view.x + Math.cos(a) * r, sp.y - view.y + Math.sin(a) * r);
      }
      ctx.stroke();
    }
  }
}
