// 타일 기반 레벨. '#' = 땅, '.' = 빈칸, 'P' = 플레이어 시작 위치
const LEVEL = [
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '...........................................#####..............',
  '..............................................................',
  '.....................######...................................',
  '...................................####.......................',
  '..............................................................',
  '.............####.........................................###.',
  '..........................................#####...............',
  '..P...................####....................................',
  '..............................................................',
  '.......###..........................#####............#####....',
  '..............................................................',
  '##############....######.....###########....##################',
  '##############....######.....###########....##################',
];

class World {
  constructor(rows) {
    this.rows = rows;
    this.height = rows.length;
    this.width = rows[0].length;
    this.spawn = { x: 0, y: 0 };
    rows.forEach((row, ty) => {
      const tx = row.indexOf('P');
      if (tx >= 0) this.spawn = { x: tx * CONFIG.TILE, y: ty * CONFIG.TILE };
    });
  }

  get pixelWidth() { return this.width * CONFIG.TILE; }
  get pixelHeight() { return this.height * CONFIG.TILE; }

  isSolid(tx, ty) {
    if (tx < 0 || tx >= this.width) return true; // 좌우 끝은 벽
    if (ty < 0 || ty >= this.height) return false; // 위/아래는 열림 (구멍으로 떨어질 수 있음)
    return this.rows[ty][tx] === '#';
  }

  draw(ctx, cam) {
    const T = CONFIG.TILE;
    const x0 = Math.max(0, Math.floor(cam.x / T));
    const x1 = Math.min(this.width, Math.ceil((cam.x + cam.w) / T) + 1);
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        if (this.rows[ty][tx] !== '#') continue;
        const px = tx * T - cam.x;
        const py = ty * T - cam.y;
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
