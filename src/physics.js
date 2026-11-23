// 타일맵과의 충돌 처리. {x, y, w, h, vx, vy} 를 가진 모든 몸체(플레이어, 적)가 공유한다.
import { GAME } from './data/index.js';

// 속도만큼 이동시키고 벽/바닥/천장과 충돌을 해결한다.
// 결과로 body.onGround, body.hitWall 이 갱신된다.
export function moveAndCollide(body, world, dt) {
  body.x += body.vx * dt;
  body.hitWall = resolveX(body, world);
  body.y += body.vy * dt;
  body.onGround = false;
  resolveY(body, world);
}

function resolveX(b, world) {
  const T = GAME.tileSize;
  const top = Math.floor(b.y / T);
  const bottom = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w) / T);
    for (let ty = top; ty <= bottom; ty++) {
      if (world.isSolid(tx, ty)) { b.x = tx * T - b.w; b.vx = 0; return true; }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = top; ty <= bottom; ty++) {
      if (world.isSolid(tx, ty)) { b.x = (tx + 1) * T; b.vx = 0; return true; }
    }
  }
  return false;
}

function resolveY(b, world) {
  const T = GAME.tileSize;
  const left = Math.floor(b.x / T);
  const right = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h) / T);
    for (let tx = left; tx <= right; tx++) {
      if (world.isSolid(tx, ty)) { b.y = ty * T - b.h; b.vy = 0; b.onGround = true; return; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T);
    for (let tx = left; tx <= right; tx++) {
      if (world.isSolid(tx, ty)) { b.y = (ty + 1) * T; b.vy = 0; return; }
    }
  }
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  return Math.max(value - delta, target);
}
