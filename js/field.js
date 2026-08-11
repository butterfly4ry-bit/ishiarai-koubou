/* =========================================================
   field.js — 石を ひろう ばしょ（ドット絵の 風けい）
   160×240 の 小さな キャンバスに、空・水・地面・人・どろだんごを 描く
   ========================================================= */

import { rng, noise2, fbm, mixc, rgb2hex, hillLine, clamp, hashInt } from './pixel.js';
import { renderMud, FIELD_BY_ID } from './stones.js';
import { S, pickNode, BASKET_MAX } from './state.js';
import * as sound from './audio.js';
import { popText, canvasPos } from './ui.js';

const W = 160, H = 240;
const HY = 92;                 // 地平線
let g, cv, fx;
let bg = null, bgKey = '';
let t = 0;
let rainP = [], snowP = [], flies = [], birds = [];
let player = { x: 80, dir: 1, walk: 0, target: null, action: 0 };
let ctxInfo = null;            // { sky, weather, time }
let onPicked = null;

/* ---------------------------------------------------------
   初期化
   --------------------------------------------------------- */
export function init(canvas, fxHost, cb){
  cv = canvas;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  fx = fxHost;
  onPicked = cb;
  cv.addEventListener('pointerdown', onDown);
  for (let i = 0; i < 60; i++)
    rainP.push({ x: Math.random() * W, y: Math.random() * H, v: 150 + Math.random() * 90 });
  for (let i = 0; i < 34; i++)
    snowP.push({ x: Math.random() * W, y: Math.random() * H, v: 16 + Math.random() * 16, p: Math.random() * 6 });
  for (let i = 0; i < 10; i++)
    flies.push({ x: Math.random() * W, y: 150 + Math.random() * 70, p: Math.random() * 6, s: .4 + Math.random() * .6 });
}

export function setContext(info){ ctxInfo = info; }

/* ---------------------------------------------------------
   タップ
   --------------------------------------------------------- */
function onDown(ev){
  ev.preventDefault();
  const p = canvasPos(cv, ev);
  const st = S.fs[S.field];
  if (!st) return;
  let best = null, bd = 1e9;
  for (const n of st.nodes){
    const d = Math.hypot(n.x * W - p.x, n.y * H - p.y);
    if (d < bd){ bd = d; best = n; }
  }
  if (best && bd < 26){
    player.target = best;
    sound.sfx('tap');
  } else if (p.y > 150){
    player.target = { free: true, x: clamp(p.x, 10, W - 10) / W, y: p.y / H };
  }
}

/* ---------------------------------------------------------
   1つ ひろう
   --------------------------------------------------------- */
function doPick(node){
  const res = pickNode(S.field, node.id, ctxInfo ? ctxInfo.rareBoost : 0);
  if (!res) return;
  if (res.full){
    popText(fx, node.x, node.y - .04, 'かごが いっぱい', '#ffd9a0');
    sound.sfx('drop');
    player.target = null;
    return;
  }
  sound.sfx('pick');
  popText(fx, node.x, node.y - .05, 'ひろった！', '#fff4d8');
  if (res.find) popText(fx, clamp(node.x + .12, .08, .92), node.y - .12, 'みつけもの', '#c8f0c0');
  player.action = .35;
  if (onPicked) onPicked(res);
}

/* まとめて ひろう */
export function collectAll(){
  const st = S.fs[S.field];
  if (!st || !st.nodes.length) return 0;
  let n = 0;
  const list = [...st.nodes];
  for (const node of list){
    if (S.basket.length >= BASKET_MAX) break;
    doPick(node); n++;
  }
  return n;
}

/* ---------------------------------------------------------
   背景（動かない ぶぶんは 作りおき）
   --------------------------------------------------------- */
function backdrop(field, sky, phase, weather){
  const key = field.id + '|' + phase + '|' + weather.id;
  if (bgKey === key && bg) return bg;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const b = c.getContext('2d');
  b.imageSmoothingEnabled = false;
  const seed = hashInt(field.id.length * 31, field.id.charCodeAt(0), 7) % 100000;
  const fill = (x, y, w, h, col) => { b.fillStyle = typeof col === 'string' ? col : rgb2hex(...col); b.fillRect(x | 0, y | 0, w | 0, h | 0); };

  /* ---- 空（だんだん の しま） ---- */
  const skyBot = field.scene === 'cave' ? 60 : HY + 8;
  if (field.scene === 'cave'){
    for (let y = 0; y < skyBot; y++){
      const q = Math.round(y / skyBot * 5) / 5;
      fill(0, y, W, 1, mixc('#22242c', '#3a3a44', q));
    }
  } else {
    for (let y = 0; y < skyBot; y++){
      const q = Math.round(y / skyBot * 7) / 7;
      fill(0, y, W, 1, mixc(sky.top, sky.bot, q));
    }
    /* お日さま / 月 / 星 */
    if (phase === 'night'){
      const rs = rng(seed + 1);
      for (let i = 0; i < 46; i++){
        const x = (rs() * W) | 0, y = (rs() * (skyBot - 12)) | 0;
        const a = rs();
        fill(x, y, 1, 1, a > .7 ? '#ffffff' : a > .35 ? '#dfe8ff' : '#9fb0d8');
      }
      // 月
      fill(118, 18, 12, 12, '#f4f2e0');
      fill(116, 20, 12, 12, sky.top);
      fill(119, 19, 10, 10, '#fdfbe8');
      fill(117, 21, 10, 10, sky.top);
    } else if (weather.id === 'clear' || weather.id === 'drizzle'){
      const sx = phase === 'dusk' ? 38 : 126, sy = phase === 'dusk' ? 70 : 26;
      const disc = (r, a) => {
        b.globalAlpha = a;
        for (let dy = -r; dy <= r; dy++){
          const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
          if (w > 0) fill(sx - w, sy + dy, w * 2, 1, sky.sun);
        }
        b.globalAlpha = 1;
      };
      disc(11, .16); disc(8, .22); disc(5, 1);
    }
    /* くも */
    const rc = rng(seed + 2);
    const nCloud = weather.id === 'clear' ? 2 : weather.id === 'cloud' ? 5 : 4;
    for (let i = 0; i < nCloud; i++){
      const x = (rc() * (W - 30)) | 0, y = 8 + ((rc() * (skyBot - 34)) | 0);
      const cc = phase === 'night' ? '#5a668a' : weather.id === 'clear' ? '#ffffff' : '#e2e4e2';
      const wd = 16 + ((rc() * 22) | 0);
      b.globalAlpha = phase === 'night' ? .5 : .85;
      fill(x, y + 3, wd, 4, cc);
      fill(x + 3, y, wd - 8, 4, cc);
      fill(x + wd - 8, y + 1, 7, 3, cc);
      b.globalAlpha = 1;
    }
  }

  /* ---- ばしょごとの 地形 ---- */
  const land = sky.land, water = sky.water;
  // 手前の 川原は 草いろ ではなく 砂利いろ
  const bank = rgb2hex(...mixc(land, '#a89a80', .78));
  const litc = c => rgb2hex(...mixc(c, '#ffffff', .3));

  if (field.scene === 'river' || field.scene === 'night'){
    // とおくの 山
    const h1 = hillLine(W, HY - 14, 7, seed + 11, .045);
    const h2 = hillLine(W, HY - 4, 5, seed + 21, .07);
    for (let x = 0; x < W; x++){
      fill(x, h1[x], 1, HY + 10 - h1[x], mixc(land, phase === 'night' ? '#2b3a44' : '#7f8f6a', .55));
      fill(x, h2[x], 1, HY + 12 - h2[x], mixc(land, phase === 'night' ? '#22303a' : '#6c8055', .38));
    }
    // 木の シルエット
    const rt = rng(seed + 31);
    for (let i = 0; i < 22; i++){
      const x = (rt() * W) | 0, hh = 5 + ((rt() * 7) | 0);
      const base = h2[clamp(x, 0, W - 1)] + 1;
      const col = phase === 'night' ? '#1b2630' : mixc(land, '#3f5a30', .8);
      fill(x, base - hh, 1, hh, col);
      fill(x - 1, base - hh + 2, 3, hh - 3, col);
    }
    // 川
    const wt = HY + 10, wb = 150;
    for (let y = wt; y < wb; y++){
      const q = (y - wt) / (wb - wt);
      fill(0, y, W, 1, mixc(water, phase === 'night' ? '#22344a' : litc(water), 1 - q * .8));
    }
    // 岸（手前）
    const gl = hillLine(W, wb, 3, seed + 41, .09);
    for (let x = 0; x < W; x++){
      // 手前ほど すこし 暗く して 奥ゆきを 出す
      for (let y = gl[x]; y < H; y++){
        const q = (y - gl[x]) / (H - gl[x]);
        fill(x, y, 1, 1, mixc(bank, '#7d7160', q * .35));
      }
    }
    gravel(b, gl, bank, seed);
    grass(b, gl, seed, phase);
    // 水ぎわの あわ
    for (let x = 0; x < W; x++) if (hashInt(x, 3, seed) % 3 === 0) fill(x, gl[x] - 1, 1, 1, litc(water));
  }

  if (field.scene === 'stream'){
    // 両がわの 岩
    const wt = 60, wb = 156;
    const deep = mixc(water, '#4a86a0', .3);
    for (let y = wt; y < wb; y++){
      const q = (y - wt) / (wb - wt);
      fill(0, y, W, 1, mixc(deep, litc(water), Math.round(q * 4) / 4 * .8));
    }
    const rr = rng(seed + 3);
    for (let side = 0; side < 2; side++){
      for (let y = 40; y < H; y += 2){
        const wdt = 26 + Math.round(fbm(y * .06, side * 3, seed + 9, 3) * 34);
        const x = side ? W - wdt : 0;
        fill(x, y, wdt, 2, mixc('#6b6a58', '#8d8a70', (fbm(y * .2, side, seed, 2))));
      }
    }
    // こけ
    for (let i = 0; i < 120; i++){
      const side = rr() < .5;
      const y = 44 + ((rr() * (H - 60)) | 0);
      const wdt = 26 + Math.round(fbm(y * .06, side ? 3 : 0, seed + 9, 3) * 34);
      const x = side ? W - wdt + ((rr() * 8) | 0) : wdt - 1 - ((rr() * 8) | 0);
      fill(x, y, 1 + ((rr() * 2) | 0), 1, mixc('#4e7a42', '#7fae5c', rr()));
    }
    // 小さな 滝
    for (let y = 40; y < 62; y++) fill(24 + ((Math.sin(y * .5) * 2) | 0), y, 7, 1, '#e8f6f8');
    // 手前の 川原
    const gl = hillLine(W, 156, 3, seed + 41, .1);
    for (let x = 0; x < W; x++) fill(x, gl[x], 1, H - gl[x], bank);
    gravel(b, gl, bank, seed);
    grass(b, gl, seed + 2, phase);
    lily(b, seed);
  }

  if (field.scene === 'beach'){
    // うみ
    const wt = HY + 6, wb = 146;
    for (let y = wt; y < wb; y++){
      const q = (y - wt) / (wb - wt);
      fill(0, y, W, 1, mixc(mixc(water, '#2f6f8f', .35), litc(water), q));
    }
    // 波の 線
    for (let i = 0; i < 26; i++){
      const y = wt + 4 + ((hashInt(i, 1, seed) % (wb - wt - 8)));
      const x = hashInt(i, 2, seed) % (W - 18);
      fill(x, y, 8 + hashInt(i, 3, seed) % 10, 1, '#eaf8fb');
    }
    // なみうちぎわ
    const sl = hillLine(W, wb, 2, seed + 51, .12);
    const wet = mixc(land, '#dcc79e', .8);
    for (let x = 0; x < W; x++){
      fill(x, sl[x] - 2, 1, 3, '#f4fbfd');
      fill(x, sl[x] + 1, 1, H - sl[x], wet);
    }
    // ぬれた 砂の つぶ
    const dl = hillLine(W, 178, 3, seed + 61, .09);
    for (let x = 0; x < W; x++){
      for (let y = sl[x] + 2; y < dl[x]; y++){
        const h = hashInt(x, y, seed + 3);
        if (h % 12 === 0) fill(x, y, 1, 1, mixc(wet, '#ffffff', .3));
        else if (h % 17 === 0) fill(x, y, 1, 1, mixc(wet, '#6a5a44', .28));
        else if (h % 97 === 0) fill(x, y, 2, 1, mixc(wet, '#8fb8c0', .5));   // 水たまり
      }
    }
    // かわいた すな
    for (let x = 0; x < W; x++) fill(x, dl[x], 1, H - dl[x], mixc(land, '#f0e0bc', .86));
    gravel(b, dl, mixc(land, '#f0e0bc', .86), seed + 5);
    // 貝がら
    const rs2 = rng(seed + 71);
    for (let i = 0; i < 12; i++){
      const x = 6 + ((rs2() * (W - 12)) | 0), y = 182 + ((rs2() * 50) | 0);
      fill(x, y, 3, 2, '#fdf2e2'); fill(x + 1, y - 1, 1, 1, '#f0d8c0');
    }
  }

  if (field.scene === 'mountain'){
    // ごつごつの 山
    const h1 = hillLine(W, HY - 24, 16, seed + 11, .05);
    const h2 = hillLine(W, HY, 12, seed + 22, .08);
    for (let x = 0; x < W; x++){
      fill(x, h1[x], 1, H - h1[x], mixc('#7d7566', '#9a9184', noise2(x * .1, 0, seed) ));
      fill(x, h2[x], 1, H - h2[x], mixc('#8d8272', '#aaa08e', noise2(x * .12, 3, seed)));
    }
    // 岩の かたまり
    const rr = rng(seed + 33);
    for (let i = 0; i < 26; i++){
      const x = (rr() * W) | 0, y = 110 + ((rr() * 120) | 0), s = 4 + ((rr() * 9) | 0);
      const col = mixc('#6e675c', '#b3aa9a', rr());
      fill(x, y, s, Math.max(2, (s * .7) | 0), col);
      fill(x + 1, y - 1, s - 2, 1, mixc(col, '#ffffff', .3));
    }
    grass(b, hillLine(W, 150, 4, seed + 41, .1), seed + 3, phase, .35);
    // 小さな みずたまり
    fill(96, 206, 34, 10, water);
    fill(98, 205, 30, 2, litc(water));
  }

  if (field.scene === 'cave'){
    // 岩の かべ（天じょうの ふちは ぎざぎざ）
    const ceil = hillLine(W, 42, 6, seed + 13, .07);
    for (let x = 0; x < W; x++){
      for (let y = ceil[x]; y < H; y++){
        const n = fbm(x * .07, y * .05, seed, 3);
        fill(x, y, 1, 1, mixc('#48443d', '#6e6959', n));
      }
    }
    // 岩の でこぼこ
    const rk = rng(seed + 61);
    for (let i = 0; i < 20; i++){
      const x = (rk() * W) | 0, y = 46 + ((rk() * 70) | 0), s = 6 + ((rk() * 14) | 0);
      const col = mixc('#413d36', '#605a4e', rk() * .8);
      const hh = s * .6;
      for (let dy = 0; dy < hh; dy++){
        const w = Math.round(s * Math.sin((dy / hh) * Math.PI) * .5 + 2);
        fill(x - w, y + dy, w * 2, 1, dy < 1 ? mixc(col, '#a09684', .5) : col);
      }
      fill(x - 2, y + hh, 5, 1, mixc(col, '#1e1b17', .5));   // 下がわの かげ
    }
    // いずみ（ふちは でこぼこ）
    const pl = hillLine(W, 120, 4, seed + 77, .11);
    const pr = hillLine(W, 170, 3, seed + 88, .1);
    for (let x = 14; x < W - 14; x++){
      const inset = Math.round(Math.pow(Math.abs((x - W / 2) / (W / 2 - 14)), 3) * 26);
      for (let y = pl[x] + inset; y < pr[x] - Math.round(inset * .3); y++){
        const q = (y - pl[x]) / 50;
        fill(x, y, 1, 1, mixc('#28414e', '#6396a8', clamp(q, 0, 1)));
      }
    }
    // 手前の 岩だな
    const gl = hillLine(W, 172, 3, seed + 41, .1);
    for (let x = 0; x < W; x++) fill(x, gl[x], 1, H - gl[x], mixc('#57524a', '#7a7266', noise2(x * .13, 2, seed)));
    gravel(b, gl, '#6a6459', seed + 7);
    // ひかる こけ
    const rr = rng(seed + 91);
    for (let i = 0; i < 34; i++){
      const x = (rr() * W) | 0, y = 50 + ((rr() * 110) | 0);
      fill(x, y, 1, 1, mixc('#8ff0d8', '#ffffff', rr() * .5));
    }
    // つらら（天じょうから ぶら下がる）
    const rs = rng(seed + 5);
    for (let i = 0; i < 16; i++){
      const x = (rs() * W) | 0;
      const top = ceil[clamp(x, 0, W - 1)] - 22;
      const len = 10 + ((rs() * 26) | 0), wdt = 2 + ((rs() * 3) | 0);
      for (let k = 0; k < len; k++){
        const ww = Math.max(1, Math.round(wdt * (1 - k / len)));
        fill(x, top + k, ww, 1, mixc('#5f5f6b', '#9a9aa8', 1 - k / len));
      }
      fill(x, top + len, 1, 1, '#cfe8f0');
    }
    // ひかりの さしこみ
    b.globalAlpha = .13;
    b.fillStyle = '#e8f4ff';
    b.beginPath(); b.moveTo(30, 0); b.lineTo(54, 0); b.lineTo(98, 160); b.lineTo(60, 160); b.closePath(); b.fill();
    b.globalAlpha = 1;
    // 左右を すこし 暗く（どうくつの おくゆき）
    for (let x = 0; x < W; x++){
      const e = Math.max(0, 1 - Math.min(x, W - 1 - x) / 34);
      if (e <= 0) continue;
      b.globalAlpha = e * .38; b.fillStyle = '#151318';
      b.fillRect(x, 0, 1, H);
    }
    b.globalAlpha = 1;
  }

  bg = c; bgKey = key;
  return bg;
}

/* 砂利 */
function gravel(b, line, base, seed){
  for (let x = 0; x < W; x++){
    for (let y = line[x]; y < H; y += 1){
      const h = hashInt(x, y, seed);
      if (h % 17 === 0){
        b.fillStyle = rgb2hex(...mixc(base, '#ffffff', .26));
        b.fillRect(x, y, 1 + (h % 2), 1);
      } else if (h % 29 === 0){
        b.fillStyle = rgb2hex(...mixc(base, '#4a3f2c', .3));
        b.fillRect(x, y, 1 + (h % 3), 1);
      } else if (h % 211 === 0){
        // ときどき 大きめの 小石
        const col = mixc(base, h % 2 ? '#8f8574' : '#cfc4ac', .55);
        b.fillStyle = rgb2hex(...col);
        b.fillRect(x, y, 3, 2);
        b.fillStyle = rgb2hex(...mixc(col, '#ffffff', .35));
        b.fillRect(x, y, 2, 1);
      }
    }
  }
}

/* 草 */
function grass(b, line, seed, phase, dens = 1){
  const r = rng(seed + 777);
  const n = Math.round(70 * dens);
  for (let i = 0; i < n; i++){
    const x = (r() * W) | 0;
    const y0 = line[clamp(x, 0, W - 1)];
    const hh = 2 + ((r() * 4) | 0);
    const col = phase === 'night' ? mixc('#2e4436', '#44604a', r()) : mixc('#5d8347', '#8fb861', r());
    b.fillStyle = rgb2hex(...col);
    for (let k = 0; k < hh; k++) b.fillRect(x + ((k > 1 && r() < .5) ? 1 : 0), y0 - 1 - k, 1, 1);
  }
}

/* 白い 小花 */
function lily(b, seed){
  const r = rng(seed + 313);
  for (let i = 0; i < 10; i++){
    const x = 6 + ((r() * (W - 12)) | 0), y = 168 + ((r() * 60) | 0);
    b.fillStyle = '#fdfbf0'; b.fillRect(x, y, 2, 2);
    b.fillStyle = '#f0d878'; b.fillRect(x, y, 1, 1);
  }
}

/* ---------------------------------------------------------
   人（10×18くらいの ドット絵）
   --------------------------------------------------------- */
function drawPerson(x, y, dir, walk, action){
  const px = Math.round(x) - 3, py = Math.round(y);
  const skin = '#f0cfa8', hat = '#a8c48c', hatD = '#7f9c69',
        coat = '#eae0d2', coatD = '#c9bda9', pants = '#7d8fa8', boot = '#5a4a3a', hair = '#5a4636';
  const bob = walk && Math.sin(walk * 11) > 0 ? -1 : 0;
  const r = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(px + dx, py + dy + bob, w, h); };

  // かげ（ゆれない）
  g.globalAlpha = .18; g.fillStyle = '#3a2f22';
  g.fillRect(px - 2, py + 1, 10, 2);
  g.globalAlpha = 1;

  // かご（せなか）
  r(dir > 0 ? -3 : 6, -13, 3, 6, '#b98a52');
  r(dir > 0 ? -3 : 6, -13, 3, 1, '#8f6a3c');
  // あし
  const step = walk ? (Math.sin(walk * 11) > 0 ? 1 : -1) : 0;
  r(1, -6, 2, 4, pants);
  r(3, -6, 2, 4, pants);
  r(1 + (step > 0 ? -1 : 0), -2, 2, 2, boot);
  r(3 + (step < 0 ? 1 : 0), -2, 2, 2, boot);
  // どうたい
  r(0, -14, 6, 9, coat);
  r(0, -7, 6, 1, coatD);
  // うで
  const ay = action > 0 ? -10 : -12, ah = action > 0 ? 4 : 6;
  r(dir > 0 ? 5 : -1, ay, 2, ah, coat);
  // あたま
  r(1, -19, 4, 5, skin);
  r(1, -19, 4, 1, hair);
  // ぼうし
  r(-1, -20, 8, 2, hat);
  r(1, -22, 4, 2, hat);
  r(1, -20, 4, 1, hatD);
  // め
  r(dir > 0 ? 4 : 1, -17, 1, 1, '#4a3b2e');
}

/* ---------------------------------------------------------
   毎フレームの 描画
   --------------------------------------------------------- */
export function draw(dt){
  if (!ctxInfo) return;
  t += dt;
  const field = FIELD_BY_ID[S.field];
  const { sky, weather, time } = ctxInfo;
  g.drawImage(backdrop(field, sky, time.phase, weather), 0, 0);

  /* ---- 水面の きらめき ---- */
  const zones = {
    river: [HY + 10, 150], night: [HY + 10, 150], stream: [60, 156],
    beach: [HY + 6, 146], cave: [126, 164], mountain: [206, 216],
  }[field.scene] || [HY + 10, 150];
  const lc = rgb2hex(...mixc(sky.water, '#ffffff', time.phase === 'night' ? .35 : .55));
  for (let y = zones[0] + 2; y < zones[1] - 1; y += 3){
    const seedy = (y * 37) % 100;
    const spd = .18 + (seedy % 7) * .04;
    const wdt = 5 + (seedy % 8);
    let x = ((Math.sin(t * spd + seedy) * .5 + .5) * (W - wdt - 8) + (seedy % 12)) | 0;
    if (field.scene === 'stream'){
      x = ((t * 26 + seedy * 13) % (W - wdt)) | 0;
    }
    if (field.scene === 'cave' && (x < 30 || x > W - 30 - wdt)) continue;
    g.fillStyle = lc;
    g.fillRect(x, y, wdt, 1);
  }
  /* 月・日の 反射 */
  if (time.phase === 'night' && (field.scene === 'river' || field.scene === 'night')){
    for (let i = 0; i < 5; i++){
      const y = zones[0] + 6 + i * 6;
      const w = 10 - i;
      g.fillStyle = 'rgba(250,246,220,.5)';
      g.fillRect(118 - (w >> 1) + ((Math.sin(t * .8 + i) * 2) | 0), y, w, 1);
    }
  }

  /* ---- ほたる / 星のかけら ---- */
  if (time.phase === 'night' || field.scene === 'cave'){
    for (const f of flies){
      f.p += dt * f.s;
      const x = f.x + Math.sin(f.p) * 8, y = f.y + Math.cos(f.p * .7) * 5;
      const a = .35 + .65 * Math.max(0, Math.sin(f.p * 1.7));
      g.globalAlpha = a;
      g.fillStyle = field.scene === 'cave' ? '#9ff0e0' : '#f8f0a0';
      g.fillRect(x | 0, y | 0, 1, 1);
      g.globalAlpha = a * .3;
      g.fillRect((x | 0) - 1, (y | 0) - 1, 3, 3);
      g.globalAlpha = 1;
    }
  }

  /* ---- どろだんご ---- */
  const st = S.fs[S.field];
  if (st){
    for (const n of st.nodes){
      const x = Math.round(n.x * W), y = Math.round(n.y * H);
      const size = 13 + (hashInt(n.seed, 1, 3) % 4);
      g.globalAlpha = .2; g.fillStyle = '#3a2f22';
      g.fillRect(x - (size >> 1), y + (size >> 1) - 1, size, 2);
      g.globalAlpha = 1;
      const bobY = Math.sin(t * 2 + n.seed % 7) > .96 ? -1 : 0;
      g.drawImage(renderMud(n.seed, size), x - (size >> 1), y - (size >> 1) + bobY);
      // ちょっと きらり
      const ph = (t * .8 + (n.seed % 10)) % 4;
      if (ph < .3){
        g.fillStyle = '#fffbe0';
        g.fillRect(x + (size >> 1) - 2, y - (size >> 1), 1, 1);
        g.fillRect(x + (size >> 1) - 3, y - (size >> 1) + 1, 3, 1);
      }
    }
  }

  /* ---- 人 ---- */
  const tgt = player.target;
  let groundY = 214;
  if (tgt){
    const tx = (tgt.free ? tgt.x : tgt.x) * W;
    const ty = (tgt.free ? tgt.y : tgt.y) * H;
    const dx = tx - player.x;
    if (Math.abs(dx) > 2){
      player.dir = dx > 0 ? 1 : -1;
      player.x += Math.sign(dx) * Math.min(Math.abs(dx), 46 * dt);
      player.walk += dt;
    } else {
      player.walk = 0;
      if (!tgt.free){
        const still = S.fs[S.field].nodes.some(n => n.id === tgt.id);
        if (still) doPick(tgt);
      }
      player.target = null;
    }
    groundY = clamp(ty + 6, 168, 232);
    player.gy = player.gy == null ? groundY : player.gy + (groundY - player.gy) * Math.min(1, dt * 6);
  } else {
    player.walk = 0;
    // ときどき ぶらぶら
    if (Math.random() < dt * .12){
      player.target = { free: true, x: clamp((player.x + (Math.random() - .5) * 60) / W, .08, .92), y: (player.gy || 214) / H };
    }
  }
  if (player.action > 0) player.action -= dt;
  drawPerson(player.x, player.gy || 214, player.dir, player.walk, player.action);

  /* ---- 鳥 ---- */
  if (time.phase !== 'night' && weather.rain < .5){
    if (Math.random() < dt * .05 && birds.length < 2)
      birds.push({ x: -10, y: 20 + Math.random() * 40, v: 16 + Math.random() * 12, p: 0 });
    for (const b of birds){
      b.x += b.v * dt; b.p += dt * 8;
      const yy = b.y + Math.sin(b.p * .3) * 3;
      const up = Math.sin(b.p) > 0;
      g.fillStyle = time.phase === 'dusk' ? '#6a5a4a' : '#5f6b72';
      g.fillRect(b.x | 0, yy | 0, 1, 1);
      g.fillRect((b.x | 0) - 2, (yy | 0) + (up ? -1 : 1), 2, 1);
      g.fillRect((b.x | 0) + 1, (yy | 0) + (up ? -1 : 1), 2, 1);
    }
    birds = birds.filter(b => b.x < W + 12);
  }

  /* ---- 雨・雪・きり ---- */
  if (weather.rain > 0){
    g.strokeStyle = 'rgba(210,232,240,.65)';
    g.lineWidth = 1;
    const n = Math.round(rainP.length * weather.rain);
    g.beginPath();
    for (let i = 0; i < n; i++){
      const p = rainP[i];
      p.y += p.v * dt; p.x += 14 * dt;
      if (p.y > H){ p.y = -4; p.x = Math.random() * W; }
      g.moveTo(p.x | 0, p.y | 0);
      g.lineTo((p.x | 0) - 1, (p.y | 0) + 4);
    }
    g.stroke();
  }
  if (weather.snow > 0){
    g.fillStyle = '#ffffff';
    for (const p of snowP){
      p.y += p.v * dt; p.p += dt;
      p.x += Math.sin(p.p) * 8 * dt;
      if (p.y > H){ p.y = -2; p.x = Math.random() * W; }
      g.fillRect(p.x | 0, p.y | 0, 1, 1);
    }
  }
  if (weather.fog > 0){
    for (let i = 0; i < 4; i++){
      const y = 100 + i * 26;
      g.globalAlpha = .10 * weather.fog;
      g.fillStyle = '#ffffff';
      g.fillRect(0, y + ((Math.sin(t * .3 + i) * 3) | 0), W, 12);
    }
    g.globalAlpha = weather.fog * .16;
    g.fillStyle = '#e8eef0';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }

  /* ---- 夜は すこし 暗く ---- */
  if (time.phase === 'night'){
    g.globalAlpha = .14; g.fillStyle = '#101830'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  } else if (time.phase === 'dusk'){
    g.globalAlpha = .10; g.fillStyle = '#ff9a5a'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
}

export function nodeCount(){
  const st = S.fs[S.field];
  return st ? st.nodes.length : 0;
}
export function resetBackdrop(){ bgKey = ''; }
