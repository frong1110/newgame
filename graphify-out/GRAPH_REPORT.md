# Graph Report - newgame  (2026-11-23)

## Corpus Check
- 15 files · ~4,618 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 137 nodes · 200 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b86cb456`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- Tile World
- Enemy
- Player
- deploy
- deploy.yml
- package.json
- CLAUDE.md
- index.js

## God Nodes (most connected - your core abstractions)
1. `Player` - 23 edges
2. `Enemy` - 10 edges
3. `moveAndCollide()` - 8 edges
4. `World` - 7 edges
5. `Prototype v0.1 (Move / Jump / Double Jump)` - 7 edges
6. `GAME` - 6 edges
7. `index.html Game Page` - 6 edges
8. `deploy` - 5 edges
9. `approach()` - 5 edges
10. `permissions` - 4 edges

## Surprising Connections (you probably didn't know these)
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js
- `enemies` --calls--> `Enemy`  [EXTRACTED]
  src/main.js → src/enemy.js
- `resolveCombat()` --calls--> `overlaps()`  [EXTRACTED]
  src/main.js → src/physics.js

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.11
Nodes (23): #game Canvas 960x540, index.html Game Page, Fixed-Timestep Game Loop, Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), down, GAME_KEYS, Input (+15 more)

### Community 3 - "Player"
Cohesion: 0.11
Nodes (5): Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump), Player

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
Cohesion: 0.21
Nodes (9): ENEMIES, GAME, LEVELS, PLAYER, approach(), moveAndCollide(), resolveX(), resolveY() (+1 more)

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 63 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `main.js`, `index.js`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10826210826210826 - nodes in this community are weakly interconnected._
- **Why does `Enemy` connect `Enemy` to `main.js`, `index.js`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Player` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Why does `World` connect `Tile World` to `main.js`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._