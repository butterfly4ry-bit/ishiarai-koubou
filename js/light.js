/* =========================================================
   light.js — 光に かざして 正体を たしかめる
   まどの ひかりに 石を かさねると、中が すけて わかる
   ========================================================= */

import { renderStone, STONE_BY_ID } from './stones.js';
import { makeCv, mixc, rgb2hex, clamp } from './pixel.js';
import * as sound from './audio.js';
import { canvasPos } from './ui.js';
import * as weather from './weather.js';

const W = 160, H = 200, SS = 44;
// まどの あな
const WIN = { x: 44, y: 16, w: 72, h: 64 };

let g, cv, cur = null, cb = {};
let pos = { x: 80, y: 152 };
let dragging = false, reveal = 0, t = 0, fired = false;
let motes = [], glints = [];
let wallCache = null, wallKey = '';

export function init(canvas, callbacks){
  cv = canvas;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  cb = callbacks || {};
  for (let i = 0; i < 26; i++)
    motes.push({ x: WIN.x + Math.random() * WIN.w, y: WIN.y + Math.random() * 120, v: 4 + Math.random() * 8, p: Math.random() * 6 });
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}

export function setStone(c){
  cur = c;
  reveal = 0; fired = false;
  pos = { x: 80, y: 154 };
  glints = [];
}

function down(ev){
  ev.preventDefault();
  try{ cv.setPointerCapture?.(ev.pointerId); }catch(e){}
  const p = canvasPos(cv, ev);
  dragging = true;
  sound.init();
  pos.x = clamp(p.x, 14, W - 14);
  pos.y = clamp(p.y, 14, H - 14);
}
function move(ev){
  if (!dragging) return;
  ev.preventDefault();
  const p = canvasPos(cv, ev);
  pos.x = clamp(p.x, 14, W - 14);
  pos.y = clamp(p.y, 14, H - 14);
}
function up(){ dragging = false; }

const inBeam = () =>
  pos.x > WIN.x - 8 && pos.x < WIN.x + WIN.w + 8 &&
  pos.y > WIN.y - 4 && pos.y < WIN.y + WIN.h + 16;

/* ---------- かべと まど ---------- */
function wall(){
  const info = weather.cached();
  const key = info.time.phase + info.weather.id;
  if (wallCache && wallKey === key) return { cv: wallCache, info };
  const { cv: c, g: b } = makeCv(W, H);

  // かべ（しっくい）
  for (let y = 0; y < H; y++){
    const q = y / H;
    b.fillStyle = rgb2hex(...mixc('#efe3cc', '#d8c6a6', q));
    b.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 500; i++){
    b.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.25)' : 'rgba(150,125,95,.12)';
    b.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
  }
  // はしら
  b.fillStyle = '#b98a52'; b.fillRect(0, 0, 5, H); b.fillRect(W - 5, 0, 5, H);
  b.fillStyle = '#9a6f3f'; b.fillRect(4, 0, 1, H); b.fillRect(W - 5, 0, 1, H);

  // まどの そと（空）
  const sky = info.sky;
  for (let y = WIN.y; y < WIN.y + WIN.h; y++){
    const q = (y - WIN.y) / WIN.h;
    b.fillStyle = rgb2hex(...mixc(sky.top, sky.bot, Math.round(q * 5) / 5));
    b.fillRect(WIN.x, y, WIN.w, 1);
  }
  // そとの けしき
  b.fillStyle = rgb2hex(...mixc(sky.land, '#5f7a4a', .5));
  b.fillRect(WIN.x, WIN.y + WIN.h - 14, WIN.w, 14);
  for (let i = 0; i < 9; i++){
    const x = WIN.x + 4 + i * 8, hh = 5 + ((i * 7) % 8);
    b.fillStyle = rgb2hex(...mixc(sky.land, '#3f5a30', .8));
    b.fillRect(x, WIN.y + WIN.h - 14 - hh, 2, hh);
  }
  if (info.time.phase === 'night'){
    for (let i = 0; i < 20; i++){
      b.fillStyle = 'rgba(255,255,255,.8)';
      b.fillRect(WIN.x + ((Math.random() * WIN.w) | 0), WIN.y + ((Math.random() * (WIN.h - 16)) | 0), 1, 1);
    }
  }
  // まどわく
  b.fillStyle = '#8f6a3c';
  b.fillRect(WIN.x - 4, WIN.y - 4, WIN.w + 8, 4);
  b.fillRect(WIN.x - 4, WIN.y + WIN.h, WIN.w + 8, 5);
  b.fillRect(WIN.x - 4, WIN.y - 4, 4, WIN.h + 9);
  b.fillRect(WIN.x + WIN.w, WIN.y - 4, 4, WIN.h + 9);
  b.fillStyle = '#a8804c';
  b.fillRect(WIN.x + (WIN.w >> 1) - 1, WIN.y, 2, WIN.h);
  b.fillRect(WIN.x, WIN.y + (WIN.h >> 1) - 1, WIN.w, 2);

  // したの 作業だな
  b.fillStyle = '#b98a52'; b.fillRect(0, H - 26, W, 26);
  b.fillStyle = '#cfa06a'; b.fillRect(0, H - 26, W, 3);
  b.fillStyle = '#9a6f3f';
  for (let x = 0; x < W; x += 7) b.fillRect(x, H - 23, 1, 23);
  // 小さな はち植え
  b.fillStyle = '#c98a6a'; b.fillRect(12, H - 36, 12, 10);
  b.fillStyle = '#a86a4a'; b.fillRect(11, H - 38, 14, 3);
  b.fillStyle = '#6f9a54';
  b.fillRect(15, H - 44, 2, 7); b.fillRect(19, H - 46, 2, 9); b.fillRect(17, H - 42, 2, 5);
  b.fillStyle = '#8fbf6a'; b.fillRect(14, H - 45, 2, 2); b.fillRect(20, H - 48, 2, 2);

  wallCache = c; wallKey = key;
  return { cv: c, info };
}

export function resetWall(){ wallKey = ''; }

/* ---------- 毎フレーム ---------- */
export function draw(dt){
  if (!cur) return;
  t += dt;
  const { cv: bgCv, info } = wall();
  g.clearRect(0, 0, W, H);
  g.drawImage(bgCv, 0, 0);

  const night = info.time.phase === 'night';
  const beamA = night ? .10 : info.weather.id === 'clear' ? .26 : .17;

  /* ひかりの すじ */
  g.save();
  g.globalAlpha = beamA;
  g.fillStyle = night ? '#cfe0ff' : '#fff6d8';
  g.beginPath();
  g.moveTo(WIN.x, WIN.y + WIN.h);
  g.lineTo(WIN.x + WIN.w, WIN.y + WIN.h);
  g.lineTo(WIN.x + WIN.w + 22, H - 26);
  g.lineTo(WIN.x - 22, H - 26);
  g.closePath(); g.fill();
  g.restore();

  /* ほこり */
  for (const m of motes){
    m.y += m.v * dt; m.p += dt;
    if (m.y > H - 30){ m.y = WIN.y; m.x = WIN.x + Math.random() * WIN.w; }
    g.globalAlpha = .5 + .5 * Math.sin(m.p * 2);
    g.fillStyle = night ? '#dfe8ff' : '#fff8e0';
    g.fillRect((m.x + Math.sin(m.p) * 3) | 0, m.y | 0, 1, 1);
  }
  g.globalAlpha = 1;

  /* 石 */
  const lit = inBeam();
  if (lit){
    reveal = clamp(reveal + dt * (night ? .34 : .5), 0, 1);
    if (cb.onReveal) cb.onReveal(reveal);
    if (Math.random() < dt * 14)
      glints.push({ x: pos.x + (Math.random() - .5) * 30, y: pos.y + (Math.random() - .5) * 30, a: 1 });
  }
  const def = STONE_BY_ID[cur.id];
  const mode = lit && reveal > .12 ? 'light' : 'normal';
  const sprite = renderStone(cur.id, cur.seed, SS, mode, cur.gloss || 0);

  // すけている ときは うしろに 光の わ
  if (lit){
    const grd = g.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, 46 + 14 * reveal);
    grd.addColorStop(0, (def.glow || '#ffffff') + 'cc');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = .28 + .5 * reveal * (def.trans ?? .3);
    g.fillStyle = grd;
    g.fillRect(pos.x - 62, pos.y - 62, 124, 124);
    g.globalAlpha = 1;
  }

  const sz = Math.round(SS * 1.24);
  const sx = Math.round(pos.x - sz / 2), sy = Math.round(pos.y - sz / 2);
  g.drawImage(sprite, sx, sy, sz, sz);

  // つまんでいる 手
  const hx = Math.round(pos.x);
  g.fillStyle = '#eae0d2'; g.fillRect(hx - 7, sy - 15, 14, 6);          // そで
  g.fillStyle = '#c9bda9'; g.fillRect(hx - 7, sy - 10, 14, 1);
  g.fillStyle = '#f0cfa8'; g.fillRect(hx - 7, sy - 9, 14, 8);           // て
  g.fillRect(hx - 6, sy - 1, 3, 5);                                     // ゆび
  g.fillRect(hx - 1, sy - 1, 3, 6);
  g.fillRect(hx + 4, sy - 1, 3, 4);
  g.fillStyle = '#e0b892';
  g.fillRect(hx - 7, sy - 9, 14, 1);
  g.fillRect(hx - 3, sy - 8, 1, 8); g.fillRect(hx + 3, sy - 8, 1, 7);

  /* きらり */
  glints = glints.filter(s => s.a > .05);
  for (const s of glints){
    s.a -= dt * 1.6;
    g.fillStyle = `rgba(255,252,225,${s.a.toFixed(2)})`;
    g.fillRect(s.x | 0, (s.y | 0) - 1, 1, 3);
    g.fillRect((s.x | 0) - 1, s.y | 0, 3, 1);
  }

  /* できあがり */
  if (reveal >= 1 && !fired){
    fired = true;
    sound.sfx('shine');
    if (cb.onDone) cb.onDone();
  }
}

export function progress(){ return reveal; }
