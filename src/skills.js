// 스킬 트리. 스킬은 src/data/skills.json 에 데이터로 정의하고,
// 각 스킬의 effects 가 플레이어 기본 수치(player.json)를 바꾼다.
//   effect: { stat: "dash.speed", op: "mul" | "add" | "set", value }
// 한 판(run) 동안 쌓이고, 죽으면(reset) 초기화된다.
import { SKILLS } from './data/index.js';

export class SkillTree {
  constructor(baseStats) {
    this.baseStats = baseStats;
    this.weapon = baseStats.weapon; // 주 무기 (판 시작 때 정함. 테스트용으로 트리 화면에서 바꿀 수 있음)
    this.trees = SKILLS.trees;
    this.byId = {};
    for (const [treeId, tree] of Object.entries(this.trees)) {
      for (const skill of tree.skills) this.byId[skill.id] = { ...skill, tree: treeId };
    }
    this.reset();
  }

  reset() {
    this.owned = new Set();
    this.stats = this.computeStats();
  }

  has(id) {
    return this.owned.has(id);
  }

  // 설계만 있고 아직 동작이 없는 스킬 (트리에 '준비 중'으로 보임)
  isImplemented(id) {
    return this.byId[id].implemented !== false;
  }

  // 선행 스킬을 모두 가졌고 아직 안 배운, 구현된 스킬
  isLearnable(id) {
    const s = this.byId[id];
    return this.isImplemented(id) && !this.owned.has(id) && s.requires.every((r) => this.owned.has(r));
  }

  setWeapon(weapon) {
    this.weapon = weapon;
    this.stats = this.computeStats();
  }

  learnable() {
    return Object.keys(this.byId).filter((id) => this.isLearnable(id));
  }

  learn(id) {
    if (!this.isLearnable(id)) return false;
    this.owned.add(id);
    this.stats = this.computeStats();
    return true;
  }

  // 테스트용: 선행 스킬까지 한 번에 배우기
  learnWithRequirements(id) {
    if (!this.isImplemented(id)) return false;
    for (const r of this.byId[id].requires) if (!this.owned.has(r)) this.learnWithRequirements(r);
    return this.learn(id);
  }

  // 테스트용: 스킬과, 그 스킬이 있어야 하는 스킬들까지 해제
  unlearn(id) {
    if (!this.owned.has(id)) return false;
    this.owned.delete(id);
    for (const other of [...this.owned]) {
      if (this.byId[other].requires.includes(id)) this.unlearn(other);
    }
    this.stats = this.computeStats();
    return true;
  }

  // 스킬 트리 화면에서 누를 때: 있으면 해제, 없으면 (선행 스킬 포함) 배우기
  toggle(id) {
    return this.owned.has(id) ? this.unlearn(id) : this.learnWithRequirements(id);
  }

  // 트리 화면에 그리는 순서대로 나열한 스킬 id (page: 0 무기·이동 트리, 1 공용 증강 태그)
  orderedIds(page = 0) {
    return Object.values(this.trees).filter((t) => (t.page ?? 0) === page).flatMap((t) => t.skills.map((s) => s.id));
  }

  // 배울 수 있는 스킬 중 무작위 후보 (최대 choiceCount 개)
  randomChoices(rng = Math.random) {
    const pool = this.learnable();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SKILLS.choiceCount).map((id) => this.byId[id]);
  }

  // 기본 수치에 보유 스킬 효과를 순서대로 적용한 새 수치 객체
  computeStats() {
    const stats = structuredClone(this.baseStats);
    stats.weapon = this.weapon;
    for (const id of this.owned) {
      for (const e of this.byId[id].effects) applyEffect(stats, e);
    }
    return stats;
  }
}

function applyEffect(stats, { stat, op, value }) {
  const keys = stat.split('.');
  const last = keys.pop();
  const target = keys.reduce((obj, k) => obj[k], stats);
  if (!(last in target)) throw new Error(`skills.json: 알 수 없는 수치 "${stat}"`);
  if (op === 'add') target[last] += value;
  else if (op === 'mul') target[last] *= value;
  else if (op === 'set') target[last] = value;
  else throw new Error(`skills.json: 알 수 없는 op "${op}"`);
}
