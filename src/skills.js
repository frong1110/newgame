// 스킬 트리. 스킬은 src/data/skills.json 에 데이터로 정의하고,
// 각 스킬의 effects 가 플레이어 기본 수치(player.json)를 바꾼다.
//   effect: { stat: "dash.speed", op: "mul" | "add" | "set", value }
// 한 판(run) 동안 쌓이고, 죽으면(reset) 초기화된다.
import { SKILLS } from './data/index.js';

export class SkillTree {
  constructor(baseStats) {
    this.baseStats = baseStats;
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

  // 선행 스킬을 모두 가졌고 아직 안 배운 스킬
  isLearnable(id) {
    const s = this.byId[id];
    return !this.owned.has(id) && s.requires.every((r) => this.owned.has(r));
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
