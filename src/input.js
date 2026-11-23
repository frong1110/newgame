// 키보드 입력. "누르고 있는지"와 "이번 프레임에 눌렸는지/뗐는지"를 구분한다.
const down = new Set();
const pressed = new Set();
const released = new Set();
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault(); // 스크롤 방지
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});
window.addEventListener('keyup', (e) => {
  down.delete(e.code);
  released.add(e.code);
});
window.addEventListener('blur', () => down.clear());

export const Input = {
  isDown: (code) => down.has(code),
  wasPressed: (code) => pressed.has(code),
  wasReleased: (code) => released.has(code),
  // 매 업데이트 끝에 호출
  endFrame() {
    pressed.clear();
    released.clear();
  },
};
