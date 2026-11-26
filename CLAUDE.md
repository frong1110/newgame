# CLAUDE.md
# Project Context: Phaser 3 Web Game Prototype
- Engine: Phaser 3 (JavaScript/ES Modules)
- Goal: Rapid prototyping, clean modular code, 60fps performance

# Directory & Token Optimization Rules
- NEVER read or scan `node_modules/`, `dist/`, `.git/`, or raw binary folders (`assets/images/`, `assets/audio/`).
- Only check `assets/manifest.json` or `PreloadScene.js` to verify asset keys.
- Keep individual files under 350 lines. Split logic into `scenes/`, `entities/`, `systems/`, and `ui/`.

# Phaser Coding Conventions
- Use Arcade Physics unless Matter.js is explicitly requested.
- Clean up event listeners, timers, and tweens inside scene `shutdown` or `destroy` events to prevent memory leaks.
- Keep game balance numbers (speed, HP, spawn rate) in a single `src/config/constants.js` file so tweaks don't require editing logic files.

# Workflow Rules
- Before implementing a new mechanic, briefly outline the file changes in 3-5 bullet points.
- Output only changed code blocks or targeted edits instead of rewriting entire files.

## 컨셉
캐릭터 1명, 방을 클리어할 때마다 스킬 후보 2~3개 중 하나를 골라 그 판의 빌드를 쌓는 로그라이트. 죽으면 스킬 초기화.
첫 주 무기는 사슬(휘두르기, 당기기, 갈고리 이동). 기획 문서: 'Claude와 함께하는 1인 게임 개발 로드맵', '무기·증강 설계안' (Claude Docs).

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
├── package.json             # version = 게임 버전 (화면·탭 제목에 표시)
├── CHANGELOG.md             # 버전별 변경 기록
├── docs/TESTING.md          # 테스트 가이드 (평소엔 읽지 않음. 필요할 때만 — 아래 '테스트 규칙')
├── tests/                   # regress.cjs (결정적 회귀 재생), compare.cjs (기록 비교)
├── src/
│   ├── main.js              # 진입점: 객체 생성, 고정 시간 간격 루프, 메뉴·방 진행, 카메라, 그리기 순서
│   ├── combat.js            # 한 프레임 타격 판정 (휘두르기·내리꽂기·던져진 적·몸통 충돌, 화면 멈춤)
│   ├── effects.js           # 이펙트(먼지·불꽃·번쩍임·충격파·사슬 옮겨 붙기)와 화면 흔들림
│   ├── bindChains.js        # 결박 갈래: 사슬 감옥 훅, 감기 상한·사슬 끊김, 묶인 사슬 그리기
│   ├── bindPull.js          # 결박 갈래: 팽팽한 줄(선 피해·속박), C 끌어모으기(충돌 / 사슬 감옥 폭발)
│   ├── spinCharge.js        # 분동 갈래: 회전 차지·쳐내기 축적·채찍 폭풍 (Player 에 붙는 mixin)
│   ├── flailStorm.js        # 투척 갈래 3단계 철퇴 폭풍 (C 길게: 여러 적 붙잡아 돌리고 앞/↑/↓ 로 날림)
│   ├── projectiles.js       # 투사체 (쳐내기 대상, P 키 테스트 발사)
│   ├── tags.js              # 공용 증강 태그 효과 연결 지점 (emitTag / onTag)
│   ├── hud.js               # 화면 글자 (디버그 HUD, 보유 스킬, 버전)
│   ├── input.js             # 입력 (키보드 + 화면 버튼, down / pressed / released)
│   ├── controls.js          # 조작 키 코드 상수
│   ├── touch.js             # 모바일 화면 버튼 (방향 패드·행동 버튼 → 키 코드로 Input 에 전달)
│   ├── player.js            # 플레이어 본체: 생성·리스폰, 매 프레임 업데이트, 피격, 그리기 (아래 세 파일을 mixin.js 로 붙임)
│   ├── playerWeapon.js      # 주 무기: 사슬 휘두르기(콤보·끝부분·분동 조율) / 검, 특수 버튼 대상, 무기 그리기
│   ├── playerDash.js        # 대시: 8방향 조준, 대시 / 대시 사슬 시작, 잔상, 무적 판정
│   ├── playerSlam.js        # 대시 트리 내리꽂기
│   ├── mixin.js             # 여러 파일의 메서드를 한 클래스에 붙이는 도우미
│   ├── enemy.js             # 적 (테스트용 더미: 순찰, 피격, 속박, 공중 상태(던져짐·띄워짐), 매달림, 밀려남, 사망)
│   ├── physics.js           # 타일 충돌(moveAndCollide), 사각형 겹침 판정
│   ├── chain.js             # 던지는 사슬 (대시 사슬: 걸리면 바로 날아가기 / 당기기: 끌어오기·회전 투척·띄우기·철퇴 폭풍 / 내리찍기)
│   ├── skills.js            # 스킬 트리 (보유 스킬 → 플레이어 수치 계산, 후보 뽑기)
│   ├── skillUI.js           # 스킬 선택 창 / 스킬 트리 창 그리기
│   ├── world.js             # 타일맵 데이터 해석·그리기
│   ├── audio.js             # 효과음 (임시: Web Audio 로 즉석 생성, 수치는 game.json 의 sfx)
│   └── data/                # ★ 모든 수치·레벨 데이터
│       ├── index.js         # 데이터 진입점 (PLAYER, GAME, LEVELS export)
│       ├── player.json      # 이동·점프, weapon(주 무기), chainWeapon(사슬 휘두르기 콤보·끝부분), attack(검), pullChain(당기기·투척 갈래: launch*/slam*/storm*), dash, chain(대시 사슬), slam(대시 트리 내리꽂기), hurt
│       ├── enemies.json     # 적 종류별 수치 (dummy). respawnTime 0 = 다시 안 나타남
│       ├── skills.json      # 스킬 트리 정의 (트리 → 스킬: requires, effects, 화면 위치 pos). pickOnRoomClear: 방 클리어 시 선택 창 사용 여부
│       ├── game.json        # 타일 크기, 물리 스텝, 카메라, 이펙트 시간, 효과음(sfx) 등
│       └── levels/*.txt     # 문자 타일맵 ('#' 땅, '.' 빈칸, 'P' 시작 위치, 'E' 적)
├── .github/workflows/deploy.yml
└── graphify-out/            # (저장소에 없음, .gitignore) graphify 코드 그래프. 필요할 때 로컬에서 /graphify 로 만든다
```

## 명령어
```bash
npm install        # 최초 1회
npm run dev        # 로컬 개발 서버 (http://localhost:5173)
npm run build      # dist/ 로 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
```
`index.html` 을 파일로 직접 열면 ES 모듈 때문에 동작하지 않는다. 반드시 `npm run dev` 로 실행.

## 버전 규칙
- 게임 버전은 `package.json` 의 `version` 하나만 기준으로 한다. `vite.config.js` 가 `__APP_VERSION__` 으로 넣어 주고, 화면 위쪽 가운데와 탭 제목에 `v0.1.0` 처럼 표시된다.
- PR 을 만들 때마다 버전을 올리고 `CHANGELOG.md` 맨 위에 새 항목(버전, 날짜, 바뀐 점)을 추가한다.
  - **기본은 PATCH 만 올린다 (0.3.0 → 0.3.1).** 스킬 하나 추가·수정, 수치 조정, 버그 수정, 연출, 문서 등 사소한 변경은 모두 여기에 해당한다.
  - MINOR (0.3.0 → 0.4.0) 는 새 무기·캐릭터·맵·큰 시스템처럼 큰 단위이거나 사용자가 따로 요청할 때만 올린다.
- 현재 버전: 0.4.1

## 테스트 규칙
- **작은 변경**(수치 조정, 스킬 하나 추가·수정, 버그 수정, 연출, 문서): 바뀐 기능만 확인하고 `npm run build`. **회귀 재생과 graphify 재생성은 하지 않는다.**
- **구조를 바꾸는 작업**(파일 분리·합치기, `physics.js`·`input.js`·`enemy.js`·`chain.js` 같은 공용 모듈, 프레임 진행 순서): 바꾸기 전과 후에 회귀 재생을 돌려 기록이 똑같은지 확인한다. graphify 는 그래도 요청이 있을 때만.
- 무엇을 어떻게 확인하는지(기능별 체크리스트·기대값, 회귀 재생 방법, 함정)는 **`docs/TESTING.md`** 에 있다. **필요할 때만 열어서** 바뀐 부분 항목만 읽는다. 전체를 매번 읽지 않는다.
- 새 기능을 넣으면 `docs/TESTING.md` 에 확인 항목을, 구조 변경에 영향이 있는 기능이면 `tests/regress.cjs` 에 장면을 추가한다.

## 코드 규칙
- **수치를 코드에 직접 쓰지 않는다.** 속도, 점프력, 중력, 쿨다운, 데미지, 지속 시간 등 밸런스·조작감에 영향을 주는 값은 `src/data/` 의 데이터 파일(JSON 등)에 두고 `src/data/index.js` 를 통해 가져온다.
  - 예외: 0/1 같은 로직 상수, 그리기용 픽셀 오프셋.
- 새 스킬·적·방도 데이터 파일로 정의하고, 코드는 그 데이터를 해석하는 쪽으로 작성한다.
- 레벨은 `src/data/levels/` 에 텍스트 타일맵으로 추가한다. 기본 맵은 `bind.txt`(결박 시험장), 주소에 `?level=level1` 이면 옛 시험장(회귀 재생 기준).
- 스킬은 `src/data/skills.json` 에 추가한다. 효과는 `{ "stat": "dash.speed", "op": "mul"|"add"|"set", "value": … }` 로 `player.json` 의 수치를 바꾸는 방식이다. 플레이어 코드는 `PLAYER` 대신 `this.stats`(스킬 적용된 수치)를 읽어야 한다. 새 동작이 필요한 스킬은 `player.json` 에 기본값을 가진 수치를 추가하고 코드에서 그 값을 보고 동작하게 한다 (예: `dash.directions` 2→8, `dash.mode` 'dash'→'chain', `chain.slamAfterZip` false→true).
- 조작: ←/→ 이동, Space 점프(2단), X 공격(사슬 휘두르기, 꾹 누르면 연속), C 특수(사슬: 당기기, ↑↓ 로 조준. 회전 투척이 있으면 ↑ 는 조준 대신 '띄우기'), Shift 대시, K 스킬 트리(테스트용: 클릭 또는 ↑↓+Enter 로 배우기/해제, Q 로 주 무기 사슬↔검), R 처음부터(스킬 초기화 — 플레이어 사망이 생기기 전까지 임시).
- 스킬 트리 규칙(설계안): 무기마다 세 갈래 × 3단계, 앞 단계를 가져야 다음 단계. 설계만 있고 동작이 없는 스킬은 `skills.json` 에 `"implemented": false` 로 넣는다 (트리에 '준비 중'으로 보이고 배울 수 없음).
- 모바일: 터치 기기에서는 화면 버튼이 자동으로 나온다 (PC 에서는 주소에 `?touch=1`). 버튼은 키보드와 같은 키 코드를 `Input.pressVirtual/releaseVirtual` 로 넣으므로 새 조작을 추가하면 `touch.js` 에 버튼도 추가한다. 가로 화면 전용(세로면 안내 문구).
- 개발 서버에서는 `window.__game` 으로 player/enemies/world 상태를 볼 수 있다 (배포 빌드에는 없음). `__game.pause()` 로 실시간 루프를 멈추고 `__game.tick(n)` 으로 고정 간격 n 프레임을 진행하면 같은 입력에 항상 같은 결과가 나온다 (리팩터링 전후 비교 같은 회귀 테스트용).

## 현재 상태
프로토타입 1(손맛) 준비 단계.
- 구현됨: 타일 땅, 좌우 이동(가감속), 점프·2단 점프, 가변 점프 높이, 코요테 타임, 점프 버퍼, 착지/점프 스쿼시, 카메라 추적, 낙사 리스폰.
- 구현됨(전투 기초): X 3단 콤보(내려베기 → 올려베기 → 마무리 베기, 타마다 전진, 입력 버퍼·콤보 유지 시간, 단계별 수치는 `player.json` 의 `attack.combo` 배열), 히트스톱, 넉백, 꾹 누르기 연속 공격, 대시(Shift: 땅·공중 1회, 대시 중 무적으로 적 통과, 공격 캔슬, 잔상), 테스트용 적(순찰, 체력 10, 피격 경직·넉백), 적 몸통 충돌 시 플레이어 넉백·무적 시간.
- 구현됨(로그라이트 루프 시제품): 적 전멸 = 방 클리어 → 다음 방(같은 맵, 적 다시 배치). 방 클리어 시 스킬 후보 3개 중 1개 선택 창은 구현돼 있지만 지금은 꺼 둠(`skills.json` 의 `pickOnRoomClear: false`). 대신 스킬 트리 화면(K)에서 직접 배우기/해제(잠긴 스킬은 선행 스킬까지 함께 배우고, 해제하면 그 스킬이 필요한 스킬도 함께 해제). 대시(이동) 트리: 대각선 대시(↑↓ 로 8방향) → 사슬(대시를 대체. 사슬을 던져 지형·적에 걸리면 잠깐 멈칫한 뒤 바로 그곳으로 날아감, 적이면 붙으며 피해. 적에게 날아갈 때는 '내 발이 적의 발보다 `chain.feetClearance` 위'를 노려서 같은 높이 적에게 수평으로 날아가고, 날아가다 턱·절벽 모서리에 걸리면 `chain.ledgeAssist` px 까지 올려서 넘어감(낭떠러지 건너편 적에게 가다 끊겨 떨어지던 문제 수정). 다시 누르는 방식(`chain.twoPress`)도 코드에 남아 있지만 꺼 둠) → 내리꽂기(사슬 이동이 끝난 뒤 `slam.readyTime` 안에 공격 키를 누르면(이동 중 미리 눌러도 됨) 분동을 뒤→머리 위→앞으로 크게 휘둘러 휘두르기 끝부분 거리의 땅에 수직으로 내리꽂음(그동안 공중에 멈춤·무적, 공중이면 `slam.maxDrop` 까지 떨어짐). 몸쪽(플레이어 중심 + `slam.areaNear`)부터 분동이 떨어진 지점 + `slam.areaFar` 까지의 적에게 큰 피해 + 충격파·화면 흔들림. 사슬 무기면 맞은 적을 휘두르기 1타의 끝부분 거리(`player.tipRangeX`)로 미끄러지듯 밀어내고 경직시켜, 바로 X 로 끝부분 적중을 이어 칠 수 있음(`slam.pushToTip`). 가능할 때 머리 위에 ▼ 표시). R 로 초기화.
- 구현됨(사슬 무기): 주 무기 기본값 사슬. X 휘두르기 3단 콤보(채찍 → 되감아 치기 → 내려치기). 사슬이 감겼다가 뻗으며 휘고, 판정은 휘두르는 궤적을 훑어서 계산. 지금 뻗은 사슬 끝에서 `tipFraction` 만큼이 끝부분(분동)이고, 사슬이 `minTipExtension` 이상 뻗었을 때만 끝부분 피해(몸통 1, 끝부분 2~3) + 불꽃 이펙트. C 당기기: 사슬을 던져 맞은 적을 앞으로 끌어오고 경직(피해 0), 지형에는 걸리지 않음. 사슬 무기 트리(결박·투척·분동 × 3단계) 전부 구현 — 결박 갈래: 감기(끝부분 적중 시 1초 속박(`tipBindTime`): 넉백 없이 제자리, X 자 사슬과 남은 시간 막대. 사슬은 속박이 풀려도 3초(`tipChainTime`, `enemy.chainTimer`) 유지되고 그동안 팽팽한 줄·끌어모으기·전이 대상이며, 캐릭터와 이어져 `bindTetherRange` 보다 멀어지면 끊어짐, 동시에 `bindMaxTargets`(3) 명까지, 넘으면 가장 오래된 적이 풀림: `bindChains.js` `bindWithCap`), 팽팽한 줄(묶인 적들 사이 사슬 선에 닿은 다른 적은 피해·속박, 묶인 적이 2명 이상일 때 C 가 당기기 대신 서로를 향해 날아가 충돌·피해·기절: `bindPull.js`), 사슬 감옥(묶인 적이 죽으면 `prisonRange` 안의 가까운 적 `prisonMaxTargets` 마리에게 사슬이 옮겨 붙어 속박: `Enemy.hooks.onBoundDied`, `enemy.bindAnchor`. C 는 충돌 대신 한 점으로 끌어모아 조인 뒤 묶은 수에 비례한 폭발), 투척 갈래 완성 — 회전 투척(당긴 적을 낮게 던져 던진 적·맞은 적 모두 피해. C 를 누를 때나 당기는 동안 ↑ 면 대신 위로 띄움: `pullChain.launchHeight`/`launchHangTime`/`launchGravity`), 내리찍기(공중 상태 적이 `slamRange` 안에 있으면 C 가 대기시간을 무시하고 그 적을 따라가 감아 바닥에 꽂음 → 꽂힌 적 + 주변 적 피해, 충격파·흔들림), 철퇴 폭풍(C 탭 = 당기기, C 길게(`stormHoldThreshold`) = 사슬을 돌려 닿는 적(`stormGrabReach*` 타원, 최대 `stormMaxHeld`)을 모두 붙잡아 같이 돌리다가 놓으면 입력 방향으로 한꺼번에 날림 — 앞: 전방 비행, 부딪힌 적 피해, 벽·맵 끝에서 폭발·기절 / ↑: 띄움 → 내리찍기 콤보 / ↓: 바로 내리찍어 바닥 폭발. 회전 중 공격·대시 키는 취소, 보스 본체는 `grabbable=false` 로 면역, 쿨타임 `stormCooldown` 은 슬롯만: `flailStorm.js`, 폭발 처리 `combat.js` `resolveBlasts`). 던져지거나 띄워진 적은 '공중 상태'(`enemy.flight`, 하늘색 테두리 + ▲)이고, 땅에 닿으면 풀림. 분동 갈래 — 회전 차지(X 탭 = 일반 휘두르기, 꾹 누르면 `chargeHoldThreshold` 뒤 사슬을 돌려 차지(이동 느려짐, 투사체 쳐냄), 놓으면 `chargeReleaseStep` 타로 방출. 방출 때만 앞쪽 `tuneMaxLengthMul` 사거리 안 가장 가까운 적까지 사슬 길이 보정: `player.tuneSwingLength`. 분동 그림 `weightModelScale`, 끝부분 판정 `tipHitMultiplier`, 리스크 `tipBonusMultiplier`), 쳐내기 축적(돌리는 중 쳐낸 투사체를 `storeMax` 개까지 저장, 방출하면 부채꼴 반사), 채찍 폭풍(쳐내기·돌리는 분동 적중으로 회전 스택 `stormMaxStacks`, 최대 스택 방출은 전방 넓은 아치(반타원, 상하 좁음) 반사·타격, 태그 효과는 `tags.js` 로 연결: `spinCharge.js`). 끝부분 피해 = (몸통 + (끝부분 − 몸통) × `tipBonusMultiplier`) × 방출 차지 배율, 소수 그대로. 끝부분 적중 시 번쩍임 + 효과음(`audio.js` `playSfx('tipHit')`). 투사체는 적이 아직 쏘지 않아 P 키로 테스트 발사(`projectiles.js`). 검은 테스트용으로 남겨 둠.
- 아직 없음: 플레이어 체력·사망, 서로 다른 방(맵), 적 2종째, 적의 투사체 공격, 공용 증강(태그 효과), '무기당 3단계 완성은 하나' 규칙, 튜닝 패널.
