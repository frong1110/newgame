# newgame
game development with claude ai

## 프로토타입 v0.1 — 이동 / 점프 / 2단 점프

HTML5 Canvas + 순수 JavaScript. 설치나 빌드 없이 `index.html`을 브라우저로 열면 바로 실행됩니다.

### 조작
| 키 | 동작 |
|---|---|
| ← → | 좌우 이동 |
| Space | 점프 (공중에서 한 번 더 누르면 2단 점프, 짧게 누르면 낮게 점프) |
| R | 시작 위치로 리스폰 |

### 구조
- `src/config.js` — 속도, 중력, 점프력 등 조작감 수치 (튜닝은 여기서)
- `src/input.js` — 키보드 입력 (누름/뗌을 프레임 단위로 구분)
- `src/world.js` — 문자열 타일맵 레벨 (`#` 땅, `P` 시작 위치) 및 렌더링
- `src/player.js` — 캐릭터 물리, 충돌, 점프 로직
- `src/main.js` — 고정 시간 간격 게임 루프, 카메라
