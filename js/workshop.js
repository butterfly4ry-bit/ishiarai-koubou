/* =========================================================
   workshop.js — あらい場の 小さな 風けい（ねこ・お茶）
   160×72 の 帯。ねこを なでたり、お茶を いれたり できる
   ========================================================= */

import { makeCv, mixc, rgb2hex } from './pixel.js';
import { S, catHere, petCat, brewTea, teaActive } from './state.js';
import { toast, canvasPos } from './ui.js';
import * as sound from './audio.js';
import * as weather from './weather.js';

const W = 160, H = 72;
let g, cv, bgCache = null, bgKey = '';
let t = 0, purr = 0, catBlink = 0;
let onChange = null;

const CAT_BOX = [8, 34, 40, 32];
const TEA_BOX = [102, 40, 46, 24];

export function init(canvas, cb){
  cv = canvas;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  onChange = cb;
  cv.addEventListener('pointerdown', onDown);
}

function hit(box, x, y){ return x > box[0] && x < box[0] + box[2] && y > box[1] && y < box[1] + box[3]; }

function onDown(ev){
  ev.preventDefault();
  const p = canvasPos(cv, ev);
  if (catHere() && hit(CAT_BOX, p.x, p.y)){
    sound.init();
    purr = 2.2;
    sound.sfx(Math.random() < .5 ? 'cat' : 'purr');
    const gift = petCat();
    if (gift){
      toast('ねこが どろだんごを もってきた！');
    } else {
      toast('ねこは ごろごろ いっている。');
    }
    if (onChange) onChange();
    return;
  }
  if (hit(TEA_BOX, p.x, p.y)){
    sound.init();
    if (teaActive()){
      toast('お茶は まだ あたたかい。');
    } else {
      brewTea();
      sound.sfx('tea');
      toast('お茶を いれた。しばらく 石が よく 見つかる。');
    }
    if (onChange) onChange();
  }
}

/* ---------- 背景 ---------- */
function backdrop(){
  const info = weather.cached();
  const key = info.time.phase + info.weather.id;
  if (bgCache && bgKey === key) return bgCache;
  const { cv: c, g: b } = makeCv(W, H);
  const sky = info.sky;

  for (let y = 0; y < H; y++){
    b.fillStyle = rgb2hex(...mixc('#efe3cc', '#d6c2a0', y / H));
    b.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 260; i++){
    b.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.2)' : 'rgba(150,125,95,.1)';
    b.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
  }
  // まど
  const wx = 56, wy = 4, ww = 40, wh = 26;
  for (let y = wy; y < wy + wh; y++){
    b.fillStyle = rgb2hex(...mixc(sky.top, sky.bot, Math.round((y - wy) / wh * 4) / 4));
    b.fillRect(wx, y, ww, 1);
  }
  b.fillStyle = rgb2hex(...mixc(sky.land, '#5f7a4a', .5));
  b.fillRect(wx, wy + wh - 6, ww, 6);
  b.fillStyle = '#8f6a3c';
  b.fillRect(wx - 3, wy - 3, ww + 6, 3); b.fillRect(wx - 3, wy + wh, ww + 6, 3);
  b.fillRect(wx - 3, wy - 3, 3, wh + 6); b.fillRect(wx + ww, wy - 3, 3, wh + 6);
  b.fillStyle = '#a8804c'; b.fillRect(wx + (ww >> 1), wy, 1, wh);

  // つり下げた 布
  b.fillStyle = '#c8d8c0'; b.fillRect(0, 0, 16, 22);
  b.fillStyle = '#a8bfa0'; b.fillRect(0, 20, 16, 2);

  // ゆか（板）
  b.fillStyle = '#b98a52'; b.fillRect(0, 60, W, 12);
  b.fillStyle = '#cfa06a'; b.fillRect(0, 60, W, 2);
  b.fillStyle = '#9a6f3f';
  for (let x = 0; x < W; x += 9) b.fillRect(x, 62, 1, 10);

  // たらい（中央）
  b.fillStyle = '#8f6a3c'; b.fillRect(56, 42, 44, 3);
  b.fillStyle = '#a8804c'; b.fillRect(57, 45, 42, 15);
  b.fillStyle = '#8f6a3c'; b.fillRect(57, 58, 42, 2);
  b.fillStyle = '#bfe0e6'; b.fillRect(59, 45, 38, 11);
  b.fillStyle = '#9dcbd6'; b.fillRect(59, 52, 38, 4);
  b.fillStyle = 'rgba(255,255,255,.6)'; b.fillRect(62, 47, 10, 1); b.fillRect(78, 50, 12, 1);
  // ぬれた 石が 2つ
  b.fillStyle = '#8e8578'; b.fillRect(66, 53, 6, 4);
  b.fillStyle = '#a89e90'; b.fillRect(66, 53, 6, 1);
  b.fillStyle = '#7d7468'; b.fillRect(84, 54, 5, 3);
  // ブラシ
  b.fillStyle = '#8f6a3c'; b.fillRect(38, 56, 12, 3);
  b.fillStyle = '#d8b878'; b.fillRect(40, 59, 9, 2);

  // 棚と びん（右うえ。ねこの 場所を あけておく）
  b.fillStyle = '#c69a5e'; b.fillRect(104, 28, 52, 4);
  b.fillStyle = '#9a6f3f'; b.fillRect(104, 31, 52, 1);
  const bottles = [['#a8c8d8', 108, 20, 5, 8], ['#d8c0a0', 116, 22, 4, 6], ['#c8d8b0', 123, 19, 6, 9], ['#e0b0b0', 132, 22, 5, 6], ['#c8b8d8', 141, 21, 5, 7]];
  for (const [col, x, y, w, h] of bottles){
    b.fillStyle = col; b.fillRect(x, y, w, h);
    b.fillStyle = 'rgba(255,255,255,.5)'; b.fillRect(x, y, 1, h);
    b.fillStyle = '#8f6a3c'; b.fillRect(x + 1, y - 2, w - 2, 2);
  }

  // きゅうす と ゆのみ
  b.fillStyle = '#7f6a58'; b.fillRect(110, 46, 18, 12);
  b.fillStyle = '#95806c'; b.fillRect(110, 46, 18, 2);
  b.fillStyle = '#7f6a58'; b.fillRect(128, 50, 4, 2);      // 注ぎ口
  b.fillRect(107, 49, 3, 5);                                // とって
  b.fillStyle = '#5f5044'; b.fillRect(116, 43, 6, 3);       // ふた
  b.fillStyle = '#e8e0d0'; b.fillRect(134, 52, 9, 7);
  b.fillStyle = '#cfc4b0'; b.fillRect(134, 52, 9, 1);

  bgCache = c; bgKey = key;
  return c;
}
export function resetBackdrop(){ bgKey = ''; }

/* ---------- ねこ ---------- */
function drawCat(){
  const x = 22, y = 60;   // あしもと
  const body = '#e8c79a', dark = '#c9a273', ear = '#f0d8c0';
  // しっぽ
  g.fillStyle = dark;
  for (let i = 0; i < 8; i++){
    const tx = x - 8 - i, ty = y - 4 - Math.round(Math.sin(i * .5 + t * 1.4) * 3);
    g.fillRect(tx, ty, 1, 2);
  }
  // からだ
  g.fillStyle = body;
  g.fillRect(x - 6, y - 10, 14, 10);
  g.fillRect(x - 4, y - 14, 10, 6);
  // しま
  g.fillStyle = dark;
  g.fillRect(x - 4, y - 9, 1, 8); g.fillRect(x, y - 9, 1, 8); g.fillRect(x + 4, y - 9, 1, 8);
  // あたま
  g.fillStyle = body;
  g.fillRect(x - 5, y - 22, 11, 9);
  g.fillStyle = ear;
  g.fillRect(x - 5, y - 25, 3, 3); g.fillRect(x + 3, y - 25, 3, 3);
  // かお
  const blink = catBlink > 0;
  g.fillStyle = '#4a3b2e';
  if (blink){
    g.fillRect(x - 3, y - 19, 2, 1); g.fillRect(x + 2, y - 19, 2, 1);
  } else {
    g.fillRect(x - 3, y - 20, 2, 2); g.fillRect(x + 2, y - 20, 2, 2);
  }
  g.fillStyle = '#d88f8f'; g.fillRect(x, y - 17, 1, 1);
  g.fillStyle = '#4a3b2e'; g.fillRect(x - 1, y - 16, 3, 1);
  // ひげ
  g.fillStyle = 'rgba(90,70,50,.6)';
  g.fillRect(x - 8, y - 17, 3, 1); g.fillRect(x + 4, y - 17, 3, 1);
  // ごろごろ
  if (purr > 0){
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 3; i++){
      const a = Math.max(0, purr - i * .3);
      if (a <= 0) continue;
      g.globalAlpha = Math.min(1, a);
      const yy = y - 28 - i * 5 - Math.round((2.2 - purr) * 4);
      g.fillRect(x + 8 + i * 2, yy, 2, 2);
      g.globalAlpha = 1;
    }
  }
}

/* ---------- 毎フレーム ---------- */
export function draw(dt){
  t += dt;
  if (purr > 0) purr -= dt;
  catBlink -= dt;
  if (catBlink < -3.5 && Math.random() < dt * 2) catBlink = .16;

  g.clearRect(0, 0, W, H);
  g.drawImage(backdrop(), 0, 0);

  // 湯気
  const hot = teaActive();
  const n = hot ? 7 : 3;
  for (let i = 0; i < n; i++){
    const ph = t * .8 + i * 1.1;
    const x = 119 + Math.round(Math.sin(ph) * 3);
    const y = 42 - ((ph * 5) % 22);
    g.globalAlpha = .45 * (1 - ((ph * 5) % 22) / 22);
    g.fillStyle = '#ffffff';
    g.fillRect(x, y | 0, 2, 2);
    g.globalAlpha = 1;
  }
  // お茶が きいている しるし
  if (hot){
    g.fillStyle = 'rgba(255,240,190,.55)';
    g.fillRect(104, 64, 40, 2);
  }

  if (catHere()) drawCat();
}
