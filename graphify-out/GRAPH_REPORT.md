# Graph Report - newgame  (2026-11-24)

## Corpus Check
- 22 files · ~18,983 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 289 nodes · 517 edges · 12 communities (10 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ce380bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- Chain
- Enemy
- Player
- skillUI.js
- deploy
- [0.1.0] - 2026-11-24
- package.json
- CLAUDE.md
- index.js
- SkillTree
- World

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
- `enemies` --calls--> `Enemy`  [EXTRACTED]
  src/main.js → src/enemy.js
- `updateTree()` --calls--> `hitTestTree()`  [EXTRACTED]
  src/main.js → src/skillUI.js
- `renderOverlay()` --calls--> `drawChoicePanel()`  [EXTRACTED]
  src/main.js → src/skillUI.js

## Import Cycles
- None detected.

## Communities (12 total, 2 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.07
Nodes (43): Fixed-Timestep Game Loop, ensure(), playSfx(), SOUNDS, LEVELS, addImpactEffects(), applySkills(), cam (+35 more)

### Community 1 - "Chain"
Cohesion: 0.14
Nodes (3): center(), Chain, expand()

### Community 3 - "Player"
Cohesion: 0.07
Nodes (6): 현재 상태, Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump), Player

### Community 4 - "skillUI.js"
Cohesion: 0.57
Nodes (7): dim(), drawChoicePanel(), drawTreePanel(), hitTestTree(), text(), treeLayout(), wrapText()

### Community 5 - "deploy"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 6 - "[0.1.0] - 2026-11-24"
Cohesion: 0.12
Nodes (16): [0.1.0] - 2026-11-24, [0.2.0] - 2026-11-24, [0.3.0] - 2026-11-24, [0.3.1] - 2026-11-24, 기타, 바뀐 점, 바뀐 점, 바뀐 점 (+8 more)

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (12): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+4 more)

### Community 8 - "CLAUDE.md"
Cohesion: 0.25
Nodes (6): 기술 스택, 명령어, 버전 규칙, 컨셉, 코드 규칙, 폴더 구조

### Community 9 - "index.js"
Cohesion: 0.09
Nodes (25): #game Canvas 960x540, index.html Game Page, Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), ENEMIES, GAME, PLAYER, GAME_KEYS (+17 more)

### Community 10 - "SkillTree"
Cohesion: 0.20
Nodes (3): SKILLS, applyEffect(), SkillTree

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 109 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `main.js`, `index.js`, `Chain`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0730804810360777 - nodes in this community are weakly interconnected._
- **Why does `Chain` connect `Chain` to `index.js`, `Player`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `Chain` be split into smaller, more focused modules?**
  _Cohesion score 0.13548387096774195 - nodes in this community are weakly interconnected._
- **Why does `SkillTree` connect `SkillTree` to `main.js`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `Player` be split into smaller, more focused modules?**
  _Cohesion score 0.06636500754147813 - nodes in this community are weakly interconnected._