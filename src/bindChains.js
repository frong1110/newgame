// 사슬 무기 결박 갈래 (감기 · 팽팽한 줄 · 사슬 감옥) 의 판 전체 처리와 그리기
//   - 팽팽한 줄·끌어모으기 동작은 bindPull.js, 여기서는 사슬 선 그리기만 한다
//   - 사슬 감옥: 묶인 적이 죽으면 주변 적들에게 사슬이 옮겨 붙는다 (Enemy.hooks.onBoundDied)
//   - 감기: 캐릭터와 이어진 사슬이 너무 멀어지면 끊어진다 (updateTethers)
import { GAME } from './data/index.js';
import { Enemy } from './enemy.js';

const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const playerHand = (player) => [player.x + player.w / 2 + player.facing * player.stats.chainWeapon.pivotForward, player.y + player.h / 2];

export function installBindHooks(player, enemies, effects) {
  // 사슬 감옥: 그 자리에서 prisonRange 안의 가까운 적들에게 옮겨 붙는다
  Enemy.hooks.onBoundDied = (dead) => {
    const W = player.stats.chainWeapon;
    if (!player.usesChainWeapon || !W.prisonEnabled) return;
    const [dx, dy] = center(dead);
    const targets = enemies
      .filter((e) => e !== dead && e.alive && e.hp > 0)
      .map((e) => [e, Math.hypot(center(e)[0] - dx, center(e)[1] - dy)])
      .filter(([, d]) => d <= W.prisonRange)
      .sort((a, b) => a[1] - b[1])
      .slice(0, W.prisonMaxTargets)
      .map(([e]) => e);
    for (const e of targets) {
      e.bind(W.prisonBindTime, { x: dx, y: dy });
      e.vx = 0;
      effects.addTransfer(dx, dy, e);
    }
  };
}

// 감기: 새로 묶을 때 동시에 묶을 수 있는 수(bindMaxTargets)를 넘으면 남은 시간이 가장 짧은(가장 오래된) 적부터 풀린다
export function bindWithCap(player, enemies, target, time) {
  const bound = enemies.filter((e) => e !== target && e.alive && e.bindTimer > 0);
  while (bound.length >= player.stats.chainWeapon.bindMaxTargets) {
    const oldest = bound.reduce((a, b) => (a.bindTimer <= b.bindTimer ? a : b));
    oldest.release();
    bound.splice(bound.indexOf(oldest), 1);
  }
  target.bind(time, 'player');
}

// 감기: 캐릭터와 이어진 사슬이 bindTetherRange 보다 멀어지면 끊어져 속박이 풀린다
export function updateTethers(player, enemies) {
  const W = player.stats.chainWeapon;
  const [hx, hy] = playerHand(player);
  for (const e of enemies) {
    if (!e.alive || e.bindTimer <= 0 || e.bindAnchor !== 'player') continue;
    const [ex, ey] = center(e);
    if (!player.usesChainWeapon || Math.hypot(ex - hx, ey - hy) > W.bindTetherRange) e.release();
  }
}

// 사슬 한 줄 (고리 모양)
function drawChainLine(ctx, x0, y0, x1, y1, color, size = 3) {
  const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  for (let d = 4; d < len; d += 8) {
    const k = d / len;
    ctx.fillRect(x0 + (x1 - x0) * k - size / 2, y0 + (y1 - y0) * k - size / 2, size, size);
  }
}

// 묶인 적의 사슬: 캐릭터(감기) 또는 죽은 적 자리(사슬 감옥)에서 이어지고, 팽팽한 줄이면 묶인 적끼리도 잇는다
export function drawBindChains(ctx, view, player, enemies, transfers) {
  const bound = enemies.filter((e) => e.alive && e.bindTimer > 0);
  const [hx, hy] = playerHand(player);
  for (const e of bound) {
    const [ex, ey] = center(e);
    if (e.bindAnchor === 'player') drawChainLine(ctx, hx - view.x, hy - view.y, ex - view.x, ey - view.y, '#cfd8e3');
    else if (e.bindAnchor && !transfers.some((tr) => tr.e === e)) {
      const a = e.bindAnchor;
      drawChainLine(ctx, a.x - view.x, a.y - view.y, ex - view.x, ey - view.y, '#b58cff');
      ctx.strokeStyle = '#b58cff';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x - view.x - 5, a.y - view.y - 5, 10, 10);
    }
  }
  if (player.usesChainWeapon && player.stats.chainWeapon.tautEnabled && bound.length > 1) {
    const sorted = [...bound].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const [x0, y0] = center(sorted[i - 1]), [x1, y1] = center(sorted[i]);
      drawChainLine(ctx, x0 - view.x, y0 - view.y, x1 - view.x, y1 - view.y, '#ffcc4d', 4);
    }
  }
  // 사슬 감옥: 옮겨 붙는 사슬이 죽은 자리에서 뻗어 나감
  for (const tr of transfers) {
    const k = Math.min(1, tr.t / GAME.chainTransferTime);
    const [ex, ey] = center(tr.e);
    drawChainLine(ctx, tr.x - view.x, tr.y - view.y, tr.x + (ex - tr.x) * k - view.x, tr.y + (ey - tr.y) * k - view.y, '#e8d4ff', 4);
  }
}
