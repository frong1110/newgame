// 결정적 회귀 재생: 같은 입력을 고정 프레임으로 재생해 상태 기록(JSON)을 만든다.
// 사용법과 비교 방법은 docs/TESTING.md 참고.
//   1) 개발 서버를 띄운다:   npm run dev
//   2) node tests/regress.cjs <out.json>           (다른 주소면 BASE_URL=http://localhost:5174/ 처럼 지정)
//   3) 바꾸기 전 기록과 바꾼 뒤 기록을 비교한다
// playwright 는 package.json 에 없다 (클라우드 환경에는 미리 설치돼 있음). 로컬에서 돌리려면 `npm i -D playwright`.
const { chromium } = require('playwright'); const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/?level=level1';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE_URL); await p.waitForTimeout(500);
  await p.evaluate(() => {
    const G = window.__game; G.pause(true);
    const r = (v) => Math.round(v * 1000) / 1000;
    window.trace = [];
    window.snap = (label) => {
      const pl = G.player;
      trace.push([label, r(pl.x), r(pl.y), r(pl.vx), r(pl.vy), pl.facing, pl.onGround, r(pl.attackTimer), pl.comboStep, pl.attackId, r(pl.dashTimer), pl.chain.phase, pl.pullChain.phase, pl.slamState, r(pl.swingLengthScale ?? 1), r(pl.stunTimer), r(pl.invincibleTimer), r(pl.dodgeTimer), G.room, G.mode, r(G.hitstop),
        G.enemies.map(e => [e.alive, r(e.x), r(e.y), r(e.hp), r(Math.max(0, e.bindTimer)), e.bindAnchor ? (e.bindAnchor === 'player' ? 'P' : 'pt') : null, e.flight && e.flight.kind, e.held, !!e.push, !!e.pull, r(e.stunTimer)])]);
    };
    window.run = (n, label) => { for (let i = 0; i < n; i++) { G.tick(1); if (i % 3 === 0) snap(label); } };
    window.key = (code, down) => down ? G.Input.pressVirtual(code) : G.Input.releaseVirtual(code);
    window.tap = (code, label, after = 1) => { key(code, true); run(1, label); key(code, false); run(after, label); };
    window.setup = (skills, px, py, enemies) => {
      G.skillTree.reset(); skills.forEach(id => G.skillTree.learnWithRequirements(id)); G.player.stats = G.skillTree.stats;
      const pl = G.player; pl.respawn(G.world.spawn.x, G.world.spawn.y); pl.x = px; pl.y = py; pl.vx = pl.vy = 0; pl.facing = 1;
      G.enemies.forEach((e, i) => { e.reset(); const s = enemies[i]; if (s) { e.x = s[0]; e.y = s[1]; e.stunTimer = s[2] ?? 0; } else { e.x = 3000; e.y = 0; } });
      run(3, 'settle');
    };
  });
  const sc = (name, body) => p.evaluate(body);
  // A. 이동·점프·콤보·대시
  await sc('A', () => { setup([], 68, 450, []);
    key('ArrowRight', true); run(40, 'walk'); tap('Space', 'jump', 20); tap('Space', 'djump', 30); key('ArrowRight', false); run(60, 'land');
    key('KeyX', true); run(130, 'holdX'); key('KeyX', false); run(30, 'x-end');
    tap('ShiftLeft', 'dash', 40); key('ArrowLeft', true); tap('ShiftLeft', 'dashL', 40); key('ArrowLeft', false); run(30, 'end'); });
  // B. 회전 차지 (탭 / 홀드 후 방출) / 쳐내기 축적
  await sc('B', () => { for (const gap of [40, 85, 130]) { setup(['cw_spin_charge'], 1460, 450, [[1484 + gap, 452, 99]]); key('KeyX', true); run(40, 'charge' + gap); key('KeyX', false); run(60, 'tune' + gap); }
    setup(['cw_spin_charge'], 1460, 450, [[1569, 452, 99]]); tap('KeyX', 'tap', 60);
    setup(['cw_deflect_store'], 1460, 450, [[1760, 452, 99]]); key('KeyX', true); run(15, 'spin'); window.__game.projectiles.spawn(1560, 460, -300, 0); run(60, 'deflect'); key('KeyX', false); run(60, 'fan'); });
  // C. 당기기·투척·띄우기·내리찍기·폭풍
  await sc('C', () => {
    setup([], 1500, 450, [[1680, 452, 0.4]]); tap('KeyC', 'pull', 80);
    setup(['cw_spin_throw'], 1500, 450, [[1680, 452, 0.4], [1760, 452, 99]]); tap('KeyC', 'throw', 120);
    setup(['cw_slam'], 1500, 450, [[1640, 452, 0.4], [1700, 452, 99]]); key('ArrowUp', true); tap('KeyC', 'launch', 40); key('ArrowUp', false); tap('KeyC', 'airslam', 120);
    setup(['cw_flail_storm'], 1500, 450, [[1660, 452, 0.4], [1440, 452, 99]]); tap('KeyC', 'storm', 100); tap('KeyC', 'storm-slam', 120); });
  // D. 감기·연결·감옥
  await sc('D', () => {
    setup(['cw_prison'], 1460, 450, [[1569, 452, 0.2], [1640, 452, 99], [1720, 452, 99]]);
    tap('KeyX', 'bind', 30); window.__game.enemies[1].bind(1.5, 'player'); run(5, 'b2');
    tap('KeyC', 'gather', 100); // 팽팽한 줄 + 사슬 감옥: 끌어모아 폭발
    window.__game.enemies[0].bind(1.5, 'player'); window.__game.enemies[1].bind(1.5, 'player'); window.__game.enemies[0].takeHit(20, 1, 0, 0, 'r2'); run(40, 'prison');
    key('ArrowLeft', true); run(90, 'tether-break'); key('ArrowLeft', false); run(10, 'D-end'); });
  // E. 사슬 이동(낭떠러지) + 내리꽂기
  await sc('E', () => {
    setup(['dash_slam'], 380, 450, [[640, 452, 99], [700, 452, 99]]); key('ArrowRight', true); run(2, 'aim'); tap('ShiftLeft', 'zip', 1); key('ArrowRight', false); run(40, 'zip');
    tap('KeyX', 'slam', 80);
    setup(['dash_diagonal'], 1100, 450, []); key('ArrowRight', true); key('ArrowUp', true); run(2, 'aim2'); tap('ShiftLeft', 'diag', 30); key('ArrowRight', false); key('ArrowUp', false); run(60, 'E-end'); });
  // F. 검
  await sc('F', () => { setup([], 1460, 450, [[1500, 452, 99]]); window.__game.skillTree.setWeapon('sword'); window.__game.player.stats = window.__game.skillTree.stats;
    key('KeyX', true); run(120, 'sword'); key('KeyX', false); run(20, 'F-end'); window.__game.skillTree.setWeapon('chain'); window.__game.player.stats = window.__game.skillTree.stats; });
  // G. 방 클리어
  await sc('G', () => { setup([], 1460, 450, [[1600, 452, 0]]); window.__game.enemies.forEach(e => e.die()); run(120, 'clear'); });
  const out = await p.evaluate(() => trace);
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  console.log('frames recorded', out.length, 'errors', errs.length ? errs : 'none');
  await b.close();
})();
