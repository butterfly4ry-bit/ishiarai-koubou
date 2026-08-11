/* =========================================================
   audio.js — 音は ぜんぶ その場で 合成（音源ファイルなし）
   環境音（水・雨・鳥・虫）＋ ゆるい BGM ＋ 効果音
   ========================================================= */

let ac = null;
let master, bgmG, ambG, seG;
let noiseBuf = null;
let amb = null;              // 今の 環境音ノード
let bgmTimer = 0, birdTimer = 0;
let opts = { bgm: true, se: true };
let started = false;
let stream = null;           // 水を かけている 音

export function isReady(){ return !!ac; }

export function init(o){
  if (o) opts = Object.assign(opts, o);
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();

  master = ac.createGain(); master.gain.value = .9; master.connect(ac.destination);
  bgmG = ac.createGain(); bgmG.gain.value = opts.bgm ? .30 : 0; bgmG.connect(master);
  ambG = ac.createGain(); ambG.gain.value = opts.bgm ? .34 : 0; ambG.connect(master);
  seG  = ac.createGain(); seG.gain.value  = opts.se  ? .55 : 0; seG.connect(master);

  // ざつおん（水や 雨の もと）
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++){
    const w = Math.random() * 2 - 1;
    b0 = .99765 * b0 + w * .0990460;
    b1 = .96300 * b1 + w * .2965164;
    b2 = .57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * .1848) * .22;
  }
  started = true;
}

export function setOpts(o){
  opts = Object.assign(opts, o);
  if (!ac) return;
  const t = ac.currentTime;
  bgmG.gain.setTargetAtTime(opts.bgm ? .30 : 0, t, .2);
  ambG.gain.setTargetAtTime(opts.bgm ? .34 : 0, t, .2);
  seG.gain.setTargetAtTime(opts.se ? .55 : 0, t, .05);
}

/* ---------- 部品 ---------- */
function noise(){
  const s = ac.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}
function env(node, t0, a, d, peak, out){
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + a + d);
  node.connect(g); g.connect(out || seG);
  return g;
}
function tone(freq, t0, a, d, peak, type = 'sine', out){
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = freq;
  env(o, t0, a, d, peak, out);
  o.start(t0); o.stop(t0 + a + d + .05);
  return o;
}

/* =========================================================
   環境音
   ========================================================= */
export function ambience(kind, weather){
  if (!ac) return;
  stopAmbience();
  const g = ac.createGain(); g.gain.value = 0; g.connect(ambG);
  const parts = [];

  // ---- 水の音（ばしょで 少し ちがう）----
  const waterLevel = { river:.55, stream:.8, beach:.6, mountain:.12, cave:.28, night:.3 }[kind] ?? .4;
  if (waterLevel > 0){
    const n = noise();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = kind === 'stream' ? 1500 : 900; lp.Q.value = .6;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const wg = ac.createGain(); wg.gain.value = waterLevel;
    n.connect(hp); hp.connect(lp); lp.connect(wg); wg.connect(g);
    // ゆらぎ
    const lfo = ac.createOscillator(); lfo.frequency.value = .13;
    const lg = ac.createGain(); lg.gain.value = kind === 'stream' ? 420 : 240;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    n.start();
    parts.push(n, lfo);
  }

  // ---- 波（はまべ）----
  if (kind === 'beach'){
    const n = noise();
    const bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 700;
    const wg = ac.createGain(); wg.gain.value = .0;
    n.connect(bp); bp.connect(wg); wg.connect(g);
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .11;
    const lg = ac.createGain(); lg.gain.value = .5;
    const off = ac.createConstantSource(); off.offset.value = .5;
    lfo.connect(lg); lg.connect(wg.gain); off.connect(wg.gain);
    n.start(); lfo.start(); off.start();
    parts.push(n, lfo, off);
  }

  // ---- 風（いわやま・よぞら）----
  if (kind === 'mountain' || kind === 'night'){
    const n = noise();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = .8;
    const wg = ac.createGain(); wg.gain.value = .22;
    n.connect(bp); bp.connect(wg); wg.connect(g);
    const lfo = ac.createOscillator(); lfo.frequency.value = .07;
    const lg = ac.createGain(); lg.gain.value = 200;
    lfo.connect(lg); lg.connect(bp.frequency);
    n.start(); lfo.start();
    parts.push(n, lfo);
  }

  // ---- 雨 ----
  if (weather && (weather.rain > 0 || weather.snow > 0)){
    const lvl = weather.rain > 0 ? weather.rain : .18;
    const n = noise();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = weather.snow ? 500 : 900;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const wg = ac.createGain(); wg.gain.value = .38 * lvl;
    n.connect(hp); hp.connect(lp); lp.connect(wg); wg.connect(g);
    n.start(); parts.push(n);
  }

  // ---- どうくつの 水滴 ----
  if (kind === 'cave'){
    const dly = ac.createDelay(1.2); dly.delayTime.value = .28;
    const fb = ac.createGain(); fb.gain.value = .42;
    const wet = ac.createGain(); wet.gain.value = .5;
    dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(g);
    amb = { g, parts, drip: dly };
  }

  g.gain.setTargetAtTime(1, ac.currentTime, 1.2);
  amb = Object.assign(amb || {}, { g, parts, kind });

  scheduleCritters(kind, weather);
}

export function stopAmbience(){
  clearTimeout(birdTimer);
  if (!amb || !ac) { amb = null; return; }
  const { g, parts } = amb;
  g.gain.setTargetAtTime(0, ac.currentTime, .4);
  setTimeout(() => {
    try{ parts.forEach(p => p.stop && p.stop()); g.disconnect(); }catch(e){}
  }, 1400);
  amb = null;
}

/* 鳥・虫・水滴を ときどき 鳴らす */
function scheduleCritters(kind, weather){
  clearTimeout(birdTimer);
  if (!ac) return;
  const night = kind === 'night';
  const step = () => {
    if (!ac || !amb) return;
    const t = ac.currentTime + .02;
    const out = amb.g;
    const r = Math.random();
    if (kind === 'cave'){
      // 水滴
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1400 + r * 500, t);
      o.frequency.exponentialRampToValueAtTime(420, t + .08);
      env(o, t, .004, .18, .22, amb.drip || out);
      o.start(t); o.stop(t + .3);
    } else if (night){
      // 虫の音
      for (let i = 0; i < 5; i++){
        const tt = t + i * .07;
        const o = ac.createOscillator(); o.type = 'triangle';
        o.frequency.value = 3600 + Math.random() * 300;
        env(o, tt, .005, .04, .05, out);
        o.start(tt); o.stop(tt + .08);
      }
    } else if (!weather || weather.rain < .8){
      // 小鳥
      const base = 1700 + r * 900;
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++){
        const tt = t + i * (.08 + Math.random() * .06);
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(base * (1 + i * .12), tt);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + i * .1), tt + .07);
        env(o, tt, .01, .09, .10, out);
        o.start(tt); o.stop(tt + .2);
      }
    }
    birdTimer = setTimeout(step, (night ? 2600 : 5200) + Math.random() * 6000);
  };
  birdTimer = setTimeout(step, 2500 + Math.random() * 4000);
}

/* =========================================================
   BGM — 五音音階を ゆっくり つまびく
   ========================================================= */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
let bgmDelay = null, padOsc = [];

export function startBgm(){
  if (!ac || bgmTimer) return;
  bgmDelay = ac.createDelay(1.5);
  bgmDelay.delayTime.value = .36;
  const fb = ac.createGain(); fb.gain.value = .34;
  const wet = ac.createGain(); wet.gain.value = .42;
  bgmDelay.connect(fb); fb.connect(bgmDelay); bgmDelay.connect(wet); wet.connect(bgmG);

  // やわらかい パッド
  [130.81, 196.00].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * (i ? 1.002 : 1);
    const g = ac.createGain(); g.gain.value = .0;
    o.connect(g); g.connect(bgmG);
    g.gain.setTargetAtTime(.055, ac.currentTime, 4);
    o.start(); padOsc.push(o, g);
  });

  let i = 0;
  const step = () => {
    if (!ac) return;
    const t = ac.currentTime + .05;
    const deg = SCALE[(Math.random() * SCALE.length) | 0];
    const f = 261.63 * Math.pow(2, deg / 12);
    const o = ac.createOscillator();
    o.type = Math.random() < .3 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.16, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + 1.9);
    o.connect(g); g.connect(bgmG); g.connect(bgmDelay);
    o.start(t); o.stop(t + 2.1);
    // ときどき 5度を そえる
    if (Math.random() < .28){
      const o2 = ac.createOscillator(); o2.type = 'sine';
      o2.frequency.value = f * 1.5;
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0, t + .09);
      g2.gain.linearRampToValueAtTime(.08, t + .12);
      g2.gain.exponentialRampToValueAtTime(.0001, t + 1.5);
      o2.connect(g2); g2.connect(bgmG);
      o2.start(t + .09); o2.stop(t + 1.7);
    }
    i++;
    bgmTimer = setTimeout(step, 1100 + Math.random() * 1600);
  };
  bgmTimer = setTimeout(step, 600);
}

export function stopBgm(){
  clearTimeout(bgmTimer); bgmTimer = 0;
  padOsc.forEach(n => { try{ n.stop ? n.stop() : n.disconnect(); }catch(e){} });
  padOsc = [];
}

/* =========================================================
   効果音
   ========================================================= */
export function sfx(name){
  if (!ac || !opts.se) return;
  const t = ac.currentTime + .01;
  switch (name){
    case 'tap': {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 660;
      env(o, t, .004, .06, .18); o.start(t); o.stop(t + .1);
      break;
    }
    case 'pick': { // ころん
      tone(880, t, .006, .10, .18, 'triangle');
      tone(1320, t + .07, .006, .14, .14, 'triangle');
      break;
    }
    case 'splash': {
      const n = noise();
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8;
      bp.frequency.setValueAtTime(2600, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + .3);
      n.connect(bp); env(bp, t, .01, .34, .5);
      n.start(t); n.stop(t + .5);
      break;
    }
    case 'drop': {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1200, t);
      o.frequency.exponentialRampToValueAtTime(380, t + .1);
      env(o, t, .004, .16, .2); o.start(t); o.stop(t + .3);
      break;
    }
    case 'shine': { // きらん
      [1046, 1318, 1568, 2093].forEach((f, i) =>
        tone(f, t + i * .06, .006, .5 - i * .06, .14, 'sine'));
      break;
    }
    case 'newdex': {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        tone(f, t + i * .1, .01, .7, .16, 'triangle'));
      break;
    }
    case 'polish': {
      const n = noise();
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 4200; bp.Q.value = 1.4;
      n.connect(bp); env(bp, t, .02, .12, .16);
      n.start(t); n.stop(t + .2);
      break;
    }
    case 'cat': { // にゃー
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(720, t + .12);
      o.frequency.linearRampToValueAtTime(430, t + .42);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      o.connect(lp); env(lp, t, .05, .42, .12);
      o.start(t); o.stop(t + .6);
      break;
    }
    case 'purr': {
      const n = noise();
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = ac.createGain(); g.gain.value = 0;
      n.connect(lp); lp.connect(g); g.connect(seG);
      const lfo = ac.createOscillator(); lfo.frequency.value = 24;
      const lg = ac.createGain(); lg.gain.value = .5;
      const off = ac.createConstantSource(); off.offset.value = .5;
      lfo.connect(lg); lg.connect(g.gain); off.connect(g.gain);
      const out = ac.createGain(); out.gain.value = 0;
      g.disconnect(); g.connect(out); out.connect(seG);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(.5, t + .2);
      out.gain.setTargetAtTime(0, t + 1.2, .3);
      n.start(t); lfo.start(t); off.start(t);
      n.stop(t + 2.4); lfo.stop(t + 2.4); off.stop(t + 2.4);
      break;
    }
    case 'tea': {
      const n = noise();
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1;
      n.connect(bp); env(bp, t, .1, 1.0, .18);
      n.start(t); n.stop(t + 1.3);
      tone(392, t + .1, .05, .8, .08, 'sine');
      break;
    }
    case 'page': {
      const n = noise();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
      n.connect(hp); env(hp, t, .005, .1, .12);
      n.start(t); n.stop(t + .15);
      break;
    }
  }
}

/* ---------- こすっている あいだ 鳴る 水／たわしの音 ----------
   ノードは いちど 作ったら 作りなおさない（音量だけ 上げ下げする）。
   何度も 作って 捨てると、はやく タップした ときに ノードが たまって
   音が つまったり 重くなったり する。 */
function ensureStream(){
  if (stream || !ac) return stream;
  const n = noise();
  const bp = ac.createBiquadFilter();
  bp.type = 'lowpass'; bp.frequency.value = 1800; bp.Q.value = 1;
  const g = ac.createGain(); g.gain.value = 0;
  n.connect(bp); bp.connect(g); g.connect(seG);
  n.start();
  stream = { n, g, bp };
  return stream;
}

export function waterStream(on, kind = 'water'){
  if (!ac) return;
  const s = ensureStream();
  if (!s) return;
  if (on){
    streamKind(kind);
    s.g.gain.setTargetAtTime(opts.se ? .35 : 0, ac.currentTime, .06);
  } else {
    s.g.gain.setTargetAtTime(0, ac.currentTime, .10);
  }
}

export function streamKind(kind){
  if (!stream || !ac) return;
  const brush = kind === 'brush';
  stream.bp.type = brush ? 'bandpass' : 'lowpass';
  stream.bp.frequency.setTargetAtTime(brush ? 3200 : 1800, ac.currentTime, .08);
  stream.bp.Q.setTargetAtTime(brush ? 1.6 : 1, ac.currentTime, .08);
}
