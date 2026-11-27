// 시작 화면(게임 시작 버튼 → 스테이지 선택)과 스테이지 이름 배너 그리기. 글자·목록은 game.json 의 stageMenu.
import { GAME } from './data/index.js';

// 버튼 사각형 (그리기와 클릭 판정이 같은 값을 쓴다)
export function startButtonRect(canvas) {
  return { x: canvas.width / 2 - 110, y: canvas.height / 2 + 20, w: 220, h: 56 };
}
export function stageButtonRect(canvas, i) {
  return { x: canvas.width / 2 - 200, y: canvas.height / 2 - 70 + i * 74, w: 400, h: 62 };
}
export function hitRect(r, p) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

function button(ctx, r, label, sub, active) {
  ctx.fillStyle = active ? '#2f6f8f' : 'rgba(255,255,255,0.08)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = active ? '#9fd8f0' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(label, r.x + r.w / 2, r.y + (sub ? 28 : r.h / 2 + 8));
  if (sub) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(sub, r.x + r.w / 2, r.y + 49);
  }
}

// page: 'title' | 'select'
export function drawMenu(ctx, canvas, page, cursor) {
  ctx.fillStyle = '#14181d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  if (page === 'title') {
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('사슬 로그라이트', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('프로토타입', canvas.width / 2, canvas.height / 2 - 12);
    button(ctx, startButtonRect(canvas), '게임 시작', null, true);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Enter / Space / 클릭', canvas.width / 2, canvas.height / 2 + 100);
  } else {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('스테이지 선택', canvas.width / 2, canvas.height / 2 - 100);
    GAME.stageMenu.forEach((s, i) => button(ctx, stageButtonRect(canvas, i), s.name, s.sub, i === cursor));
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('↑↓ 선택 · Enter 시작 · Esc 뒤로', canvas.width / 2, canvas.height / 2 - 70 + GAME.stageMenu.length * 74 + 14);
  }
  ctx.textAlign = 'left';
}

// 스테이지 시작 배너: 서서히 나타났다 사라진다. intro = { name, sub, t(남은 시간), total }
export function drawStageIntro(ctx, canvas, intro) {
  const k = intro.t / intro.total; // 1 → 0
  const fade = Math.min(1, (1 - k) / 0.15, k / 0.25);
  ctx.fillStyle = `rgba(0,0,0,${0.55 * fade})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(intro.name, canvas.width / 2, canvas.height / 2);
  if (intro.sub) {
    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(intro.sub, canvas.width / 2, canvas.height / 2 + 34);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
