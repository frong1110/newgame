// 게임 진입점: 객체 생성, 고정 시간 간격 루프, 메뉴(스킬 트리·선택 창)와 방 진행, 카메라, 그리기 순서.
// 세부 처리는 각 모듈에 있다: combat.js(타격 판정), effects.js(이펙트·흔들림), bindChains.js(결박 갈래), hud.js(화면 글자)
import { GAME, LEVELS, PLAYER, SKILLS } from './data/index.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { SkillTree } from './skills.js';
import { drawChoicePanel, drawTreePanel, hitTestTree } from './skillUI.js';
import { setupTouchControls, setTouchPanelOpen } from './touch.js';
import { playSfx } from './audio.js';
import { Effects } from './effects.js';
import { resolveCombat } from './combat.js';
import { installBindHooks, updateTethers, drawBindChains } from './bindChains.js';
import { BindPull } from './bindPull.js';
import { Projectiles } from './projectiles.js';
import { drawHUD, drawVersion } from './hud.js';

const VERSION = __APP_VERSION__; // package.json 의 version (vite.config.js 에서 넣어 줌)
document.title = `newgame v${VERSION}`;
const canvas = document.getElementById('game');
const isTouch = setupTouchControls(); // 터치 기기(또는 ?touch=1)에서 화면 버튼 표시
const ctx = canvas.getContext('2d');

const world = new World(LEVELS.level1);
const skillTree = new SkillTree(PLAYER);
const player = new Player(world.spawn.x, world.spawn.y, skillTree.stats);
const enemies = world.enemySpawns.map((pos) => new Enemy('dummy', pos));
const cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
const effects = new Effects();
installBindHooks(player, enemies, effects);
const projectiles = new Projectiles(); // 분동 갈래 쳐내기 대상 (P 키로 테스트 발사)
player.projectiles = projectiles;


const STEP = GAME.fixedStep; // 고정 시간 간격 물리 (프레임레이트와 무관하게 같은 조작감)
let acc = 0;
let last = performance.now();
const hitstop = { t: 0 }; // 타격 순간 잠깐 멈추는 연출 (combat.js 가 갱신)
const bindPull = new BindPull(player, enemies, effects, hitstop); // 결박 갈래: 팽팽한 줄·끌어모으기
player.bindPull = bindPull;

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

// ---- 메뉴와 방 진행 ----

// 스킬 트리 화면 (테스트용): 클릭 또는 ↑↓ + Enter 로 배우기/해제, Q 로 무기 바꾸기
function updateTree() {
  const ids = skillTree.orderedIds();
  if (Input.wasPressed('ArrowDown') || Input.wasPressed('ArrowRight')) treeCursor = (treeCursor + 1) % ids.length;
  if (Input.wasPressed('ArrowUp') || Input.wasPressed('ArrowLeft')) treeCursor = (treeCursor + ids.length - 1) % ids.length;
  if (['Enter', 'Space', 'KeyX'].some((k) => Input.wasPressed(k))) {
    skillTree.toggle(ids[treeCursor]);
    applySkills();
  }
  if (Input.wasPressed('KeyQ')) {
    // 테스트용 무기 바꾸기 (사슬 ↔ 검)
    skillTree.setWeapon(skillTree.weapon === 'chain' ? 'sword' : 'chain');
    player.attackTimer = 0;
    player.pullChain.cancel();
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
  projectiles.list = [];
  bindPull.state = null;
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

// ---- 한 프레임 진행 ----

function update(dt) {
  // 히트스톱 중에는 게임을 멈추되 입력은 지우지 않는다 (멈춘 사이 누른 키가 사라지지 않게)
  if (hitstop.t > 0) {
    hitstop.t -= dt;
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
  if (Input.wasPressed('KeyP')) projectiles.fireTest(player, enemies); // 테스트용 투사체
  bindPull.update(dt);
  projectiles.update(dt, player, enemies, world, hitstop);
  resolveCombat(player, enemies, effects, hitstop);
  updateRoomClear(dt);

  if (player.spawnPuff) {
    effects.addPuff(player.x + player.w / 2, player.y + player.h);
    player.spawnPuff = false;
  }
  updateTethers(player, enemies);
  effects.update(dt);

  // 구멍으로 떨어지면 리스폰
  if (player.y > world.pixelHeight + GAME.fallRespawnMargin) player.respawn(world.spawn.x, world.spawn.y);
  updateCamera(dt);

  Input.endFrame();
}

// 카메라: 플레이어를 부드럽게 따라감
function updateCamera(dt) {
  const targetX = player.x + player.w / 2 - cam.w / 2;
  const targetY = player.y + player.h / 2 - cam.h / 2;
  cam.x += (targetX - cam.x) * Math.min(1, GAME.cameraFollow * dt);
  cam.y += (targetY - cam.y) * Math.min(1, GAME.cameraFollow * dt);
  cam.x = clamp(cam.x, 0, Math.max(0, world.pixelWidth - cam.w));
  cam.y = clamp(cam.y, 0, Math.max(0, world.pixelHeight - cam.h));
}

// ---- 그리기 ----

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const [sx, sy] = effects.shakeOffset();
  const view = { x: Math.round(cam.x + sx), y: Math.round(cam.y + sy), w: cam.w, h: cam.h };
  world.draw(ctx, view);
  effects.drawUnder(ctx, view);
  for (const e of enemies) e.draw(ctx, view);
  drawBindChains(ctx, view, player, enemies, effects.transfers);
  bindPull.draw(ctx, view);
  projectiles.draw(ctx, view);
  player.draw(ctx, view);
  effects.drawOver(ctx, view);
  drawHUD(ctx, canvas, { player, enemies, skillTree, room, isTouch });
}

function renderOverlay() {
  if (isTouch) setTouchPanelOpen(mode !== 'play');
  if (mode === 'choice') drawChoicePanel(ctx, choices, selected, skillTree, room);
  else if (mode === 'tree') drawTreePanel(ctx, skillTree, skillTree.orderedIds()[treeCursor]);
}

let devPaused = false; // 개발 전용: 자동 테스트가 프레임을 직접 진행시킬 때 실시간 루프를 멈춘다

function frame(now) {
  acc += Math.min(GAME.maxFrameTime, (now - last) / 1000);
  last = now;
  if (devPaused) acc = 0;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  drawVersion(ctx, canvas, VERSION);
  renderOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 개발 서버에서만 디버깅/자동 테스트용으로 상태를 노출 (배포 빌드에는 포함되지 않음)
if (import.meta.env.DEV) {
  window.__game = {
    playSfx, player, enemies, world, skillTree, Input, projectiles, bindPull,
    get mode() { return mode; }, get room() { return room; }, get choices() { return choices; },
    get hitstop() { return hitstop.t; },
    // 자동 테스트용: 실시간 루프를 멈추고 고정 시간 간격으로 n 번 진행 (같은 입력이면 항상 같은 결과)
    pause(on = true) { devPaused = on; },
    tick(n = 1) { for (let i = 0; i < n; i++) update(STEP); },
  };
}
