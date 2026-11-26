// 투사체 (분동 갈래의 '쳐내기' 대상). 적이 쏜 것은 플레이어를 맞히고, 쳐내 반사한 것은 적을 맞힌다.
// 아직 적이 투사체를 쏘지 않으므로 테스트용으로 P 키가 가장 가까운 적(없으면 앞쪽)에서 플레이어를 향해 하나 쏜다.
import { PLAYER, GAME } from './data/index.js';
import { emitTag } from './tags.js';
import { overlaps } from './physics.js';

const R = 6; // 그리기·판정 반지름(px)

export class Projectiles {
  constructor() {
    this.list = [];
    this.seq = 0;
  }

  // life: 날아갈 수 있는 시간(초). 기본은 무한 (원거리형은 사거리 / 탄속)
  spawn(x, y, vx, vy, owner = 'enemy', damage = 1, life = Infinity) {
    this.list.push({ x, y, vx, vy, owner, damage, life, id: `proj${++this.seq}` });
  }

  // 테스트용: 가장 가까운 적(없으면 플레이어 앞 300px)에서 플레이어를 향해 발사
  fireTest(player, enemies) {
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    let sx = px + player.facing * 300, sy = py;
    let best = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x + e.w / 2 - px, e.y + e.h / 2 - py);
      if (d < best) { best = d; sx = e.x + e.w / 2; sy = e.y + e.h / 2; }
    }
    const dx = px - sx, dy = py - sy, d = Math.hypot(dx, dy) || 1;
    const sp = PLAYER.chainWeapon.reflectSpeed * 0.6;
    this.spawn(sx, sy, (dx / d) * sp, (dy / d) * sp);
  }

  update(dt, player, enemies, world, hitstop) {
    const keep = [];
    for (const p of this.list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) continue; // 사거리 끝
      if (world.isSolid(Math.floor(p.x / GAME.tileSize), Math.floor(p.y / GAME.tileSize))) continue; // 지형에 막힘
      const box = { x: p.x - R, y: p.y - R, w: R * 2, h: R * 2 };
      if (p.x < -50 || p.y < -200 || p.x > world.pixelWidth + 50 || p.y > world.pixelHeight + 200) continue;
      if (p.owner === 'enemy') {
        if (player.tryDeflect(p)) continue; // 쳐냄(저장 또는 반사)
        if (overlaps(player, box)) { player.hurt(Math.sign(p.vx) || 1); continue; }
      } else {
        let hit = false;
        for (const e of enemies) {
          if (!e.alive || !overlaps(e, box)) continue;
          const W = player.stats.chainWeapon;
          e.takeHit(p.damage, Math.sign(p.vx) || 1, W.deflectKnockbackX, W.deflectKnockbackY, p.id);
          emitTag('reflectHit', { enemy: e, damage: p.damage, point: [p.x, p.y] });
          hitstop.t = Math.max(hitstop.t, 0.04);
          hit = true;
          break;
        }
        if (hit) continue;
      }
      keep.push(p);
    }
    this.list = keep;
  }

  draw(ctx, view) {
    for (const p of this.list) {
      ctx.fillStyle = p.owner === 'enemy' ? '#ff6b6b' : '#7dffb2';
      ctx.beginPath();
      ctx.arc(p.x - view.x, p.y - view.y, R, 0, Math.PI * 2);
      ctx.fill();
      // 빠른 탄: 진행 반대쪽으로 짧은 궤적선
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - view.x, p.y - view.y);
      ctx.lineTo(p.x - p.vx * 0.02 - view.x, p.y - p.vy * 0.02 - view.y);
      ctx.stroke();
    }
  }
}
