# CLAUDE.md

## 컨셉
캐릭터 1명, 방을 클리어할 때마다 스킬 후보 2~3개 중 하나를 골라 그 판의 빌드를 쌓는 로그라이트. 죽으면 스킬 초기화.

## 기술 스택
- 언어: JavaScript (ES 모듈, 프레임워크 없음)
- 렌더링: HTML5 Canvas 2D
- 빌드/개발 서버: Vite 8.3.x (`package.json` 의 `devDependencies`)
- 런타임: Node.js 22 (Vite 8 요구사항: `^20.19.0 || >=22.12.0`)
- 배포: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`)

## 폴더 구조
```
.
├── index.html               # 진입 HTML (캔버스 + src/main.js 로드)
├── vite.config.js           # Pages 배포 시 base 를 '/<repo>/' 로 자동 설정
├── package.json
├── src/
│   ├── main.js              # 고정 시간 간격 게임 루프, 카메라, 렌더 호출
│   ├── input.js             # 키보드 입력 (down / pressed / released)
│   ├── player.js            # 플레이어 이동·점프·공격·피격·그리기
│   ├── enemy.js             # 적 (테스트용 더미: 순찰, 피격, 사망·리스폰)
│   ├── physics.js           # 타일 충돌(moveAndCollide), 사각형 겹침 판정
│   ├── chain.js             # 사슬 (던지기 → 멈칫 → 지형/적으로 날아가기, 적 끌어오기)
│   ├── skills.js            # 스킬 트리 (보유 스킬 → 플레이어 수치 계산, 후보 뽑기)
│   ├── skillUI.js           # 스킬 선택 창 / 스킬 트리 창 그리기
│   ├── world.js             # 타일맵 데이터 해석·그리기
│   └── data/                # ★ 모든 수치·레벨 데이터
│       ├── index.js         # 데이터 진입점 (PLAYER, GAME, LEVELS export)
│       ├── player.json      # 이동·점프·공격 콤보(attack.combo)·대시(dash)·사슬(chain)·피격(hurt) 수치
│       ├── enemies.json     # 적 종류별 수치 (dummy). respawnTime 0 = 다시 안 나타남
│       ├── skills.json      # 스킬 트리 정의 (트리 → 스킬: requires, effects, 화면 위치 pos). pickOnRoomClear: 방 클리어 시 선택 창 사용 여부
│       ├── game.json        # 타일 크기, 물리 스텝, 카메라 등
│       └── levels/*.txt     # 문자 타일맵 ('#' 땅, '.' 빈칸, 'P' 시작 위치, 'E' 적)
├── .github/workflows/deploy.yml
└── graphify-out/            # graphify 코드 그래프 (graph.html, GRAPH_REPORT.md)
```

## 명령어
```bash
npm install        # 최초 1회
npm run dev        # 로컬 개발 서버 (http://localhost:5173)
npm run build      # dist/ 로 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
```
`index.html` 을 파일로 직접 열면 ES 모듈 때문에 동작하지 않는다. 반드시 `npm run dev` 로 실행.

## 코드 규칙
- **수치를 코드에 직접 쓰지 않는다.** 속도, 점프력, 중력, 쿨다운, 데미지, 지속 시간 등 밸런스·조작감에 영향을 주는 값은 `src/data/` 의 데이터 파일(JSON 등)에 두고 `src/data/index.js` 를 통해 가져온다.
  - 예외: 0/1 같은 로직 상수, 그리기용 픽셀 오프셋.
- 새 스킬·적·방도 데이터 파일로 정의하고, 코드는 그 데이터를 해석하는 쪽으로 작성한다.
- 레벨은 `src/data/levels/` 에 텍스트 타일맵으로 추가한다.
- 스킬은 `src/data/skills.json` 에 추가한다. 효과는 `{ "stat": "dash.speed", "op": "mul"|"add"|"set", "value": … }` 로 `player.json` 의 수치를 바꾸는 방식이다. 플레이어 코드는 `PLAYER` 대신 `this.stats`(스킬 적용된 수치)를 읽어야 한다. 새 동작이 필요한 스킬은 `player.json` 에 기본값을 가진 수치를 추가하고 코드에서 그 값을 보고 동작하게 한다 (예: `dash.directions` 2→8, `dash.mode` 'dash'→'chain', `chain.onEnemy` 'zip'→'pull').
- 조작: ←/→ 이동, Space 점프(2단), X 공격(꾹 누르면 연속), Shift 대시, K 스킬 트리(테스트용: 클릭 또는 ↑↓+Enter 로 배우기/해제), R 처음부터(스킬 초기화 — 플레이어 사망이 생기기 전까지 임시).
- 개발 서버에서는 `window.__game` 으로 player/enemies/world 상태를 볼 수 있다 (배포 빌드에는 없음).

## 현재 상태
프로토타입 1(손맛) 준비 단계.
- 구현됨: 타일 땅, 좌우 이동(가감속), 점프·2단 점프, 가변 점프 높이, 코요테 타임, 점프 버퍼, 착지/점프 스쿼시, 카메라 추적, 낙사 리스폰.
- 구현됨(전투 기초): X 3단 콤보(내려베기 → 올려베기 → 마무리 베기, 타마다 전진, 입력 버퍼·콤보 유지 시간, 단계별 수치는 `player.json` 의 `attack.combo` 배열), 히트스톱, 넉백, 꾹 누르기 연속 공격, 대시(Shift: 땅·공중 1회, 대시 중 무적으로 적 통과, 공격 캔슬, 잔상), 테스트용 적(순찰, 체력 3, 피격 경직·넉백), 적 몸통 충돌 시 플레이어 넉백·무적 시간.
- 구현됨(로그라이트 루프 시제품): 적 전멸 = 방 클리어 → 다음 방(같은 맵, 적 다시 배치). 방 클리어 시 스킬 후보 3개 중 1개 선택 창은 구현돼 있지만 지금은 꺼 둠(`skills.json` 의 `pickOnRoomClear: false`). 대신 스킬 트리 화면(K)에서 직접 배우기/해제(잠긴 스킬은 선행 스킬까지 함께 배우고, 해제하면 그 스킬이 필요한 스킬도 함께 해제). 스킬 트리는 대시 트리 1개: 대각선 대시(↑↓ 로 8방향) → 사슬(대시를 대체. 빠르게 날아가 걸리면 잠깐 멈칫한 뒤, 지형이면 그 위치로, 적이면 적에게 날아가 붙으며 피해) → 끌어오기(적에게 날아가는 대신 적을 끌어오며 피해, 지형은 그대로 날아감). R 로 초기화.
- 아직 없음: 플레이어 체력·사망, 서로 다른 방(맵), 대시 외 스킬 트리.
