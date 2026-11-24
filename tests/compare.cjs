// 회귀 기록 두 개를 비교한다: node tests/compare.cjs <기준.json> <변경후.json>
// 다른 장면(label)만 요약해서 보여 준다. 일부러 바꾼 장면만 달라야 한다.
const fs = require('fs');
const [a, b] = [process.argv[2], process.argv[3]].map((f) => JSON.parse(fs.readFileSync(f, 'utf-8')));
if (a.length !== b.length) console.log(`기록 개수가 다름: ${a.length} vs ${b.length}`);
const diff = [];
for (let i = 0; i < Math.min(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) diff.push(i);
const labels = [...new Set(diff.map((i) => a[i][0]))];
console.log(`기록 ${a.length}개 중 다른 것 ${diff.length}개${diff.length ? ' | 다른 장면: ' + labels.join(', ') : ' → 완전히 같음'}`);
if (diff.length) console.log('첫 차이 위치:', diff[0], a[diff[0]][0]);
process.exit(diff.length ? 1 : 0);
