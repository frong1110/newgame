// 하단 HUD 슬롯 (설계안 '하단 HUD'): 화면 아래 가운데에 공격(X) · 당기기(C) · 대시(Shift) 3칸.
// 칸마다 아이콘, 오른쪽 아래 키, 재사용 대기 중에는 어두운 부채꼴과 남은 초, 마우스를 올리면 툴팁(이름·키·설명·쿨타임).
//   공격: 짧게 누르면 기본 공격(쿨타임 없음). 회전 차지 스킬이 있으면 차징 공격을 쓴 뒤 chargeCooldown 동안 슬롯에 쿨타임, 차지 중엔 칸 아래에 게이지
//   당기기: pullChain.cooldown. 대시: 사슬 대시면 충전 수 배지(왼쪽 위)와, 충전이 0일 때만 부채꼴·숫자
// 이름·키·설명은 game.json 의 hudSlots, 쿨타임은 플레이어 수치에서 읽는다.
import { GAME } from './data/index.js';

const SIZE = 60, GAP = 14, BOTTOM = 22;

function layout(canvas) {
  const n = GAME.hudSlots.length;
  const total = n * SIZE + (n - 1) * GAP;
  return GAME.hudSlots.map((s, i) => ({ ...s, x: canvas.width / 2 - total / 2 + i * (SIZE + GAP), y: canvas.height - BOTTOM - SIZE }));
}

// 슬롯 하나의 현재 상태 { cd(남은 초), total(전체 초), gauge(0~1 또는 null), badge(숫자 또는 null), dim, active, extra(툴팁 쿨타임 줄) }
function stateOf(id, p) {
  const W = p.weapon;
  if (id === 'attack') {
    const cdOn = p.usesChainWeapon && p.chargeOn && W.chargeCooldown > 0;
    return {
      cd: cdOn ? Math.max(0, p.chargeCooldownTimer) : 0,
      total: cdOn ? W.chargeCooldown : 0,
      gauge: p.charging ? p.chargeLevel : null,
      active: p.attackTimer > 0 || p.charging,
      extra: cdOn ? `쿨타임: 기본 공격 없음 / 차징 공격 ${W.chargeCooldown}초` : '쿨타임: 없음',
    };
  }
  if (id === 'pull') {
    const C = p.stats.pullChain;
    return {
      cd: Math.max(0, p.specialCooldownTimer),
      total: C.cooldown,
      dim: !p.usesChainWeapon,
      active: p.pullChain.active || p.flail.active,
      extra: `쿨타임: ${C.cooldown}초 (같은 적은 ${C.repullLock}초간 다시 못 당김)`,
    };
  }
  const D = p.stats.dash;
  if (p.usesChain) {
    const C = p.stats.chain;
    const empty = p.dashCharges <= 0;
    return {
      cd: empty ? Math.max(0, p.dashChargeTimer) : 0,
      total: C.rechargeTime,
      badge: p.dashChargeMax > 1 ? p.dashCharges : null,
      active: p.chain.active,
      extra: `쿨타임: ${C.rechargeTime.toFixed(2)}초 · 충전 ${p.dashChargeMax}회`,
    };
  }
  const airOut = !p.onGround && p.airDashesUsed >= D.maxAirDashes;
  return { cd: Math.max(0, p.dashCooldownTimer), total: D.cooldown, dim: airOut, active: p.dashTimer > 0, extra: `쿨타임: ${D.cooldown}초 (공중 ${D.maxAirDashes}회)` };
}

function icon(ctx, id, cx, cy, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (id === 'attack') { // 휘두르는 사슬 궤적 + 분동
    ctx.arc(cx - 6, cy + 8, 20, -1.2, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 13, cy + 1, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'pull') { // 갈고리
    ctx.moveTo(cx - 16, cy + 12);
    ctx.lineTo(cx + 6, cy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 2, 8, -2.2, 1.2);
    ctx.stroke();
  } else { // 대시: 화살표 두 개
    for (const o of [-8, 6]) {
      ctx.moveTo(cx + o - 6, cy - 12);
      ctx.lineTo(cx + o + 6, cy);
      ctx.lineTo(cx + o - 6, cy + 12);
    }
    ctx.stroke();
  }
}

function wrap(ctx, text, x, y, maxW, lh) {
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lh;
    } else line += ch;
  }
  ctx.fillText(line, x, y);
  return y;
}

// 캔버스 위 마우스 위치(캔버스 좌표)를 따라가는 함수를 돌려준다
export function trackHudMouse(canvas) {
  let m = null;
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    m = { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  });
  canvas.addEventListener('mouseleave', () => { m = null; });
  return () => m;
}

// mouse: 캔버스 좌표의 마우스 위치(없으면 null) — 칸 위면 툴팁을 그린다
export function drawHudSlots(ctx, canvas, player, mouse) {
  let hovered = null;
  for (const s of layout(canvas)) {
    const st = stateOf(s.id, player);
    const { x, y } = s;
    ctx.globalAlpha = st.dim ? 0.45 : 1;
    ctx.fillStyle = 'rgba(15,20,28,0.78)';
    ctx.fillRect(x, y, SIZE, SIZE);
    ctx.strokeStyle = st.active ? '#9fe6ff' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, SIZE - 2, SIZE - 2);
    icon(ctx, s.id, x + SIZE / 2, y + SIZE / 2, st.active ? '#ffffff' : '#cfd8e3');
    ctx.globalAlpha = 1;
    // 쿨타임: 남은 비율만큼 어두운 부채꼴 + 남은 초
    if (st.cd > 0 && st.total > 0) {
      const k = Math.min(1, st.cd / st.total);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, SIZE, SIZE);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x + SIZE / 2, y + SIZE / 2);
      ctx.arc(x + SIZE / 2, y + SIZE / 2, SIZE, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.cd >= 10 ? Math.ceil(st.cd) : st.cd.toFixed(1), x + SIZE / 2, y + SIZE / 2 + 6);
    }
    // 키 (오른쪽 아래)
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffcc4d';
    ctx.fillText(s.key, x + SIZE - 5, y + SIZE - 5);
    // 충전 배지 (왼쪽 위)
    if (st.badge != null) {
      ctx.fillStyle = '#2f6f8f';
      ctx.fillRect(x + 2, y + 2, 18, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(st.badge), x + 11, y + 14);
    }
    // 차징 게이지 (칸 아래)
    if (st.gauge != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y + SIZE + 4, SIZE, 5);
      ctx.fillStyle = '#ffcc4d';
      ctx.fillRect(x, y + SIZE + 4, SIZE * st.gauge, 5);
    }
    ctx.textAlign = 'left';
    if (mouse && mouse.x >= x && mouse.x <= x + SIZE && mouse.y >= y && mouse.y <= y + SIZE) hovered = { s, st };
  }
  if (hovered) drawTooltip(ctx, canvas, hovered.s, hovered.st);
}

function drawTooltip(ctx, canvas, s, st) {
  const w = 250, pad = 10;
  const x = Math.min(canvas.width - w - 8, Math.max(8, s.x + SIZE / 2 - w / 2));
  ctx.font = '13px sans-serif';
  const lines = [s.desc, st.extra];
  // 높이를 먼저 계산 (줄바꿈 수)
  let h = 34;
  for (const t of lines) {
    let line = '', n = 1;
    for (const ch of t) { if (ctx.measureText(line + ch).width > w - pad * 2 && line) { n++; line = ch; } else line += ch; }
    h += n * 17 + 4;
  }
  const y = s.y - h - 8;
  ctx.fillStyle = 'rgba(10,14,20,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${s.name}  [${s.key}]`, x + pad, y + 22);
  ctx.font = '13px sans-serif';
  let ty = y + 42;
  lines.forEach((t, i) => {
    ctx.fillStyle = i === 0 ? '#cfd8e3' : '#ffcc4d';
    ty = wrap(ctx, t, x + pad, ty, w - pad * 2, 17) + 21;
  });
}
