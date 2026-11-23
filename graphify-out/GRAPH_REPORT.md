# Graph Report - newgame  (2026-11-23)

## Corpus Check
- 19 files · ~8,887 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 202 nodes · 348 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `11b3f131`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- Chain
- Enemy
- Player
- input.js
- deploy
- deploy.yml
- package.json
- CLAUDE.md
- index.js
- SkillTree

## God Nodes (most connected - your core abstractions)
1. `Player` - 26 edges
2. `Chain` - 24 edges
3. `SkillTree` - 14 edges
4. `Enemy` - 10 edges
5. `moveAndCollide()` - 10 edges
6. `center()` - 9 edges
7. `update()` - 8 edges
8. `GAME` - 7 edges
9. `drawTreePanel()` - 7 edges
10. `World` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `enemies` --calls--> `Enemy`  [EXTRACTED]
  src/main.js → src/enemy.js
- `resolveCombat()` --calls--> `overlaps()`  [EXTRACTED]
  src/main.js → src/physics.js
- `updateTree()` --calls--> `hitTestTree()`  [EXTRACTED]
  src/main.js → src/skillUI.js

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.12
Nodes (30): Fixed-Timestep Game Loop, applySkills(), cam, choices, clamp(), ctx, frame(), last (+22 more)

### Community 1 - "Chain"
Cohesion: 0.15
Nodes (3): center(), Chain, expand()

### Community 3 - "Player"
Cohesion: 0.09
Nodes (5): Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump), Player

### Community 4 - "input.js"
Cohesion: 0.12
Nodes (11): #game Canvas 960x540, index.html Game Page, Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), down, GAME_KEYS, Input, pressed (+3 more)

### Community 5 - "deploy"
Cohesion: 0.12
Nodes (18): runs-on, steps, environment, needs, runs-on, steps, name, url (+10 more)

### Community 6 - "deploy.yml"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 7 - "package.json"
Cohesion: 0.17
Nodes (11): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+3 more)

### Community 8 - "CLAUDE.md"
Cohesion: 0.25
Nodes (6): 기술 스택, 명령어, 컨셉, 코드 규칙, 폴더 구조, 현재 상태

### Community 9 - "index.js"
Cohesion: 0.19
Nodes (10): ENEMIES, GAME, LEVELS, PLAYER, approach(), moveAndCollide(), overlaps(), resolveX() (+2 more)

### Community 10 - "SkillTree"
Cohesion: 0.22
Nodes (3): SKILLS, applyEffect(), SkillTree

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `main.js`, `index.js`, `Chain`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Why does `Chain` connect `Chain` to `index.js`, `Player`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `Player` be split into smaller, more focused modules?**
  _Cohesion score 0.09425287356321839 - nodes in this community are weakly interconnected._
- **Why does `SkillTree` connect `SkillTree` to `main.js`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `input.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._