# Graph Report - newgame  (2026-11-24)

## Corpus Check
- Corpus is ~18,983 words - fits in a single context window. You may not need a graph.

## Summary
- 296 nodes · 544 edges · 11 communities (7 shown, 4 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.89)
- Token cost: 101,667 input · 0 output

## Community Hubs (Navigation)
- 게임 루프·화면 그리기 (main.js)
- 플레이어 (이동·공격·내리꽂기)
- 배포 워크플로 (GitHub Actions)
- 사슬 스킬 설계·변경 기록
- 던지는 사슬 (Chain)
- 데이터 진입점·사슬 이동 규칙
- 프로젝트 문서·규칙·화면
- 스킬 트리 로직
- 적 (Enemy)
- 패키지·빌드 설정
- 입력·모바일 버튼

## God Nodes (most connected - your core abstractions)
1. `Player` - 49 edges
2. `Chain` - 32 edges
3. `Enemy` - 18 edges
4. `SkillTree` - 17 edges
5. `center()` - 14 edges
6. `moveAndCollide()` - 12 edges
7. `GAME` - 11 edges
8. `overlaps()` - 11 edges
9. `update()` - 9 edges
10. `World` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Tip-hit flash effect and SFX` --references--> `GAME`  [INFERRED]
  CHANGELOG.md → src/data/index.js
- `Room clear loop (pickOnRoomClear: false)` --references--> `SKILLS`  [INFERRED]
  CLAUDE.md → src/data/index.js
- `Skill effect format {stat, op: mul|add|set, value} over this.stats` --references--> `SKILLS`  [INFERRED]
  CLAUDE.md → src/data/index.js
- `Skill tree rule: 3 branches x 3 tiers per weapon, implemented:false = coming soon` --references--> `SKILLS`  [INFERRED]
  CLAUDE.md → src/data/index.js
- `Enemy.hooks.onBoundDamaged / onBoundDied, enemy.bindAnchor` --references--> `Enemy`  [EXTRACTED]
  CLAUDE.md → src/enemy.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chain weapon skill tree (bind, throw, weight branches)** — claude_bind_branch, claude_throw_branch, claude_weight_branch, claude_skill_tree_rule [EXTRACTED 1.00]
- **Tip damage balance (Weight Tuning risk, tip formula, swing)** — changelog_tip_bonus_multiplier, claude_tip_damage_formula, claude_weight_tuning, claude_chain_weapon_swing [INFERRED 0.85]
- **Mobile touch support (CSS, virtual input, button mapping)** — index_touch_controls_css, claude_mobile_virtual_input, readme_mobile_buttons, index_portrait_rotate_notice [INFERRED 0.85]

## Communities (11 total, 4 thin omitted)

### Community 0 - "게임 루프·화면 그리기 (main.js)"
Cohesion: 0.08
Nodes (45): addImpactEffects(), applySkills(), cam, canvas, center(), choices, clamp(), ctx (+37 more)

### Community 2 - "배포 워크플로 (GitHub Actions)"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 3 - "사슬 스킬 설계·변경 기록"
Cohesion: 0.07
Nodes (25): Chain Extend (removed weight tier-1 skill), tipBonusMultiplier (Weight Tuning risk), Tip-hit flash effect and SFX, v0.2.0 - Bind branch complete, v0.3.0 - Weight Tuning replaces Chain Extend, v0.3.1 - Weight branch balance, Bind branch: Wrap -> Link -> Chain Prison, Chain weapon 3-hit swing combo with tip (weight) bonus (+17 more)

### Community 5 - "데이터 진입점·사슬 이동 규칙"
Cohesion: 0.15
Nodes (14): expand(), ENEMIES, GAME, LEVELS, PLAYER, level1.txt tilemap (62x17), level1 layout: P start at (2,11), 4 enemies E, ground with 3 pits, floating platforms, approach() (+6 more)

### Community 6 - "프로젝트 문서·규칙·화면"
Cohesion: 0.11
Nodes (15): CHANGELOG.md (변경 기록), v0.1.0 - Prototype 1 (feel) baseline, CLAUDE.md (project instructions), Controls (arrows, Space, X, C, Shift, K, R, Q), Not yet: player HP/death, distinct rooms, 2nd enemy, Whip Storm, tuning panel, Tech stack: JS ES modules, Canvas 2D, Vite 8, Node 22, GitHub Pages, window.__game dev-only debug handle, index.html (entry page) (+7 more)

### Community 9 - "패키지·빌드 설정"
Cohesion: 0.14
Nodes (12): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+4 more)

### Community 10 - "입력·모바일 버튼"
Cohesion: 0.21
Nodes (11): GAME_KEYS, Input, isDown(), keyDown, press(), pressed, release(), released (+3 more)

## Knowledge Gaps
- **7 isolated node(s):** `v0.1.0 - Prototype 1 (feel) baseline`, `Chain Extend (removed weight tier-1 skill)`, `Design docs: 1-person dev roadmap, Weapon/Augment design (Claude Docs)`, `window.__game dev-only debug handle`, `Airborne state (enemy.flight)` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 97 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `플레이어 (이동·공격·내리꽂기)` to `게임 루프·화면 그리기 (main.js)`, `사슬 스킬 설계·변경 기록`, `던지는 사슬 (Chain)`, `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **What connects `v0.1.0 - Prototype 1 (feel) baseline`, `Chain Extend (removed weight tier-1 skill)`, `Design docs: 1-person dev roadmap, Weapon/Augment design (Claude Docs)` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `게임 루프·화면 그리기 (main.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.0797872340425532 - nodes in this community are weakly interconnected._
- **Why does `Chain` connect `던지는 사슬 (Chain)` to `플레이어 (이동·공격·내리꽂기)`, `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Should `플레이어 (이동·공격·내리꽂기)` be split into smaller, more focused modules?**
  _Cohesion score 0.07493061979648474 - nodes in this community are weakly interconnected._
- **Why does `CLAUDE.md (project instructions)` connect `프로젝트 문서·규칙·화면` to `사슬 스킬 설계·변경 기록`, `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `배포 워크플로 (GitHub Actions)` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._