# newgame
game development with claude ai

## 플레이
**https://frong1110.github.io/newgame/**

`main` 브랜치에 push될 때마다 GitHub Actions가 자동으로 빌드해서 위 주소에 배포합니다.

## GitHub에서 직접 해야 하는 설정 (최초 1회)
1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
2. 작업 브랜치를 `main` 에 머지합니다. 배포는 `main` 에 push될 때만 실행됩니다.
3. **Actions** 탭에서 `Deploy to GitHub Pages` 워크플로가 초록색으로 끝났는지 확인하고 위 주소에 접속합니다.
   - 첫 배포 전에 1번을 하지 않았다면 실패하므로, 설정 후 Actions 탭에서 **Re-run jobs** 를 누릅니다.
   - 워크플로 화면의 **Run workflow** 버튼으로 수동 배포도 할 수 있습니다.
4. 저장소가 **비공개(private)** 라면 무료 플랜에서는 Pages를 쓸 수 없습니다. 공개로 바꾸거나 유료 플랜이 필요합니다.

## 로컬 실행
```bash
npm install
npm run dev
```
브라우저에서 http://localhost:5173 을 엽니다. (`index.html` 을 파일로 직접 열면 동작하지 않습니다.)

## 프로토타입 v0.1 — 이동 / 점프 / 2단 점프

### 조작
| 키 | 동작 |
|---|---|
| ← → | 좌우 이동 |
| Space | 점프 (공중에서 한 번 더 누르면 2단 점프, 짧게 누르면 낮게 점프) |
| X | 공격. 박자 맞춰 연타하거나 꾹 누르면 3단 콤보 (내려베기 → 올려베기 → 마무리 베기) |
| Shift | 대시. 공중에서도 1번 가능, 대시 중에는 무적이라 적을 통과해 피할 수 있음 |
| K | 스킬 트리 (게임 일시정지). 테스트용으로 스킬을 클릭하거나 ↑↓ + Enter 로 배우기/해제 |
| R | 처음부터 다시 (스킬·방 초기화) |

### 스킬
지금은 테스트용으로 **K 스킬 트리 화면에서 직접** 스킬을 배우거나 해제합니다. (방을 클리어하면 후보 중 하나를 고르는 창은 `src/data/skills.json` 의 `pickOnRoomClear` 를 `true` 로 바꾸면 다시 켜집니다.) 지금은 **대시 트리** 하나가 있습니다.
1. **대각선 대시** — Shift 를 ↑↓(+←→) 와 함께 누르면 위·아래·대각선으로 대시
2. **사슬** — 대시 대신 사슬을 빠르게 던짐. 걸리면 잠깐 멈칫한 뒤, 지형에 박히면 그 위치로 빠르게 날아가고, 적에게 닿으면 적에게 날아가 붙으며 피해
3. **끌어오기** — 사슬에 걸린 적을 내 쪽으로 끌어오며 피해 (지형에는 그대로 날아감)

### 구조
- `src/data/` — 속도, 중력, 점프력 등 모든 수치(`player.json`, `enemies.json`, `game.json`), 스킬(`skills.json`)와 레벨(`levels/*.txt`). 튜닝은 여기서
- `src/input.js` — 키보드 입력 (누름/뗌을 프레임 단위로 구분)
- `src/world.js` — 타일맵 충돌·렌더링
- `src/player.js` — 캐릭터 이동, 점프, 공격, 피격
- `src/enemy.js` — 테스트용 적 (순찰, 피격, 리스폰)
- `src/physics.js` — 타일 충돌, 겹침 판정
- `src/chain.js` — 사슬 스킬
- `src/skills.js`, `src/skillUI.js` — 스킬 트리 로직과 선택·트리 화면
- `src/main.js` — 고정 시간 간격 게임 루프, 카메라

프로젝트 규칙과 컨셉은 [CLAUDE.md](CLAUDE.md) 참고.
