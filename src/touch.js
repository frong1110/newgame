// 모바일 화면 버튼. 터치 기기에서만 보이고, PC 에서는 주소에 ?touch=1 을 붙이면 보인다.
// 각 버튼은 키보드와 같은 키 코드를 Input 에 넣으므로 게임 코드는 그대로 동작한다.
//   왼쪽: 방향 패드 (손가락 위치로 8방향 → ← → ↑ ↓)
//   오른쪽: 점프(Space) · 공격(X) · 당기기(C) · 대시(Shift)
//   위: 스킬 트리(K) · 처음부터(R) · 전체화면. 스킬 트리·선택 창이 열리면 패드·행동 버튼은 숨기고 무기 바꾸기(Q)를 보인다
import { Input } from './input.js';
import { GAME } from './data/index.js';

const T = GAME.touch;

// 스킬 트리·선택 창이 열려 있는지 알려 준다 (main.js 가 매 프레임 호출)
// 패드·버튼이 숨겨질 때 손가락을 떼면 pointerup 을 놓칠 수 있다 → 창이 열리는 순간 모든 화면 입력을 풀어 둔다
const resetters = [];
let panelOpen = false;
export function setTouchPanelOpen(open) {
  document.body.classList.toggle('panel-open', open);
  if (open && !panelOpen) resetters.forEach((fn) => fn());
  panelOpen = open;
}

export function setupTouchControls() {
  const forced = new URLSearchParams(location.search).has('touch');
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!forced && !touchDevice) return false;

  document.body.classList.add('touch');
  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <div class="dpad" data-dpad><div class="knob"></div></div>
    <div class="actions">
      <button class="btn special" data-key="KeyC">당기기</button>
      <button class="btn attack" data-key="KeyX">공격</button>
      <button class="btn dash" data-key="ShiftLeft">대시</button>
      <button class="btn jump" data-key="Space">점프</button>
    </div>
    <div class="topbar">
      <button class="small panel-only" data-key="KeyQ">무기 바꾸기</button>
      <button class="small panel-only" data-key="KeyT">태그 페이지</button>
      <button class="small" data-key="KeyK">스킬</button>
      <button class="small" data-key="KeyR">처음부터</button>
      <button class="small" data-fullscreen>전체화면</button>
    </div>
    <div class="rotate">가로로 돌려 주세요</div>`;
  document.body.appendChild(root);

  // 버튼: 누르는 동안 키를 누른 상태로 둔다 (손가락마다 따로 추적)
  for (const btn of root.querySelectorAll('[data-key]')) {
    const code = btn.dataset.key;
    let btnPointer = null;
    const down = (e) => {
      e.preventDefault();
      btnPointer = e.pointerId;
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('on');
      Input.pressVirtual(code);
      navigator.vibrate?.(T.vibrateMs);
    };
    const up = (e) => {
      e.preventDefault?.();
      btnPointer = null;
      btn.classList.remove('on');
      Input.releaseVirtual(code);
    };
    resetters.push(() => up({}));
    // 버튼 밖에서 손가락을 떼거나 버튼이 가려져 신호를 놓쳐도 풀리게 (같은 손가락의 pointerup/cancel 을 창 전체에서 받는다)
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, (e) => { if (e.pointerId === btnPointer) up({}); });
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  }

  setupDpad(root.querySelector('[data-dpad]'));

  root.querySelector('[data-fullscreen]').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    } catch {
      // 전체화면·가로 고정을 지원하지 않는 브라우저 (iOS Safari 등)
    }
  });

  // 길게 눌러서 메뉴가 뜨거나 화면이 확대되지 않게
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  return true;
}

// 방향 패드: 패드 중심에서 손가락까지의 방향으로 ←→↑↓ 를 누른다 (대각선이면 두 개)
function setupDpad(pad) {
  const knob = pad.querySelector('.knob');
  const DIRS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  let pointer = null;

  // 누름 상태는 Input 쪽(virtualDown)을 기준으로 본다 — 창이 포커스를 잃어 Input 이 지워져도 패드가 '이미 누름'으로 착각하지 않게
  const set = (codes) => {
    for (const c of DIRS) {
      if (codes.has(c) && !Input.isVirtualDown(c)) Input.pressVirtual(c);
      else if (!codes.has(c) && Input.isVirtualDown(c)) Input.releaseVirtual(c);
    }
  };

  const move = (e) => {
    const r = pad.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    knob.style.transform = `translate(${dx * radius * 0.45}px, ${dy * radius * 0.45}px)`;
    const codes = new Set();
    if (len >= T.dpadDeadZone) {
      const nx = dx / Math.max(len, 1e-6), ny = dy / Math.max(len, 1e-6);
      if (nx > T.dpadDiagonal) codes.add('ArrowRight');
      if (nx < -T.dpadDiagonal) codes.add('ArrowLeft');
      if (ny < -T.dpadDiagonal) codes.add('ArrowUp');
      if (ny > T.dpadDiagonal) codes.add('ArrowDown');
    }
    set(codes);
  };

  const reset = () => {
    pointer = null;
    knob.style.transform = '';
    set(new Set());
  };
  const end = (e) => {
    if (e.pointerId !== pointer) return;
    reset();
  };
  resetters.push(reset);
  // 패드가 가려진 사이 손가락을 떼는 등 pointerup 을 놓쳐도 풀리게, 창 전체에서도 받는다. 창이 가려지면 모두 해제
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, end);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // 이전 손가락이 아직 남아 있는 것으로 기억돼 있어도(신호 유실) 새 터치를 받는다
    pointer = e.pointerId;
    pad.setPointerCapture?.(e.pointerId);
    move(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (pointer === null && e.buttons) pointer = e.pointerId; // 손가락은 아직 패드 위인데 상태가 풀려 있었다면(blur 등) 다시 이어받는다
    if (e.pointerId === pointer) move(e);
  });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
}
