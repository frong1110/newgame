# Graph Report - newgame  (2026-11-23)

## Corpus Check
- Corpus is ~1,688 words - fits in a single context window. You may not need a graph.

## Summary
- 43 nodes · 60 edges · 12 communities (5 shown, 7 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Main Game State
- Tile World
- HTML Page & Canvas
- Controls & Jump Features
- Level Data & Docs
- Player Lifecycle & Drawing
- Frame Loop & Rendering
- Tuning Config
- Keyboard Input
- Update Step & Camera Clamp
- Player Module Helpers

## God Nodes (most connected - your core abstractions)
1. `Prototype v0.1 (Move / Jump / Double Jump)` - 8 edges
2. `Player` - 7 edges
3. `index.html Game Page` - 7 edges
4. `World` - 6 edges
5. `frame()` - 4 edges
6. `Controls (Arrows / Space / R)` - 4 edges
7. `update()` - 3 edges
8. `canvas` - 2 edges
9. `render()` - 2 edges
10. `clamp()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `canvas` --references--> `#game Canvas 960x540`  [INFERRED]
  src/main.js → index.html
- `Fixed-Timestep Game Loop` --implements--> `frame()`  [INFERRED]
  README.md → src/main.js
- `String Tilemap Level (# ground, P spawn)` --implements--> `LEVEL`  [INFERRED]
  README.md → src/world.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Jump Mechanics** — readme_double_jump, readme_variable_jump_height, src_player_player_update, src_config_config [INFERRED 0.85]

## Communities (12 total, 7 thin omitted)

### Community 0 - "Main Game State"
Cohesion: 0.29
Nodes (6): cam, ctx, last, player, puffs, world

### Community 2 - "HTML Page & Canvas"
Cohesion: 0.50
Nodes (3): #game Canvas 960x540, index.html Game Page, canvas

### Community 3 - "Controls & Jump Features"
Cohesion: 0.50
Nodes (4): Controls (Arrows / Space / R), Double Jump, Respawn (R key), Variable Jump Height (short press = low jump)

### Community 4 - "Level Data & Docs"
Cohesion: 0.67
Nodes (3): Prototype v0.1 (Move / Jump / Double Jump), String Tilemap Level (# ground, P spawn), LEVEL

### Community 6 - "Frame Loop & Rendering"
Cohesion: 0.67
Nodes (3): Fixed-Timestep Game Loop, frame(), render()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Prototype v0.1 (Move / Jump / Double Jump)` connect `Level Data & Docs` to `Main Game State`, `Controls & Jump Features`, `Frame Loop & Rendering`, `Tuning Config`, `Keyboard Input`, `Player Module Helpers`?**
  _High betweenness centrality (0.449) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `frame()` (e.g. with `Fixed-Timestep Game Loop` and `main.js`) actually correct?**
  _`frame()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Why does `index.html Game Page` connect `HTML Page & Canvas` to `Main Game State`, `Level Data & Docs`, `Tuning Config`, `Keyboard Input`, `Player Module Helpers`?**
  _High betweenness centrality (0.301) - this node is a cross-community bridge._
- **Why does `World` connect `Tile World` to `Level Data & Docs`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._