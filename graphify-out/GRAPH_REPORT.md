# Graph Report - newgame  (2026-11-23)

## Corpus Check
- 12 files · ~2,294 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 103 nodes · 133 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5b55257`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Main Game State
- Tile World
- HTML Page & Canvas
- Player
- player.js
- deploy
- deploy.yml
- package.json
- CLAUDE.md
- index.js

## God Nodes (most connected - your core abstractions)
1. `Player` - 8 edges
2. `World` - 7 edges
3. `Prototype v0.1 (Move / Jump / Double Jump)` - 7 edges
4. `index.html Game Page` - 6 edges
5. `deploy` - 5 edges
6. `permissions` - 4 edges
7. `steps` - 4 edges
8. `with` - 4 edges
9. `scripts` - 4 edges
10. `GAME` - 4 edges

## Surprising Connections (you probably didn't know these)
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "Main Game State"
Cohesion: 0.21
Nodes (11): Fixed-Timestep Game Loop, cam, clamp(), ctx, frame(), last, player, puffs (+3 more)

### Community 2 - "HTML Page & Canvas"
Cohesion: 0.50
Nodes (3): #game Canvas 960x540, index.html Game Page, canvas

### Community 3 - "Player"
Cohesion: 0.24
Nodes (6): Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump), approach(), Player

### Community 4 - "player.js"
Cohesion: 0.24
Nodes (8): Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), PLAYER, down, GAME_KEYS, Input, pressed, released

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

## Knowledge Gaps
- **1 isolated node(s):** `String Tilemap Level (# ground, P spawn)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 52 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `Main Game State`, `player.js`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `String Tilemap Level (# ground, P spawn)` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `jobs` connect `deploy` to `deploy.yml`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `World` connect `Tile World` to `Main Game State`, `index.js`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._