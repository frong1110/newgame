// 모든 게임 수치·레벨 데이터의 진입점. 코드에서는 여기서만 가져온다.
import player from './player.json';
import game from './game.json';
import enemies from './enemies.json';
import skills from './skills.json';
import level1 from './levels/level1.txt?raw';

export const PLAYER = player;
export const GAME = game;
export const ENEMIES = enemies;
export const SKILLS = skills;
export const LEVELS = {
  level1: level1.trim().split(/\r?\n/),
};
