// 스킬 선택 창(방 클리어 시)과 스킬 트리 창(K) 그리기
const W = 960, H = 540;

function dim(ctx, alpha = 0.7) {
  ctx.fillStyle = `rgba(8,12,20,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function text(ctx, str, x, y, { size = 16, color = '#fff', align = 'left', bold = false } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

// 폭에 맞게 줄바꿈해서 여러 줄로 그린다 (가운데 정렬)
function wrapText(ctx, str, cx, y, maxWidth, lineHeight, opts) {
  ctx.font = `${opts.bold ? 'bold ' : ''}${opts.size}px sans-serif`;
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(ctx, l, cx, y + i * lineHeight, { ...opts, align: 'center' }));
}

export function drawChoicePanel(ctx, choices, selected, skillTree, room) {
  dim(ctx);
  text(ctx, `방 ${room} 클리어!`, W / 2, 110, { size: 30, bold: true, align: 'center' });
  text(ctx, '스킬을 하나 고르세요', W / 2, 145, { size: 18, color: '#cfd8e3', align: 'center' });

  const cw = 230, ch = 190, gap = 30;
  const total = choices.length * cw + (choices.length - 1) * gap;
  choices.forEach((s, i) => {
    const x = W / 2 - total / 2 + i * (cw + gap);
    const y = 190;
    const sel = i === selected;
    ctx.fillStyle = sel ? '#2c3e57' : '#1b2533';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = sel ? '#ffcc4d' : '#4a5a70';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    text(ctx, `${i + 1}`, x + 14, y + 28, { size: 16, color: '#8fa3bb', bold: true });
    text(ctx, skillTree.trees[s.tree].name, x + cw - 14, y + 28, { size: 13, color: '#78d6ff', align: 'right' });
    text(ctx, s.name, x + cw / 2, y + 82, { size: 22, bold: true, align: 'center', color: sel ? '#ffcc4d' : '#fff' });
    wrapText(ctx, s.description, x + cw / 2, y + 112, cw - 28, 19, { size: 14, color: '#cfd8e3' });
    if (s.requires.length) {
      const req = s.requires.map((r) => skillTree.byId[r].name).join(', ');
      text(ctx, `← ${req}`, x + cw / 2, y + 174, { size: 12, color: '#8fa3bb', align: 'center' });
    }
  });
  text(ctx, '1·2·3 또는 ←→ 로 고르고 Enter / Space / X 로 확정', W / 2, 430, { size: 14, color: '#8fa3bb', align: 'center' });
}

// 트리 화면의 노드 위치 계산 (그리기와 클릭 판정이 같이 쓴다)
const NODE_W = 260, NODE_H = 74, COL_GAP = 50, ROW_GAP = 36;
export function treeLayout(skillTree) {
  const headers = [];
  const nodes = [];
  let top = 130;
  for (const [, tree] of Object.entries(skillTree.trees)) {
    headers.push({ name: tree.name, y: top });
    const cols = Math.max(...tree.skills.map((s) => s.pos[0])) + 1;
    const left = W / 2 - (cols * NODE_W + (cols - 1) * COL_GAP) / 2;
    for (const s of tree.skills) {
      nodes.push({ skill: s, x: left + s.pos[0] * (NODE_W + COL_GAP), y: top + 24 + s.pos[1] * (NODE_H + ROW_GAP), w: NODE_W, h: NODE_H });
    }
    const rows = Math.max(...tree.skills.map((s) => s.pos[1])) + 1;
    top += 24 + rows * (NODE_H + ROW_GAP) + 20;
  }
  return { headers, nodes };
}

// 캔버스 좌표 (x, y) 에 있는 스킬 id (없으면 null)
export function hitTestTree(skillTree, x, y) {
  const n = treeLayout(skillTree).nodes.find((n) => x >= n.x && x < n.x + n.w && y >= n.y && y < n.y + n.h);
  return n ? n.skill.id : null;
}

export function drawTreePanel(ctx, skillTree, cursorId) {
  dim(ctx, 0.82);
  text(ctx, '스킬 트리', W / 2, 60, { size: 28, bold: true, align: 'center' });
  text(ctx, '테스트용: 스킬을 클릭하거나 ↑↓ + Enter 로 배우기 / 해제 · R 초기화', W / 2, 88, { size: 13, color: '#8fa3bb', align: 'center' });

  const { headers, nodes } = treeLayout(skillTree);
  const rectOf = Object.fromEntries(nodes.map((n) => [n.skill.id, n]));
  for (const h of headers) text(ctx, `${h.name} 트리`, 60, h.y, { size: 18, bold: true, color: '#78d6ff' });

  // 선행 관계 선
  for (const { skill: s, x, y, w } of nodes) {
    for (const r of s.requires) {
      const a = rectOf[r];
      ctx.strokeStyle = skillTree.has(r) ? '#ffcc4d' : '#4a5a70';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x + a.w / 2, a.y + a.h);
      ctx.lineTo(x + w / 2, y);
      ctx.stroke();
    }
  }
  // 노드
  for (const { skill: s, x, y, w: nw, h: nh } of nodes) {
    const owned = skillTree.has(s.id);
    const open = skillTree.isLearnable(s.id);
    ctx.fillStyle = owned ? '#5a4a1a' : open ? '#22324a' : '#161d28';
    ctx.fillRect(x, y, nw, nh);
    ctx.strokeStyle = owned ? '#ffcc4d' : open ? '#cfd8e3' : '#3a4656';
    ctx.lineWidth = owned ? 3 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, nw - 1, nh - 1);
    if (s.id === cursorId) {
      ctx.strokeStyle = '#78d6ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4.5, y - 4.5, nw + 9, nh + 9);
    }
    const color = owned ? '#ffcc4d' : open ? '#fff' : '#6b7a8c';
    text(ctx, s.name, x + nw / 2, y + 26, { size: 16, bold: true, color, align: 'center' });
    wrapText(ctx, s.description, x + nw / 2, y + 46, nw - 20, 16, { size: 12, color: owned || open ? '#cfd8e3' : '#56657a' });
  }

  // 범례
  const ly = H - 40;
  [['#ffcc4d', '보유'], ['#cfd8e3', '배울 수 있음'], ['#3a4656', '잠김']].forEach(([c, label], i) => {
    const x = W / 2 - 170 + i * 120;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, ly - 12, 14, 14);
    text(ctx, label, x + 22, ly, { size: 13, color: '#cfd8e3' });
  });
  text(ctx, 'K 로 닫기', W - 30, H - 28, { size: 13, color: '#8fa3bb', align: 'right' });
}
