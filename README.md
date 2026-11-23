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
| X | 공격 (앞으로 베기) |
| R | 시작 위치로 리스폰 (적도 초기화) |

### 구조
- `src/data/` — 속도, 중력, 점프력 등 모든 수치(`player.json`, `enemies.json`, `game.json`)와 레벨(`levels/*.txt`). 튜닝은 여기서
- `src/input.js` — 키보드 입력 (누름/뗌을 프레임 단위로 구분)
- `src/world.js` — 타일맵 충돌·렌더링
- `src/player.js` — 캐릭터 이동, 점프, 공격, 피격
- `src/enemy.js` — 테스트용 적 (순찰, 피격, 리스폰)
- `src/physics.js` — 타일 충돌, 겹침 판정
- `src/main.js` — 고정 시간 간격 게임 루프, 카메라

프로젝트 규칙과 컨셉은 [CLAUDE.md](CLAUDE.md) 참고.
