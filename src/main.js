import { GAME, LEVELS, PLAYER } from './data/index.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(LEVELS.level1);
const player = new Player(world.spawn.x, world.spawn.y);
const cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
const puffs = []; // 2단 점프 이펙트

const STEP = GAME.fixedStep; // 고정 시간 간격 물리 (프레임레이트와 무관하게 같은 조작감)
let acc = 0;
let last = performance.now();

function update(dt) {
  if (Input.wasPressed('KeyR')) player.respawn(world.spawn.x, world.spawn.y);

  player.update(dt, world);

  if (player.spawnPuff) {
    puffs.push({ x: player.x + player.w / 2, y: player.y + player.h, t: 0 });
    player.spawnPuff = false;
  }
  for (const p of puffs) p.t += dt;
  while (puffs.length && puffs[0].t > 0.3) puffs.shift();

  // 구멍으로 떨어지면 리스폰
  if (player.y > world.pixelHeight + GAME.fallRespawnMargin) player.respawn(world.spawn.x, world.spawn.y);

  // 카메라: 플레이어를 부드럽게 따라감
  const targetX = player.x + player.w / 2 - cam.w / 2;
  const targetY = player.y + player.h / 2 - cam.h / 2;
  cam.x += (targetX - cam.x) * Math.min(1, GAME.cameraFollow * dt);
  cam.y += (targetY - cam.y) * Math.min(1, GAME.cameraFollow * dt);
  cam.x = clamp(cam.x, 0, Math.max(0, world.pixelWidth - cam.w));
  cam.y = clamp(cam.y, 0, Math.max(0, world.pixelHeight - cam.h));

  Input.endFrame();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const view = { x: Math.round(cam.x), y: Math.round(cam.y), w: cam.w, h: cam.h };
  world.draw(ctx, view);

  for (const p of puffs) {
    const k = p.t / GAME.puffDuration;
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x - view.x, p.y - view.y, 8 + 20 * k, 3 + 4 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  player.draw(ctx, view);

  // 디버그 HUD
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px monospace';
  ctx.fillText(`jumps: ${PLAYER.maxJumps - player.jumpsUsed}/${PLAYER.maxJumps}`, 12, 22);
  ctx.fillText(`ground: ${player.onGround}`, 12, 40);
}

function frame(now) {
  acc += Math.min(GAME.maxFrameTime, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
