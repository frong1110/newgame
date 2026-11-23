// 게임 전역 설정값. 조작감을 바꾸고 싶으면 여기 숫자만 조절하면 된다.
const CONFIG = {
  TILE: 32,

  // 이동
  MOVE_SPEED: 260,      // 최대 좌우 속도 (px/s)
  GROUND_ACCEL: 2400,   // 땅에서 가속도
  GROUND_DECEL: 2800,   // 땅에서 키를 뗐을 때 감속
  AIR_ACCEL: 1600,      // 공중에서 가속도
  AIR_DECEL: 900,       // 공중에서 감속

  // 점프
  GRAVITY: 2200,        // 중력 (px/s^2)
  MAX_FALL_SPEED: 900,
  JUMP_SPEED: 720,      // 1단 점프 초기 속도
  DOUBLE_JUMP_SPEED: 640, // 2단 점프 초기 속도
  MAX_JUMPS: 2,         // 총 점프 횟수 (2 = 2단 점프)
  JUMP_CUT: 0.45,       // 점프 중 스페이스를 떼면 상승 속도에 곱함 (가변 점프 높이)
  COYOTE_TIME: 0.1,     // 발판에서 떨어진 직후에도 1단 점프 허용 시간 (s)
  JUMP_BUFFER: 0.12,    // 착지 직전에 누른 점프를 기억하는 시간 (s)
};
