import { GAME, LEVELS, PLAYER, SKILLS } from './data/index.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { overlaps } from './physics.js';
import { SkillTree } from './skills.js';
import { drawChoicePanel, drawTreePanel, hitTestTree } from './skillUI.js';
import { setupTouchControls, setTouchPanelOpen } from './touch.js';
import { playSfx } from './audio.js';

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
const puffs = []; // 2단 점프 이펙트
const sparks = []; // 사슬 끝부분 적중 이펙트
const tipFlashes = []; // 끝부분 적중 번쩍임
const waves = []; // 내리꽂기 충격파 이펙트
const shake = { time: 0, total: 0, mag: 0 }; // 화면 흔들림
const transfers = []; // 사슬 감옥: 죽은 적 자리에서 주변 적으로 사슬이 뻗어 가는 이펙트

// ---- 결박 갈래 (감기 · 연결 · 사슬 감옥) ----
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const playerHand = () => [player.x + player.w / 2 + player.facing * player.stats.chainWeapon.pivotForward, player.y + player.h / 2];

// 연결: 묶인 적이 피해를 받으면 그 비율만큼 다른 묶인 적들도 받는다
Enemy.hooks.onBoundDamaged = (src, damage) => {
  const share = player.usesChainWeapon ? player.stats.chainWeapon.linkShare : 0;
  if (!(share > 0)) return;
  for (const e of enemies) {
    if (e !== src && e.alive && e.bindTimer > 0) e.takeShare(damage * share);
  }
};

// 사슬 감옥: 묶인 적이 죽으면 그 자리에서 prisonRange 안의 가까운 적들에게 사슬이 옮겨 붙는다
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
    transfers.push({ x: dx, y: dy, e, t: 0 });
  }
};

// 감기: 캐릭터와 이어진 사슬이 bindTetherRange 보다 멀어지면 끊어져 속박이 풀린다
function updateTethers() {
  const W = player.stats.chainWeapon;
  const [hx, hy] = playerHand();
  for (const e of enemies) {
    if (!e.alive || e.bindTimer <= 0 || e.bindAnchor !== 'player') continue;
    const [ex, ey] = center(e);
    if (!player.usesChainWeapon || Math.hypot(ex - hx, ey - hy) > W.bindTetherRange) e.release();
  }
}

// 사슬 한 줄 (고리 모양)
function drawChainLine(x0, y0, x1, y1, color, size = 3) {
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

// 묶인 적의 사슬: 캐릭터(감기) 또는 죽은 적 자리(사슬 감옥)에서 이어지고, 연결 스킬이면 묶인 적끼리도 잇는다
function drawBindChains(view) {
  const bound = enemies.filter((e) => e.alive && e.bindTimer > 0);
  const [hx, hy] = playerHand();
  for (const e of bound) {
    const [ex, ey] = center(e);
    if (e.bindAnchor === 'player') drawChainLine(hx - view.x, hy - view.y, ex - view.x, ey - view.y, '#cfd8e3');
    else if (e.bindAnchor && !transfers.some((tr) => tr.e === e)) {
      const a = e.bindAnchor;
      drawChainLine(a.x - view.x, a.y - view.y, ex - view.x, ey - view.y, '#b58cff');
      ctx.strokeStyle = '#b58cff';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x - view.x - 5, a.y - view.y - 5, 10, 10);
    }
  }
  if (player.usesChainWeapon && player.stats.chainWeapon.linkShare > 0 && bound.length > 1) {
    const sorted = [...bound].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const [x0, y0] = center(sorted[i - 1]), [x1, y1] = center(sorted[i]);
      drawChainLine(x0 - view.x, y0 - view.y, x1 - view.x, y1 - view.y, '#ffcc4d', 4);
    }
  }
  // 사슬 감옥: 옮겨 붙는 사슬이 죽은 자리에서 뻗어 나감
  for (const tr of transfers) {
    const k = Math.min(1, tr.t / GAME.chainTransferTime);
    const [ex, ey] = center(tr.e);
    drawChainLine(tr.x - view.x, tr.y - view.y, tr.x + (ex - tr.x) * k - view.x, tr.y + (ey - tr.y) * k - view.y, '#e8d4ff', 4);
  }
}

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
  updateTethers();
  for (const tr of transfers) tr.t += dt;
  while (transfers.length && transfers[0].t > GAME.chainTransferTime) transfers.shift();
  for (const w of waves) w.t += dt;
  while (waves.length && waves[0].t > waves[0].total) waves.shift();
  shake.time -= dt;
  for (const f of tipFlashes) f.t += dt;
  while (tipFlashes.length && tipFlashes[0].t > GAME.tipFlashTime) tipFlashes.shift();
  for (const s of sparks) s.t += dt;
  while (sparks.length && sparks[0].t > GAME.sparkDuration) sparks.shift();

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

// 내리꽂기: 몸쪽 ~ 분동이 떨어진 지점(left~right), 위로 height 안의 적에게 큰 피해
function addImpactEffects(x, y, r, shakeMag, shakeTime, waveTime) {
  shake.time = shake.total = shakeTime;
  shake.mag = shakeMag;
  waves.push({ x, y, r, t: 0, total: waveTime });
}

function resolveSlam() {
  // 사슬 무기 내리찍기 충격 (피해는 chain.js 에서 이미 처리)
  const ci = player.pullChain.takeImpact();
  if (ci) addImpactEffects(ci.x, ci.y, ci.r, ci.shake, ci.shakeTime, ci.waveTime);

  const s = player.takeSlamImpact();
  if (!s) return;
  const area = { x: s.left, y: s.y - s.height, w: s.right - s.left, h: s.height + 8 };
  for (const e of enemies) {
    if (!e.alive || !overlaps(area, e)) continue;
    // 밀어내는 방향은 플레이어 기준 (분동이 떨어진 곳 기준이면 플레이어 쪽으로 밀릴 수 있음)
    const dir = Math.sign(e.x + e.w / 2 - (player.x + player.w / 2)) || player.facing;
    if (!e.takeHit(s.damage, dir, s.knockbackX, s.knockbackY, s.hitId)) continue;
    // 사슬 무기면 휘두르기 끝부분 거리로 밀어낸다 (바로 X 로 끝부분 적중을 노릴 수 있게)
    if (s.pushToTip && player.usesChainWeapon) {
      const tx = player.tipRangeX(dir, e.w);
      if (dir > 0 ? tx > e.x : tx < e.x) e.pushTo(tx, s.pushTime, s.pushStun); // 바깥쪽으로만 민다
    }
  }
  hitstopTimer = Math.max(hitstopTimer, s.hitstop);
  shake.time = shake.total = s.shakeTime;
  shake.mag = s.shake;
  // 충격파는 맞는 범위 전체에 퍼지게 (몸쪽 ~ 분동)
  waves.push({ x: (s.left + s.right) / 2, y: s.y, r: (s.right - s.left) / 2, t: 0, total: s.waveTime });
}

function resolveCombat() {
  resolveSlam();
  // 사슬(대시·당기기)로 적을 맞힌 경우
  for (const c of [player.chain, player.pullChain]) {
    const h = c.takeHitstop();
    if (h > 0) hitstopTimer = Math.max(hitstopTimer, h);
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    // 플레이어 공격 → 적
    const hit = player.attackHitTest(e);
    if (hit && e.takeHit(hit.damage, player.facing, hit.knockbackX, hit.knockbackY, player.attackId)) {
      hitstopTimer = hit.hitstop;
      if (hit.tip) {
        sparks.push({ x: hit.point[0], y: hit.point[1], t: 0 });
        tipFlashes.push({ x: hit.point[0], y: hit.point[1], t: 0 });
        playSfx('tipHit');
        if (hit.bind > 0) e.bind(hit.bind, 'player'); // 감기: 캐릭터와 사슬로 이어 묶음
        if (hit.stun > 0) e.stunTimer = Math.max(e.stunTimer, hit.stun); // 분동 강타
      }
    }
    // 던져져 날아가는 적(공중 상태) → 다른 적 (회전 투척). 띄워진 적은 피해 없음
    if (e.flight && e.flight.damage > 0) {
      for (const other of enemies) {
        if (other === e || !other.alive || !overlaps(e, other)) continue;
        const T = e.flight;
        if (other.takeHit(T.damage, Math.sign(e.vx) || 1, T.knockbackX, T.knockbackY, T.hitId)) hitstopTimer = T.hitstop;
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
  // 화면 흔들림: 남은 시간에 비례해 약해지는 무작위 흔들림
  const k = shake.time > 0 ? shake.time / shake.total : 0;
  const sx = k ? (Math.random() * 2 - 1) * shake.mag * k : 0;
  const sy = k ? (Math.random() * 2 - 1) * shake.mag * k : 0;
  const view = { x: Math.round(cam.x + sx), y: Math.round(cam.y + sy), w: cam.w, h: cam.h };
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
  drawBindChains(view);
  player.draw(ctx, view);

  // 내리꽂기 충격파: 착지 지점에서 좌우로 퍼지는 반원 + 먼지 선
  for (const w of waves) {
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
  for (const f of tipFlashes) {
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
  for (const sp of sparks) {
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

  // 디버그 HUD
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px monospace';
  ctx.fillText(`jumps: ${player.stats.maxJumps - player.jumpsUsed}/${player.stats.maxJumps}`, 12, 22);
  ctx.fillText(`weapon: ${player.usesChainWeapon ? '사슬' : '검'}${player.usesChainWeapon ? `   당기기(C): ${player.pullChain.active ? player.pullChain.phase : player.specialCooldownTimer > 0 ? '...' : 'ready'}` : ''}`, 12, 40);
  const comboLabel = player.attackTimer > 0 ? `${player.comboStep + 1}/${player.stats.attack.combo.length} ${player.step.name}` : '-';
  ctx.fillText(`combo: ${comboLabel}`, 12, 58);
  const dashReady = player.dashCooldownTimer <= 0 && (player.usesChain || player.onGround || player.airDashesUsed < player.stats.dash.maxAirDashes);
  ctx.fillText(`room: ${room}   enemies: ${enemies.filter((e) => e.alive).length}/${enemies.length}`, 12, 94);
  const owned = [...skillTree.owned].map((id) => skillTree.byId[id].name);
  ctx.textAlign = 'right';
  // 터치 모드에서는 오른쪽 위에 버튼이 있으므로 안내 문구를 빼고 목록을 아래로 내린다
  if (!isTouch) ctx.fillText('K: 스킬 트리', canvas.width - 12, 22);
  const listTop = isTouch ? 90 : 44;
  owned.forEach((name, i) => ctx.fillText(`· ${name}`, canvas.width - 12, listTop + i * 18));
  ctx.textAlign = 'left';
  ctx.fillText(`${player.usesChain ? 'chain' : 'dash'}: ${player.isDashing ? 'GO' : player.chain.active ? player.chain.phase : dashReady ? 'ready' : '...'}${player.dodgeTimer > 0 ? ' (무적)' : ''}`, 12, 76);
}

// 버전 표시: 화면 위쪽 가운데 (모바일 버튼과 겹치지 않는 자리)
function drawVersion() {
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`v${VERSION}`, canvas.width / 2, 18);
  ctx.textAlign = 'left';
}

function renderOverlay() {
  if (isTouch) setTouchPanelOpen(mode !== 'play');
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
  drawVersion();
  renderOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 개발 서버에서만 디버깅/자동 테스트용으로 상태를 노출 (배포 빌드에는 포함되지 않음)
if (import.meta.env.DEV) window.__game = { playSfx, player, enemies, world, skillTree, get mode() { return mode; }, get room() { return room; }, get choices() { return choices; } };
