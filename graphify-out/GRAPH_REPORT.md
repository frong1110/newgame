# Graph Report - newgame  (2026-11-24)

## Corpus Check
- 21 files · ~16,889 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 265 nodes · 478 edges · 12 communities (9 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f25b1e6f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- Chain
- Enemy
- Player
- input.js
- deploy
- [0.1.0] - 2026-11-24
- package.json
- CLAUDE.md
- index.js
- SkillTree
- World

## God Nodes (most connected - your core abstractions)
1. `Player` - 46 edges
2. `Chain` - 32 edges
3. `SkillTree` - 16 edges
4. `Enemy` - 15 edges
5. `center()` - 14 edges
6. `moveAndCollide()` - 12 edges
7. `overlaps()` - 11 edges
8. `GAME` - 8 edges
9. `update()` - 8 edges
10. `renderOverlay()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `enemies` --calls--> `Enemy`  [EXTRACTED]
  src/main.js → src/enemy.js
- `resolveSlam()` --calls--> `overlaps()`  [EXTRACTED]
  src/main.js → src/physics.js
- `resolveCombat()` --calls--> `overlaps()`  [EXTRACTED]
  src/main.js → src/physics.js

## Import Cycles
- None detected.

## Communities (12 total, 3 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.10
Nodes (37): addImpactEffects(), applySkills(), cam, choices, clamp(), ctx, drawVersion(), frame() (+29 more)

### Community 3 - "Player"
Cohesion: 0.07
Nodes (5): Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump), Player

### Community 4 - "input.js"
Cohesion: 0.16
Nodes (14): Fixed-Timestep Game Loop, Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), GAME_KEYS, Input, isDown(), keyDown, press() (+6 more)

### Community 5 - "deploy"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 6 - "[0.1.0] - 2026-11-24"
Cohesion: 0.22
Nodes (8): [0.1.0] - 2026-11-24, 기타, 변경 기록, 사슬 무기 (주 무기), 스킬 트리 (K, 테스트용으로 직접 배우기/해제), 이동, 이번 버전에서 바뀐 점, 전투·적

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (12): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+4 more)

### Community 8 - "CLAUDE.md"
Cohesion: 0.20
Nodes (7): 기술 스택, 명령어, 버전 규칙, 컨셉, 코드 규칙, 폴더 구조, 현재 상태

### Community 9 - "index.js"
Cohesion: 0.13
Nodes (15): #game Canvas 960x540, index.html Game Page, expand(), ENEMIES, GAME, LEVELS, PLAYER, canvas (+7 more)

### Community 10 - "SkillTree"
Cohesion: 0.20
Nodes (3): SKILLS, applyEffect(), SkillTree

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `main.js`, `index.js`, `Chain`, `CLAUDE.md`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09615384615384616 - nodes in this community are weakly interconnected._
- **Why does `Chain` connect `Chain` to `index.js`, `Player`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `Player` be split into smaller, more focused modules?**
  _Cohesion score 0.07020408163265306 - nodes in this community are weakly interconnected._
- **Why does `SkillTree` connect `SkillTree` to `main.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._