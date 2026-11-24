# Graph Report - newgame  (2026-11-24)

## Corpus Check
- 31 files · ~20,173 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 321 nodes · 593 edges · 15 communities (8 shown, 7 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.89)
- Token cost: 101,667 input · 0 output

## Graph Freshness
- Built from commit: `ac68c30f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 게임 루프·화면 그리기 (main.js)
- PlayerWeapon
- 배포 워크플로 (GitHub Actions)
- 사슬 스킬 설계·변경 기록
- 던지는 사슬 (Chain)
- 데이터 진입점·사슬 이동 규칙
- World
- 스킬 트리 로직
- 적 (Enemy)
- 패키지·빌드 설정
- 입력·모바일 버튼
- Effects
- PlayerDash
- PlayerSlam
- overlaps

## God Nodes (most connected - your core abstractions)
1. `Chain` - 32 edges
2. `PlayerWeapon` - 25 edges
3. `Enemy` - 19 edges
4. `SkillTree` - 17 edges
5. `center()` - 14 edges
6. `GAME` - 14 edges
7. `moveAndCollide()` - 14 edges
8. `Effects` - 11 edges
9. `update()` - 11 edges
10. `overlaps()` - 11 edges

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
- **Mobile touch support (CSS, virtual input, button mapping)** — index_touch_controls_css, claude_mobile_virtual_input, readme_mobile_buttons, index_portrait_rotate_notice [INFERRED 0.85]
- **Tip damage balance (Weight Tuning risk, tip formula, swing)** — changelog_tip_bonus_multiplier, claude_tip_damage_formula, claude_weight_tuning, claude_chain_weapon_swing [INFERRED 0.85]

## Communities (15 total, 7 thin omitted)

### Community 0 - "게임 루프·화면 그리기 (main.js)"
Cohesion: 0.09
Nodes (42): center(), drawBindChains(), drawChainLine(), installBindHooks(), playerHand(), updateTethers(), drawHUD(), drawVersion() (+34 more)

### Community 2 - "배포 워크플로 (GitHub Actions)"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 3 - "사슬 스킬 설계·변경 기록"
Cohesion: 0.06
Nodes (38): CHANGELOG.md (변경 기록), Chain Extend (removed weight tier-1 skill), tipBonusMultiplier (Weight Tuning risk), Tip-hit flash effect and SFX, v0.1.0 - Prototype 1 (feel) baseline, v0.2.0 - Bind branch complete, v0.3.0 - Weight Tuning replaces Chain Extend, v0.3.1 - Weight branch balance (+30 more)

### Community 4 - "던지는 사슬 (Chain)"
Cohesion: 0.12
Nodes (3): center(), Chain, Player

### Community 5 - "데이터 진입점·사슬 이동 규칙"
Cohesion: 0.12
Nodes (17): expand(), ATTACK_KEY, DASH_KEYS, SPECIAL_KEY, ENEMIES, GAME, LEVELS, PLAYER (+9 more)

### Community 9 - "패키지·빌드 설정"
Cohesion: 0.14
Nodes (12): devDependencies, vite@^8.3.8, name, private, scripts, build, dev, preview (+4 more)

### Community 10 - "입력·모바일 버튼"
Cohesion: 0.28
Nodes (8): GAME_KEYS, isDown(), keyDown, press(), pressed, release(), released, virtualDown

### Community 14 - "overlaps"
Cohesion: 0.39
Nodes (6): ensure(), playSfx(), SOUNDS, resolveCombat(), resolveSlam(), overlaps()

## Knowledge Gaps
- **7 isolated node(s):** `Chain Extend (removed weight tier-1 skill)`, `Airborne state (enemy.flight)`, `Not yet: player HP/death, distinct rooms, 2nd enemy, Whip Storm, tuning panel`, `window.__game dev-only debug handle`, `v0.1.0 - Prototype 1 (feel) baseline` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Chain` connect `던지는 사슬 (Chain)` to `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `Chain Extend (removed weight tier-1 skill)`, `Airborne state (enemy.flight)`, `Not yet: player HP/death, distinct rooms, 2nd enemy, Whip Storm, tuning panel` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `게임 루프·화면 그리기 (main.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.08687943262411348 - nodes in this community are weakly interconnected._
- **Why does `PlayerWeapon` connect `PlayerWeapon` to `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Should `PlayerWeapon` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._
- **Why does `CLAUDE.md (project instructions)` connect `사슬 스킬 설계·변경 기록` to `데이터 진입점·사슬 이동 규칙`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `배포 워크플로 (GitHub Actions)` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._