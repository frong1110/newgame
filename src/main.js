import { GAME, LEVELS, PLAYER, SKILLS } from './data/index.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { overlaps } from './physics.js';
import { SkillTree } from './skills.js';
import { drawChoicePanel, drawTreePanel, hitTestTree } from './skillUI.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(LEVELS.level1);
const skillTree = new SkillTree(PLAYER);
const player = new Player(world.spawn.x, world.spawn.y, skillTree.stats);
const enemies = world.enemySpawns.map((pos) => new Enemy('dummy', pos));
const cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
const puffs = []; // 2단 점프 이펙트

const STEP = GAME.fixedStep; // 고정 시간 간격 물리 (프레임레이트와 무관하게 같은 조작감)
let acc = 0;
let last = performance.now();
let hitstopTimer = 0; // 타격 순간 잠깐 멈추는 연출

// 게임 모드: 'play' | 'choice'(방 클리어 후 스킬 고르기) | 'tree'(스킬 트리 보기)
let mode = 'play';
let room = 1;
let clearTimer = -1; // 적을 모두 처치한 뒤 선택 창이 뜨기까지 남은 시간
let choices = [];
let selected = 0;
let treeCursor = 0; // 스킬 트리 화면에서 키보드로 고른 스킬 순서
let pendingClick = null; // 캔버스 좌표로 바꾼 마우스 클릭

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  pendingClick = { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
});

function applySkills() {
  player.stats = skillTree.stats;
}

// 스킬 트리 화면 (테스트용): 클릭 또는 ↑↓ + Enter 로 배우기/해제
function updateTree() {
  const ids = skillTree.orderedIds();
  if (Input.wasPressed('ArrowDown') || Input.wasPressed('ArrowRight')) treeCursor = (treeCursor + 1) % ids.length;
  if (Input.wasPressed('ArrowUp') || Input.wasPressed('ArrowLeft')) treeCursor = (treeCursor + ids.length - 1) % ids.length;
  if (['Enter', 'Space', 'KeyX'].some((k) => Input.wasPressed(k))) {
    skillTree.toggle(ids[treeCursor]);
    applySkills();
  }
  if (pendingClick) {
    const id = hitTestTree(skillTree, pendingClick.x, pendingClick.y);
    if (id) {
      treeCursor = ids.indexOf(id);
      skillTree.toggle(id);
      applySkills();
    }
  }
  pendingClick = null;
}

// 한 판 초기화 (죽음 대신 R). 스킬도 모두 사라진다
function resetRun() {
  skillTree.reset();
  applySkills();
  player.respawn(world.spawn.x, world.spawn.y);
  enemies.forEach((e) => e.reset());
  room = 1;
  clearTimer = -1;
  mode = 'play';
}

function nextRoom() {
  room++;
  enemies.forEach((e) => e.reset());
  mode = 'play';
}

function pickSkill(i) {
  const s = choices[i];
  if (!s) return;
  skillTree.learn(s.id);
  applySkills();
  nextRoom();
}

function updateChoice() {
  for (let i = 0; i < choices.length; i++) if (Input.wasPressed(`Digit${i + 1}`)) return pickSkill(i);
  if (Input.wasPressed('ArrowLeft')) selected = (selected + choices.length - 1) % choices.length;
  if (Input.wasPressed('ArrowRight')) selected = (selected + 1) % choices.length;
  if (['Enter', 'Space', 'KeyX'].some((k) => Input.wasPressed(k))) pickSkill(selected);
}

function updateRoomClear(dt) {
  if (clearTimer < 0) {
    if (enemies.every((e) => !e.alive)) clearTimer = SKILLS.roomClearDelay;
    return;
  }
  clearTimer -= dt;
  if (clearTimer > 0) return;
  clearTimer = -1;
  // 프로토타입에서는 스킬을 트리 화면(K)에서 직접 고르므로 선택 창을 끌 수 있다 (skills.json pickOnRoomClear)
  if (!SKILLS.pickOnRoomClear) return nextRoom();
  choices = skillTree.randomChoices();
  selected = 0;
  if (choices.length) mode = 'choice';
  else nextRoom(); // 더 배울 스킬이 없으면 바로 다음 방
}

function update(dt) {
  // 히트스톱 중에는 게임을 멈추되 입력은 지우지 않는다 (멈춘 사이 누른 키가 사라지지 않게)
  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    return;
  }

  if (Input.wasPressed('KeyK') && mode !== 'choice') mode = mode === 'tree' ? 'play' : 'tree';
  if (mode === 'tree') {
    updateTree();
    return Input.endFrame();
  }
  pendingClick = null;
  if (mode === 'choice') {
    updateChoice();
    return Input.endFrame();
  }

  if (Input.wasPressed('KeyR')) resetRun();

  player.update(dt, world, enemies);
  for (const e of enemies) e.update(dt, world);
  resolveCombat();
  updateRoomClear(dt);

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
  const hitbox = player.getAttackHitbox();
  // 사슬로 적을 맞힌 경우
  const chainHitstop = player.chain.takeHitstop();
  if (chainHitstop > 0) hitstopTimer = chainHitstop;
  for (const e of enemies) {
    if (!e.alive) continue;
    // 플레이어 공격 → 적
    if (hitbox && overlaps(hitbox, e)) {
      if (e.takeHit(hitbox.damage, player.facing, hitbox.knockbackX, hitbox.knockbackY, player.attackId)) {
        hitstopTimer = hitbox.hitstop;
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
  ctx.fillText(`jumps: ${player.stats.maxJumps - player.jumpsUsed}/${player.stats.maxJumps}`, 12, 22);
  ctx.fillText(`ground: ${player.onGround}`, 12, 40);
  const comboLabel = player.attackTimer > 0 ? `${player.comboStep + 1}/${player.stats.attack.combo.length} ${player.step.name}` : '-';
  ctx.fillText(`combo: ${comboLabel}`, 12, 58);
  const dashReady = player.dashCooldownTimer <= 0 && (player.usesChain || player.onGround || player.airDashesUsed < player.stats.dash.maxAirDashes);
  ctx.fillText(`room: ${room}   enemies: ${enemies.filter((e) => e.alive).length}/${enemies.length}`, 12, 94);
  const owned = [...skillTree.owned].map((id) => skillTree.byId[id].name);
  ctx.textAlign = 'right';
  ctx.fillText('K: 스킬 트리', canvas.width - 12, 22);
  owned.forEach((name, i) => ctx.fillText(`· ${name}`, canvas.width - 12, 44 + i * 18));
  ctx.textAlign = 'left';
  ctx.fillText(`${player.usesChain ? 'chain' : 'dash'}: ${player.isDashing ? 'GO' : player.chain.active ? player.chain.phase : dashReady ? 'ready' : '...'}${player.dodgeTimer > 0 ? ' (무적)' : ''}`, 12, 76);
}

function renderOverlay() {
  if (mode === 'choice') drawChoicePanel(ctx, choices, selected, skillTree, room);
  else if (mode === 'tree') drawTreePanel(ctx, skillTree, skillTree.orderedIds()[treeCursor]);
}

function frame(now) {
  acc += Math.min(GAME.maxFrameTime, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  renderOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 개발 서버에서만 디버깅/자동 테스트용으로 상태를 노출 (배포 빌드에는 포함되지 않음)
if (import.meta.env.DEV) window.__game = { player, enemies, world, skillTree, get mode() { return mode; }, get room() { return room; }, get choices() { return choices; } };
