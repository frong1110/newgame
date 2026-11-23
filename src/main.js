import { GAME, LEVELS, PLAYER } from './data/index.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { overlaps } from './physics.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(LEVELS.level1);
const player = new Player(world.spawn.x, world.spawn.y);
const enemies = world.enemySpawns.map((pos) => new Enemy('dummy', pos));
const cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
const puffs = []; // 2단 점프 이펙트

const STEP = GAME.fixedStep; // 고정 시간 간격 물리 (프레임레이트와 무관하게 같은 조작감)
let acc = 0;
let last = performance.now();
let hitstopTimer = 0; // 타격 순간 잠깐 멈추는 연출

function update(dt) {
  // 히트스톱 중에는 게임을 멈추되 입력은 지우지 않는다 (멈춘 사이 누른 키가 사라지지 않게)
  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    return;
  }

  if (Input.wasPressed('KeyR')) {
    player.respawn(world.spawn.x, world.spawn.y);
    enemies.forEach((e) => e.reset());
  }

  player.update(dt, world);
  for (const e of enemies) e.update(dt, world);
  resolveCombat();

  if (player.spawnPuff) {
    puffs.push({ x: player.x + player.w / 2, y: player.y + player.h, t: 0 });
    player.spawnPuff = false;
  }
  for (const p of puffs) p.t += dt;
  while (puffs.length && puffs[0].t > GAME.puffDuration) puffs.shift();

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

function resolveCombat() {
  const A = PLAYER.attack;
  const hitbox = player.getAttackHitbox();
  for (const e of enemies) {
    if (!e.alive) continue;
    // 플레이어 공격 → 적
    if (hitbox && overlaps(hitbox, e)) {
      if (e.takeHit(A.damage, player.facing, A.knockbackX, A.knockbackY, player.attackId)) {
        hitstopTimer = A.hitstop;
      }
    }
    // 적 몸통 → 플레이어 (경직 중인 적은 공격 판정 없음)
    if (e.stunTimer <= 0 && overlaps(player, e)) {
      const fromDir = player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1;
      player.hurt(fromDir);
    }
  }
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

  for (const e of enemies) e.draw(ctx, view);
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

// 개발 서버에서만 디버깅/자동 테스트용으로 상태를 노출 (배포 빌드에는 포함되지 않음)
if (import.meta.env.DEV) window.__game = { player, enemies, world };
