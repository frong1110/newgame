# Graph Report - newgame  (2026-11-24)

## Corpus Check
- 22 files · ~18,813 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 287 nodes · 515 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `359c50c5`
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
- Prototype v0.1 (Move / Jump / Double Jump)
- audio.js

## God Nodes (most connected - your core abstractions)
1. `Player` - 48 edges
2. `Chain` - 32 edges
3. `Enemy` - 17 edges
4. `SkillTree` - 16 edges
5. `center()` - 14 edges
6. `moveAndCollide()` - 12 edges
7. `overlaps()` - 11 edges
8. `GAME` - 9 edges
9. `update()` - 9 edges
10. `renderOverlay()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `resolveCombat()` --calls--> `playSfx()`  [EXTRACTED]
  src/main.js → src/audio.js
- `enemies` --calls--> `Enemy`  [EXTRACTED]
  src/main.js → src/enemy.js
- `resolveSlam()` --calls--> `overlaps()`  [EXTRACTED]
  src/main.js → src/physics.js

## Import Cycles
- None detected.

## Communities (14 total, 4 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.08
Nodes (45): Fixed-Timestep Game Loop, addImpactEffects(), applySkills(), cam, center(), choices, clamp(), ctx (+37 more)

### Community 4 - "input.js"
Cohesion: 0.21
Nodes (11): GAME_KEYS, Input, isDown(), keyDown, press(), pressed, release(), released (+3 more)

### Community 5 - "deploy"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 6 - "[0.1.0] - 2026-11-24"
Cohesion: 0.13
Nodes (14): [0.1.0] - 2026-11-24, [0.2.0] - 2026-11-24, [0.3.0] - 2026-11-24, 기타, 바뀐 점, 바뀐 점, 변경 기록, 사슬 무기 (주 무기) (+6 more)

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (12): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+4 more)

### Community 8 - "CLAUDE.md"
Cohesion: 0.25
Nodes (6): 기술 스택, 명령어, 버전 규칙, 컨셉, 코드 규칙, 폴더 구조

### Community 9 - "index.js"
Cohesion: 0.13
Nodes (15): #game Canvas 960x540, index.html Game Page, expand(), ENEMIES, GAME, LEVELS, PLAYER, canvas (+7 more)

### Community 10 - "SkillTree"
Cohesion: 0.20
Nodes (3): SKILLS, applyEffect(), SkillTree

### Community 12 - "Prototype v0.1 (Move / Jump / Double Jump)"
Cohesion: 0.25
Nodes (6): Controls (Arrows / Space / R), Double Jump, Prototype v0.1 (Move / Jump / Double Jump), Respawn (R key), String Tilemap Level (# ground, P spawn), Variable Jump Height (short press = low jump)

### Community 13 - "audio.js"
Cohesion: 0.50
Nodes (3): ensure(), playSfx(), SOUNDS

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 108 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `main.js`, `index.js`, `Prototype v0.1 (Move / Jump / Double Jump)`, `Chain`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0797872340425532 - nodes in this community are weakly interconnected._
- **Why does `Chain` connect `Chain` to `index.js`, `Prototype v0.1 (Move / Jump / Double Jump)`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Chain` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Why does `SkillTree` connect `SkillTree` to `main.js`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `Player` be split into smaller, more focused modules?**
  _Cohesion score 0.07878787878787878 - nodes in this community are weakly interconnected._