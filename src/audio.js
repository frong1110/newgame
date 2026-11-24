// 효과음 (임시): 파일 없이 Web Audio 로 즉석에서 만든다. 수치는 game.json 의 sfx.
// 브라우저는 사용자가 키·화면을 누르기 전에는 소리를 막으므로, 첫 입력 때 AudioContext 를 연다.
import { GAME } from './data/index.js';

let ac = null;
let master = null;

function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = GAME.sfx.masterVolume;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, ensure, { passive: true });

// 끝부분 적중: 짧게 떨어지는 금속성 '팅' + 잡음
function tipHit(a, d, t) {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(d.freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(d.freqEnd, t + d.duration);
  g.gain.setValueAtTime(d.volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d.duration);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + d.duration);

  const len = Math.floor(a.sampleRate * d.duration);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const ng = a.createGain();
  ng.gain.value = d.volume * d.noise;
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = d.freqEnd;
  noise.connect(hp).connect(ng).connect(master);
  noise.start(t);
}

const SOUNDS = { tipHit };

export function playSfx(name) {
  const a = ensure();
  const def = GAME.sfx[name];
  if (!a || !def || !SOUNDS[name]) return;
  SOUNDS[name](a, def, a.currentTime);
  playSfx.count = (playSfx.count || 0) + 1; // 테스트용 재생 횟수
}
