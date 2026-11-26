// 모바일 화면 버튼. 터치 기기에서만 보이고, PC 에서는 주소에 ?touch=1 을 붙이면 보인다.
// 각 버튼은 키보드와 같은 키 코드를 Input 에 넣으므로 게임 코드는 그대로 동작한다.
//   왼쪽: 방향 패드 (손가락 위치로 8방향 → ← → ↑ ↓)
//   오른쪽: 점프(Space) · 공격(X) · 당기기(C) · 대시(Shift)
//   위: 스킬 트리(K) · 처음부터(R) · 전체화면. 스킬 트리·선택 창이 열리면 패드·행동 버튼은 숨기고 무기 바꾸기(Q)를 보인다
import { Input } from './input.js';
import { GAME } from './data/index.js';

const T = GAME.touch;

// 스킬 트리·선택 창이 열려 있는지 알려 준다 (main.js 가 매 프레임 호출)
export function setTouchPanelOpen(open) {
  document.body.classList.toggle('panel-open', open);
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
    const down = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('on');
      Input.pressVirtual(code);
      navigator.vibrate?.(T.vibrateMs);
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('on');
      Input.releaseVirtual(code);
    };
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
  const held = new Set();

  const set = (codes) => {
    for (const c of DIRS) {
      if (codes.has(c) && !held.has(c)) {
        held.add(c);
        Input.pressVirtual(c);
      } else if (!codes.has(c) && held.has(c)) {
        held.delete(c);
        Input.releaseVirtual(c);
      }
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

  const end = (e) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    knob.style.transform = '';
    set(new Set());
  };

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    pad.setPointerCapture?.(e.pointerId);
    move(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) move(e);
  });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
}
