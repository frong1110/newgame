// 타일 기반 레벨. '#' = 땅, '.' = 빈칸, 'P' = 플레이어 시작 위치, 'E' = 테스트 적(더미), 'c' = 돌격형 적, 'a' = 원거리형 적,
// '=' = 한 방향 발판(위에서만 선다), 'D' = 다음 방으로 가는 문(적을 모두 잡으면 열림)
// 레벨 데이터는 src/data/levels/*.txt 에 있다.
import { GAME } from './data/index.js';

export class World {
  constructor(rows) {
    this.load(rows);
  }

  // 맵을 (다시) 읽는다. 방 전환 때 같은 World 객체를 그대로 쓰도록 제자리에서 바꾼다
  load(rows) {
    this.rows = rows;
    this.height = rows.length;
    this.width = rows[0].length;
    this.spawn = { x: 0, y: 0 };
    this.doors = []; // 문 사각형 { x, y, w, h }
    this.enemySpawns = []; // 적 위치와 종류 { x, y, type } (글자는 game.json 의 enemyChars)
    rows.forEach((row, ty) => {
      [...row].forEach((ch, tx) => {
        const pos = { x: tx * GAME.tileSize, y: ty * GAME.tileSize };
        if (ch === 'P') this.spawn = pos;
        else if (ch === 'D') this.doors.push({ ...pos, w: GAME.tileSize, h: GAME.tileSize });
        else if (GAME.enemyChars[ch]) this.enemySpawns.push({ ...pos, type: GAME.enemyChars[ch] }); // 'E' 더미, 'c' 돌격형 …
      });
    });
  }

  get pixelWidth() { return this.width * GAME.tileSize; }
  get pixelHeight() { return this.height * GAME.tileSize; }

  isSolid(tx, ty) {
    if (tx < 0 || tx >= this.width) return true; // 좌우 끝은 벽
    if (ty < 0 || ty >= this.height) return false; // 위/아래는 열림 (구멍으로 떨어질 수 있음)
    return this.rows[ty][tx] === '#';
  }

  // 한 방향 발판: 위에서 내려올 때만 선다 (아래·옆으로는 통과)
  isOneWay(tx, ty) {
    return ty >= 0 && ty < this.height && tx >= 0 && tx < this.width && this.rows[ty][tx] === '=';
  }

  draw(ctx, cam, doorsOpen = false) {
    const T = GAME.tileSize;
    const x0 = Math.max(0, Math.floor(cam.x / T));
    const x1 = Math.min(this.width, Math.ceil((cam.x + cam.w) / T) + 1);
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const ch = this.rows[ty][tx];
        const px = tx * T - cam.x;
        const py = ty * T - cam.y;
        if (ch === '=') {
          ctx.fillStyle = '#a8845c';
          ctx.fillRect(px, py, T, 8);
          continue;
        }
        if (ch === 'D') {
          ctx.fillStyle = doorsOpen ? '#7fd6ff' : '#555a66';
          ctx.fillRect(px + 4, py, T - 8, T);
          ctx.strokeStyle = '#222';
          ctx.strokeRect(px + 4.5, py + 0.5, T - 9, T - 1);
          continue;
        }
        if (ch !== '#') continue;
        const topExposed = !this.isSolid(tx, ty - 1);
        ctx.fillStyle = '#6b4f3a';
        ctx.fillRect(px, py, T, T);
        if (topExposed) {
          ctx.fillStyle = '#4caf50';
          ctx.fillRect(px, py, T, 8);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      }
    }
  }
}
