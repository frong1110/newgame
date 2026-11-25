// 화면 글자: 왼쪽 위 디버그 정보, 오른쪽 위 보유 스킬 목록, 위쪽 가운데 버전
export function drawHUD(ctx, canvas, { player, enemies, skillTree, room, isTouch }) {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px monospace';
  ctx.fillText(`jumps: ${player.stats.maxJumps - player.jumpsUsed}/${player.stats.maxJumps}`, 12, 22);
  ctx.fillText(`weapon: ${player.usesChainWeapon ? '사슬' : '검'}${player.usesChainWeapon ? `   당기기(C): ${player.pullChain.active ? player.pullChain.phase : player.specialCooldownTimer > 0 ? '...' : 'ready'}` : ''}`, 12, 40);
  const comboLabel = player.attackTimer > 0 ? `${player.comboStep + 1}/${player.weapon.combo.length} ${player.step.name}` : '-';
  ctx.fillText(`combo: ${comboLabel}`, 12, 58);
  const dashReady = player.dashCooldownTimer <= 0 && (player.usesChain || player.onGround || player.airDashesUsed < player.stats.dash.maxAirDashes);
  ctx.fillText(`${player.usesChain ? 'chain' : 'dash'}: ${player.isDashing ? 'GO' : player.chain.active ? player.chain.phase : dashReady ? 'ready' : '...'}${player.dodgeTimer > 0 ? ' (무적)' : ''}`, 12, 76);
  if (player.stormOn) ctx.fillText(`채찍 폭풍: ${player.whipStacks}/${player.weapon.stormMaxStacks}${player.whipMaxed ? ' MAX' : ''}`, 12, 112);
  ctx.fillText(`room: ${room}   enemies: ${enemies.filter((e) => e.alive).length}/${enemies.length}`, 12, 94);

  const owned = [...skillTree.owned].map((id) => skillTree.byId[id].name);
  ctx.textAlign = 'right';
  // 터치 모드에서는 오른쪽 위에 버튼이 있으므로 안내 문구를 빼고 목록을 아래로 내린다
  if (!isTouch) ctx.fillText('K: 스킬 트리', canvas.width - 12, 22);
  const listTop = isTouch ? 90 : 44;
  owned.forEach((name, i) => ctx.fillText(`· ${name}`, canvas.width - 12, listTop + i * 18));
  ctx.textAlign = 'left';
}

// 버전 표시: 화면 위쪽 가운데 (모바일 버튼과 겹치지 않는 자리)
export function drawVersion(ctx, canvas, version) {
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`v${version}`, canvas.width / 2, 18);
  ctx.textAlign = 'left';
}
