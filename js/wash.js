/* =========================================================
   wash.js — あらい場（どろを おとす → みがく）
   ・どろは 2そう。
     ①「ゆるい どろ」…水で ざっと 流せる（石より 大きく かぶさっている）
     ②「こびりつき」…石の 表面に かたく はりついた よごれ。水では おちない。
                      ブラシで こすって おとす。
   ・けずった 割合を かぞえて すすみ具合に する
   ========================================================= */

import { renderStone, renderMud, renderCrust } from './stones.js';
import { makeCv, mixc, rgb2hex, clamp, eraseAlong, countAlpha } from './pixel.js';
import * as sound from './audio.js';
import { canvasPos } from './ui.js';

const C = 160;            // キャンバスの 大きさ
const SS = 56;            // どろ・石の もとの 大きさ（ドット）
const OX = 24, OY = 22;   // どろを おく 位置（2倍で 112px）
const SOFF = 14, SSZ = 84;// 石（と こびりつき）は すこし 小さめ

// どうぐの ききめ（それぞれの そうを けずる 半径。0 は ききめなし）
const TOOL = {
  water: { mud: 6.0, crust: 0,   se: 'water' },
  brush: { mud: 3.4, crust: 4.4, se: 'brush' },
};

const MAX_DROPS = 90, MAX_RIPPLES = 10, MAX_SPARKS = 40;
const MAX_PENDING = 220;   // 1フレームで さばく 点の 上限

let gw, gp, cvW, cvP;
let mudCv = null, mudG = null, mudBase = 1;
let crustCv = null, crustG = null, crustBase = 1;
let cur = null;                 // { id, seed, mud, crust, gloss }
let ripples = [], drops = [], sparks = [];
let pending = [];               // まだ けずっていない 点（1フレームに 1回 まとめて 処理）
let tool = 'water';
let t = 0, rubbing = false, lastPt = null, moveAcc = 0;
let cb = {};
let checkTimer = 0, hintTimer = 0;
let wasteful = 0;               // 水で こびりつきを こすった 回数
let switched = false;           // ブラシに もちかえた 案内を 出したか
let basinCache = null;

export function init(canvasWash, canvasPolish, callbacks){
  cvW = canvasWash; cvP = canvasPolish;
  gw = cvW.getContext('2d'); gw.imageSmoothingEnabled = false;
  gp = cvP.getContext('2d'); gp.imageSmoothingEnabled = false;
  cb = callbacks || {};
  bindPointer(cvW, onWashMove);
  bindPointer(cvP, onPolishMove);
}

export function setTool(x){
  tool = x;
  sound.streamKind(x);
}
export function getTool(){ return tool; }

/* ---------- 石を セット ---------- */
export function setStone(c){
  cur = c;
  if (cur.crust == null) cur.crust = 1;
  ripples = []; drops = []; sparks = []; pending = [];
  wasteful = 0; switched = false;

  const m = makeCv(SS, SS, true);
  mudCv = m.cv; mudG = m.g;
  mudG.drawImage(renderMud(c.seed, SS), 0, 0);
  mudBase = Math.max(1, countAlpha(mudG, SS, SS));

  const k = makeCv(SS, SS, true);
  crustCv = k.cv; crustG = k.g;
  crustG.drawImage(renderCrust(c.id, c.seed, SS), 0, 0);
  crustBase = Math.max(1, countAlpha(crustG, SS, SS));

  // 途中から 再開する ばあいは だいたいの すすみ具合を もどす
  if (c.mud < 1) scatterErase(mudG, 1 - c.mud, 5);
  if (c.crust < 1) scatterErase(crustG, 1 - c.crust, 4);
}

/* 復帰用: だいたい fr の 割合を けずる */
function scatterErase(ctx, fr, r){
  if (fr <= 0) return;
  const pts = [];
  const n = Math.round(fr * 140);
  for (let i = 0; i < n; i++) pts.push([Math.random() * SS, Math.random() * SS]);
  eraseAlong(ctx, pts, r);
}

/* ---------- 指の うごき ---------- */
function bindPointer(canvas, moveFn){
  const down = ev => {
    ev.preventDefault();
    try{ canvas.setPointerCapture?.(ev.pointerId); }catch(e){}
    rubbing = true; lastPt = canvasPos(canvas, ev);
    document.body.classList.add('rubbing');     // 画面が うごかないように
    sound.init(); sound.waterStream(true, tool);
    moveFn(ev, true);
  };
  const move = ev => { if (rubbing){ ev.preventDefault(); moveFn(ev, false); } };
  const up = () => {
    if (!rubbing) return;
    rubbing = false; lastPt = null;
    document.body.classList.remove('rubbing');
    sound.waterStream(false);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', up);
}

/* ---------- あらう ---------- */
function onWashMove(ev, isDown){
  if (!cur) return;
  const p = canvasPos(cvW, ev);
  const T = TOOL[tool] || TOOL.water;
  // ほんの わずかな ゆれは 無視（むだな 計算を へらす）
  if (!isDown && lastPt && Math.hypot(p.x - lastPt.x, p.y - lastPt.y) < .8) return;

  /* 前の 点から 線で つないで ためておく。
     じっさいに けずるのは 1フレームに 1回（描画の ときに まとめて）。
     こうすると 指を どれだけ 速く うごかしても 仕事の 量が ふえすぎない。 */
  if (lastPt && !isDown){
    const dist = Math.hypot(p.x - lastPt.x, p.y - lastPt.y);
    const steps = Math.max(1, Math.min(20, Math.round(dist / 3)));
    for (let i = 1; i <= steps && pending.length < MAX_PENDING; i++){
      const q = i / steps;
      pending.push([lastPt.x + (p.x - lastPt.x) * q, lastPt.y + (p.y - lastPt.y) * q, tool]);
    }
  } else if (pending.length < MAX_PENDING) pending.push([p.x, p.y, tool]);

  /* つぶ・しぶきの えんしゅつ（どうぐで ちがう） */
  if (tool === 'water'){
    if (ripples.length < MAX_RIPPLES && Math.random() < .5)
      ripples.push({ x: p.x, y: p.y, r: 2, a: .5 });
    for (let i = 0; i < 2 && drops.length < MAX_DROPS; i++)
      drops.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 50, a: 1, c: 0 });
  } else {
    for (let i = 0; i < 3 && drops.length < MAX_DROPS; i++)
      drops.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 60, a: 1, c: 1 });
  }

  // 水で こびりつきを こすっても おちない ことを 知らせる
  if (T.crust === 0 && cur.mud < .12 && cur.crust > .05){
    wasteful++;
    if (wasteful === 26) hint('この よごれは 水だけでは おちない。ブラシで こすろう。');
  }

  lastPt = p;
}

/* ためた 点を まとめて けずる（1フレームに 1回だけ 呼ばれる） */
function flushPending(){
  if (!pending.length || !cur) return;
  for (const name of ['water', 'brush']){
    const T = TOOL[name];
    const pts = pending.filter(q => q[2] === name);
    if (!pts.length) continue;
    if (T.mud > 0)
      eraseAlong(mudG, pts.map(([x, y]) => [(x - OX) / 2, (y - OY) / 2]), T.mud);
    if (T.crust > 0)
      eraseAlong(crustG, pts.map(([x, y]) => [(x - SOFF - OX) / 1.5, (y - SOFF - OY) / 1.5]), T.crust);
  }
  pending.length = 0;
  if (!checkTimer) checkTimer = setTimeout(checkDone, 170);
}

function hint(msg){
  if (cb.onHint) cb.onHint(msg);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { if (cb.onHint) cb.onHint(null); }, 4200);
}

function checkDone(){
  checkTimer = 0;
  if (!cur) return;
  cur.mud   = clamp(countAlpha(mudG, SS, SS) / mudBase, 0, 1);
  cur.crust = clamp(countAlpha(crustG, SS, SS) / crustBase, 0, 1);
  // 「ほとんど おちた」なら きれいに なった ことに する（さがし回らせない）
  if (cur.mud < .05) cur.mud = 0;
  if (cur.crust < .08) cur.crust = 0;
  if (cb.onWashProgress) cb.onWashProgress(cur.mud, cur.crust);

  // ゆるい どろが おちたら ブラシに もちかえる
  if (cur.mud === 0 && cur.crust > 0 && !switched){
    switched = true;
    if (cb.onNeedBrush) cb.onNeedBrush();
  }
  if (cur.mud === 0 && cur.crust === 0){
    sound.waterStream(false);
    sound.sfx('splash');
    if (cb.onWashDone) cb.onWashDone();
  }
}

/* ---------- みがく ---------- */
function onPolishMove(ev, isDown){
  if (!cur) return;
  const p = canvasPos(cvP, ev);
  if (lastPt && !isDown){
    const d = Math.hypot(p.x - lastPt.x, p.y - lastPt.y);
    const inside = Math.hypot(p.x - C / 2, p.y - C / 2) < 62;
    if (inside){
      moveAcc += d;
      const before = cur.gloss;
      cur.gloss = clamp(cur.gloss + d * .0014, 0, 1);
      if (cur.gloss > before && sparks.length < MAX_SPARKS && Math.random() < .5)
        sparks.push({ x: p.x, y: p.y, a: 1 });
      if (moveAcc > 60){ moveAcc = 0; sound.sfx('polish'); }
      if (cb.onPolish) cb.onPolish(cur.gloss);
    }
  }
  lastPt = p;
}

/* ---------- たらい の 絵 ---------- */
function basin(){
  if (basinCache) return basinCache;
  const { cv, g } = makeCv(C, C);
  // ふちの 木
  g.fillStyle = '#b98a52'; g.fillRect(0, 0, C, C);
  for (let i = 0; i < 6; i++){
    g.fillStyle = rgb2hex(...mixc('#b98a52', i % 2 ? '#a0713f' : '#cfa06a', .6));
    g.fillRect(0, i * 2, C, 1);
    g.fillRect(0, C - 1 - i * 2, C, 1);
    g.fillRect(i * 2, 0, 1, C);
    g.fillRect(C - 1 - i * 2, 0, 1, C);
  }
  // 水
  const pad = 11;
  for (let y = pad; y < C - pad; y++){
    const q = (y - pad) / (C - pad * 2);
    g.fillStyle = rgb2hex(...mixc('#bfe0e6', '#8fbecb', q));
    g.fillRect(pad, y, C - pad * 2, 1);
  }
  // 水の かどを すこし 丸く
  g.fillStyle = '#a3785f';
  [[pad, pad], [C - pad - 3, pad], [pad, C - pad - 3], [C - pad - 3, C - pad - 3]].forEach(([x, y]) => {
    g.fillRect(x, y, 3, 1); g.fillRect(x, y + 1, 1, 2);
    g.fillRect(x + 2, y + 1, 1, 2);
  });
  // そこの 砂
  for (let i = 0; i < 300; i++){
    const x = pad + 1 + ((Math.random() * (C - pad * 2 - 2)) | 0);
    const y = pad + 1 + ((Math.random() * (C - pad * 2 - 2)) | 0);
    g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.25)' : 'rgba(90,120,130,.18)';
    g.fillRect(x, y, 1, 1);
  }
  basinCache = cv;
  return cv;
}

/* ---------- 毎フレーム: あらう ---------- */
export function drawWash(dt){
  if (!cur) return;
  t += dt;
  flushPending();                 // ためた 指の うごきを ここで 反映
  gw.clearRect(0, 0, C, C);
  gw.drawImage(basin(), 0, 0);

  // 水の ゆらぎ
  for (let y = 14; y < C - 14; y += 5){
    const x = ((Math.sin(t * .5 + y * .3) * .5 + .5) * (C - 40) + 14) | 0;
    gw.fillStyle = 'rgba(255,255,255,.35)';
    gw.fillRect(x, y, 8 + (y % 5), 1);
  }

  // 石 → こびりつき → ゆるい どろ の じゅんに かさねる
  const st = renderStone(cur.id, cur.seed, SS, 'normal', cur.gloss || 0);
  gw.drawImage(st, OX + SOFF, OY + SOFF, SSZ, SSZ);
  gw.drawImage(crustCv, OX + SOFF, OY + SOFF, SSZ, SSZ);
  gw.drawImage(mudCv, OX, OY, SS * 2, SS * 2);

  // なみもん
  ripples = ripples.filter(r => r.a > .02);
  for (const r of ripples){
    r.r += 34 * dt; r.a -= dt * 1.2;
    gw.strokeStyle = `rgba(255,255,255,${r.a.toFixed(3)})`;
    gw.lineWidth = 1;
    gw.beginPath(); gw.arc(r.x, r.y, r.r, 0, 6.284); gw.stroke();
  }
  // しぶき（水）／ どろの つぶ（ブラシ）
  drops = drops.filter(d => d.a > .05);
  for (const d of drops){
    d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 180 * dt; d.a -= dt * 1.1;
    gw.fillStyle = d.c
      ? `rgba(110,81,54,${d.a.toFixed(2)})`
      : `rgba(232,248,252,${d.a.toFixed(2)})`;
    gw.fillRect(d.x | 0, d.y | 0, 1, 1);
  }

  // 指の ところの どうぐ
  if (rubbing && lastPt) drawTool(gw, lastPt.x, lastPt.y);
}

function drawTool(g, x, y){
  x |= 0; y |= 0;
  if (tool === 'water'){
    // ひしゃく から 水が 落ちている
    g.fillStyle = 'rgba(200,240,250,.85)';
    for (let i = 0; i < 5; i++) g.fillRect(x - 6 + i * 3, y - 12 - i, 1, 6 + i);
    g.fillStyle = '#9fd8e4'; g.fillRect(x - 8, y - 20, 14, 4);
    g.fillStyle = '#7fb8c8'; g.fillRect(x - 8, y - 20, 14, 1);
    g.fillStyle = '#8f6a3c'; g.fillRect(x + 6, y - 19, 6, 2);
  } else {
    // たわし
    const sh = Math.sin(t * 22) > 0 ? 1 : 0;      // こする ふるえ
    g.fillStyle = '#8f6a3c'; g.fillRect(x - 8 + sh, y - 15, 16, 5);
    g.fillStyle = '#a8804c'; g.fillRect(x - 8 + sh, y - 15, 16, 1);
    g.fillStyle = '#d8b878';
    for (let i = 0; i < 8; i++) g.fillRect(x - 7 + sh + i * 2, y - 10, 1, 6);
  }
}

/* ---------- 毎フレーム: みがく ---------- */
export function drawPolish(dt){
  if (!cur) return;
  t += dt;
  gp.clearRect(0, 0, C, C);
  const grd = gp.createLinearGradient(0, 0, 0, C);
  grd.addColorStop(0, '#f6ecd8'); grd.addColorStop(1, '#e0cba8');
  gp.fillStyle = grd; gp.fillRect(0, 0, C, C);
  gp.fillStyle = 'rgba(160,120,70,.15)';
  for (let y = 0; y < C; y += 8) gp.fillRect(0, y, C, 1);
  // 布
  gp.fillStyle = '#e8e2ee'; gp.fillRect(18, 104, 124, 40);
  gp.fillStyle = '#d6cfe0'; gp.fillRect(18, 104, 124, 2);
  gp.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 24; i++) gp.fillRect(20 + ((i * 13) % 118), 108 + ((i * 7) % 32), 2, 1);

  const st = renderStone(cur.id, cur.seed, SS, 'normal', cur.gloss || 0);
  gp.drawImage(st, OX, OY - 6, SS * 2, SS * 2);

  sparks = sparks.filter(s => s.a > .05);
  for (const s of sparks){
    s.a -= dt * 1.4;
    gp.fillStyle = `rgba(255,250,210,${s.a.toFixed(2)})`;
    gp.fillRect(s.x | 0, (s.y | 0) - 1, 1, 3);
    gp.fillRect((s.x | 0) - 1, s.y | 0, 3, 1);
  }
  if ((cur.gloss || 0) > .5 && (t % 3) < .35){
    const k = ((t % 3) / .35);
    gp.globalAlpha = .5 * (1 - Math.abs(k - .5) * 2);
    gp.fillStyle = '#ffffff';
    gp.fillRect(OX + 10 + k * 70, OY, 3, 100);
    gp.globalAlpha = 1;
  }
  if (rubbing && lastPt){
    gp.fillStyle = 'rgba(240,236,248,.9)';
    gp.fillRect((lastPt.x | 0) - 9, (lastPt.y | 0) - 8, 18, 12);
    gp.fillStyle = 'rgba(215,208,226,.9)';
    gp.fillRect((lastPt.x | 0) - 9, (lastPt.y | 0) - 8, 18, 2);
  }
}

export function current(){ return cur; }
export function clearStone(){
  cur = null;
  rubbing = false; lastPt = null;
  clearTimeout(checkTimer); checkTimer = 0;
  clearTimeout(hintTimer); hintTimer = 0;
  ripples = []; drops = []; sparks = []; pending = [];
  document.body.classList.remove('rubbing');
  sound.waterStream(false);
}
