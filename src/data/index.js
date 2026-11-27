// 모든 게임 수치·레벨 데이터의 진입점. 코드에서는 여기서만 가져온다.
import player from './player.json';
import game from './game.json';
import enemies from './enemies.json';
import skills from './skills.json';
import tags from './tags.json';
import difficulty from './difficulty.json';
import level1 from './levels/level1.txt?raw';
import bind from './levels/bind.txt?raw';
import cells from './levels/cells.txt?raw';
import pit from './levels/pit.txt?raw';
import labor from './levels/labor.txt?raw';
import gallery from './levels/gallery.txt?raw';

export const PLAYER = player;
export const GAME = game;
export const ENEMIES = enemies;
export const SKILLS = skills;
export const TAGS = tags;
export const DIFFICULTY = difficulty; // 난이도 단계(level)와 단계별 배율. main.js 가 주소의 ?difficulty=N 으로 level 을 정한다
export const LEVELS = {
  level1: level1.trim().split(/\r?\n/), // 기본 시험장 (회귀 재생 기준: ?level=level1)
  bind: bind.trim().split(/\r?\n/), // 결박 갈래 시험장 (기본 맵)
  // 버려진 감옥 방 조각 4개 (문이 있는 방). 한 방만 보려면 ?level=cells 처럼, 차례로 이어서는 ?level=stage1 (game.json 의 stages)
  cells: cells.trim().split(/\r?\n/), // 독방 복도 (근접형)
  pit: pit.trim().split(/\r?\n/), // 철창 통로 (돌격형·근접형·원거리형, 구덩이, 발판)
  labor: labor.trim().split(/\r?\n/), // 노역장 (돌격형·근접형 무리, 오른쪽 구역에 원거리형)
  gallery: gallery.trim().split(/\r?\n/), // 사격 회랑 (원거리형 발판 4단)
};
