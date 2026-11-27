// 입력. "누르고 있는지"와 "이번 프레임에 눌렸는지/뗐는지"를 구분한다.
// 키보드와 화면 버튼(touch.js)이 같은 키 코드로 들어온다. 둘 중 하나라도 누르고 있으면 누른 상태.
const keyDown = new Set(); // 키보드로 누른 키
const virtualDown = new Set(); // 화면 버튼으로 누른 키
const pressed = new Set();
const released = new Set();
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

const isDown = (code) => keyDown.has(code) || virtualDown.has(code);

function press(set, code) {
  if (!isDown(code)) pressed.add(code);
  set.add(code);
}

function release(set, code) {
  if (!set.has(code)) return;
  set.delete(code);
  if (!isDown(code)) released.add(code);
}

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault(); // 스크롤 방지
  press(keyDown, e.code);
});
window.addEventListener('keyup', (e) => release(keyDown, e.code));
window.addEventListener('blur', () => {
  keyDown.clear();
  virtualDown.clear();
});

export const Input = {
  isDown,
  isVirtualDown: (code) => virtualDown.has(code), // 화면 버튼이 지금 누르고 있는 키 (touch.js 가 자기 상태 대신 이걸 기준으로 삼는다)
  wasPressed: (code) => pressed.has(code),
  wasReleased: (code) => released.has(code),
  // 화면 버튼에서 호출
  pressVirtual: (code) => press(virtualDown, code),
  releaseVirtual: (code) => release(virtualDown, code),
  // 매 업데이트 끝에 호출
  endFrame() {
    pressed.clear();
    released.clear();
  },
};
