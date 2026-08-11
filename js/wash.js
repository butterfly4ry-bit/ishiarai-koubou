/* =========================================================
   wash.js — あらい場（どろを おとす → みがく）
   ・どろの 層を 指で けずる
   ・けずった 割合を かぞえて すすみ具合に する
   ========================================================= */

import { renderStone, renderMud } from './stones.js';
import { makeCv, mixc, rgb2hex, clamp } from './pixel.js';
import * as sound from './audio.js';
import { canvasPos } from './ui.js';

const C = 160;          // キャンバスの 大きさ
const SS = 56;          // 石とどろの もとの 大きさ（ドット）
const OX = 24, OY = 22; // 石を おく 位置（2倍で 112px）

let gw, gp, cvW, cvP;
let mudCv = null, mudG = null, mudBase = 0;
let cur = null;                 // { id, seed, mud, gloss }
let ripples = [], drops = [], sparks = [];
let tool = 'water';
let t = 0, rubbing = false, lastPt = null, moveAcc = 0;
let cb = {};
let checkTimer = 0;
let basinCache = null;

export function init(canvasWash, canvasPolish, callbacks){
  cvW = canvasWash; cvP = canvasPolish;
  gw = cvW.getContext('2d'); gw.imageSmoothingEnabled = false;
  gp = cvP.getContext('2d'); gp.imageSmoothingEnabled = false;
  cb = callbacks || {};
  bindPointer(cvW, onWashMove);
  bindPointer(cvP, onPolishMove);
}

export function setTool(x){ tool = x; sound.streamKind(x); }
export function getTool(){ return tool; }

/* ---------- 石を セット ---------- */
export function setStone(c){
  cur = c;
  ripples = []; drops = []; sparks = [];
  const m = makeCv(SS, SS);
  mudCv = m.cv; mudG = m.g;
  mudG.drawImage(renderMud(c.seed, SS), 0, 0);
  mudBase = countMud();
  // 途中から 再開する ばあいは 進み具合を もどす
  if (c.mud < 1) eraseFraction(1 - c.mud);
}

function countMud(){
  const d = mudG.getImageData(0, 0, SS, SS).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n;
}

/* 復帰用: だいたい fr の 割合を けずる */
function eraseFraction(fr){
  if (fr <= 0) return;
  const n = Math.round(fr * 120);
  for (let i = 0; i < n; i++)
    erase(Math.random() * SS, Math.random() * SS, 4);
}

/* ---------- どろを けずる ---------- */
function erase(x, y, r){
  mudG.globalCompositeOperation = 'destination-out';
  mudG.fillStyle = '#000';
  for (let dy = -r; dy <= r; dy++){
    const w = Math.sqrt(Math.max(0, r * r - dy * dy));
    mudG.fillRect(Math.round(x - w), Math.round(y + dy), Math.max(1, Math.round(w * 2)), 1);
  }
  mudG.globalCompositeOperation = 'source-over';
}

function bindPointer(canvas, moveFn){
  const down = ev => {
    ev.preventDefault();
    try{ canvas.setPointerCapture?.(ev.pointerId); }catch(e){}
    rubbing = true; lastPt = canvasPos(canvas, ev);
    sound.init(); sound.waterStream(true, tool);
    moveFn(ev, true);
  };
  const move = ev => { if (rubbing) { ev.preventDefault(); moveFn(ev, false); } };
  const up = () => { rubbing = false; lastPt = null; sound.waterStream(false); };
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
  const mx = (p.x - OX) / 2, my = (p.y - OY) / 2;   // どろキャンバスの 座標
  const r = tool === 'water' ? 5.5 : 3.5;

  if (lastPt && !isDown){
    // 前の 点から 線で つなぐ（速く なでても とぎれない）
    const steps = Math.max(1, Math.round(Math.hypot(p.x - lastPt.x, p.y - lastPt.y) / 3));
    for (let i = 1; i <= steps; i++){
      const q = i / steps;
      const ex = ((lastPt.x + (p.x - lastPt.x) * q) - OX) / 2;
      const ey = ((lastPt.y + (p.y - lastPt.y) * q) - OY) / 2;
      erase(ex, ey, r);
    }
  } else erase(mx, my, r);

  if (Math.random() < .5) ripples.push({ x: p.x, y: p.y, r: 2, a: .5 });
  for (let i = 0; i < (tool === 'water' ? 2 : 1); i++)
    drops.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 50, a: 1 });

  lastPt = p;
  if (!checkTimer) checkTimer = setTimeout(checkDone, 160);
}

function checkDone(){
  checkTimer = 0;
  if (!cur) return;
  const left = countMud() / Math.max(1, mudBase);
  cur.mud = clamp(left, 0, 1);
  if (cb.onWashProgress) cb.onWashProgress(1 - cur.mud);
  if (cur.mud < .03){
    cur.mud = 0;
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
      if (cur.gloss > before && Math.random() < .5)
        sparks.push({ x: p.x, y: p.y, a: 1, s: 1 + Math.random() * 2 });
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
  gw.clearRect(0, 0, C, C);
  gw.drawImage(basin(), 0, 0);

  // 水の ゆらぎ
  for (let y = 14; y < C - 14; y += 5){
    const x = ((Math.sin(t * .5 + y * .3) * .5 + .5) * (C - 40) + 14) | 0;
    gw.fillStyle = 'rgba(255,255,255,.35)';
    gw.fillRect(x, y, 8 + (y % 5), 1);
  }

  // 石（どろの 下。はみ出さないように すこし 小さめ）
  const st = renderStone(cur.id, cur.seed, SS, 'normal', cur.gloss || 0);
  gw.save();
  gw.imageSmoothingEnabled = false;
  gw.drawImage(st, OX + 14, OY + 14, 84, 84);
  // どろ（うえに かぶさる）
  gw.drawImage(mudCv, OX, OY, SS * 2, SS * 2);
  gw.restore();

  // なみ もん
  ripples = ripples.filter(r => r.a > .02);
  for (const r of ripples){
    r.r += 34 * dt; r.a -= dt * 1.2;
    gw.strokeStyle = `rgba(255,255,255,${r.a.toFixed(3)})`;
    gw.lineWidth = 1;
    gw.beginPath(); gw.arc(r.x, r.y, r.r, 0, 6.284); gw.stroke();
  }
  // しぶき
  drops = drops.filter(d => d.a > .05);
  for (const d of drops){
    d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 180 * dt; d.a -= dt * 1.1;
    gw.fillStyle = `rgba(232,248,252,${d.a.toFixed(2)})`;
    gw.fillRect(d.x | 0, d.y | 0, 1, 1);
  }

  // 指の ところの どうぐ
  if (rubbing && lastPt) drawTool(gw, lastPt.x, lastPt.y);
}

function drawTool(g, x, y){
  x |= 0; y |= 0;
  if (tool === 'water'){
    g.fillStyle = 'rgba(200,240,250,.85)';
    for (let i = 0; i < 5; i++) g.fillRect(x - 6 + i * 3, y - 12 - i, 1, 6 + i);
    g.fillStyle = '#9fd8e4'; g.fillRect(x - 8, y - 20, 14, 4);
    g.fillStyle = '#7fb8c8'; g.fillRect(x - 8, y - 20, 14, 1);
  } else {
    g.fillStyle = '#8f6a3c'; g.fillRect(x - 7, y - 14, 14, 4);
    g.fillStyle = '#d8b878';
    for (let i = 0; i < 7; i++) g.fillRect(x - 6 + i * 2, y - 10, 1, 5);
  }
}

/* ---------- 毎フレーム: みがく ---------- */
export function drawPolish(dt){
  if (!cur) return;
  t += dt;
  gp.clearRect(0, 0, C, C);
  // やわらかい 背景（作業台）
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

  // きらきら
  sparks = sparks.filter(s => s.a > .05);
  for (const s of sparks){
    s.a -= dt * 1.4;
    gp.fillStyle = `rgba(255,250,210,${s.a.toFixed(2)})`;
    gp.fillRect(s.x | 0, (s.y | 0) - 1, 1, 3);
    gp.fillRect((s.x | 0) - 1, s.y | 0, 3, 1);
  }
  // つやが 高いと ときどき 光の すじ
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
export function clearStone(){ cur = null; }
