/* =========================================================
   shelf.js — たな（あつめた石を ならべて ながめる）
   ========================================================= */

import { renderStone, STONE_BY_ID, FIND_BY_ID, FINDS, glossRank } from './stones.js';
import { S, save, placeOnShelf, clearSlot, shelfAt, stoneByUid } from './state.js';
import { $, toast, canvasPos, murmur } from './ui.js';
import { makeCv, mixc, rgb2hex } from './pixel.js';
import * as sound from './audio.js';
import * as weather from './weather.js';

const W = 160, H = 176;
const ROWS = 3, COLS = 6;
const ROW_Y = [56, 104, 152];      // たな板の 上のふち
const COL_X = [22, 46, 70, 94, 118, 142];

let g, cv, sel = null, bgCache = null, bgKey = '';
let t = 0;

export function init(canvas){
  cv = canvas;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  cv.addEventListener('pointerdown', onDown);
}

function slotAt(x, y){
  for (let r = 0; r < ROWS; r++){
    const by = ROW_Y[r];
    if (y > by - 26 && y < by + 4){
      for (let c = 0; c < COLS; c++){
        if (Math.abs(x - COL_X[c]) < 12) return r * COLS + c;
      }
    }
  }
  return -1;
}

function onDown(ev){
  ev.preventDefault();
  const p = canvasPos(cv, ev);
  const slot = slotAt(p.x, p.y);
  if (slot < 0) return;
  const cur = shelfAt(slot);
  if (cur){
    clearSlot(slot);
    sound.sfx('drop');
    render();
    return;
  }
  if (!sel){ toast('したの いしばこから えらんでね'); return; }
  placeOnShelf(slot, sel.kind, sel.ref);
  sound.sfx('pick');
  sel = null;
  render();
}

/* ---------- 背景 ---------- */
function backdrop(){
  const info = weather.cached();
  const key = info.time.phase + info.weather.id;
  if (bgCache && bgKey === key) return bgCache;
  const { cv: c, g: b } = makeCv(W, H);
  const sky = info.sky;

  // かべ
  for (let y = 0; y < H; y++){
    b.fillStyle = rgb2hex(...mixc('#f0e5cf', '#dbc9a8', y / H));
    b.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 420; i++){
    b.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.22)' : 'rgba(150,125,95,.1)';
    b.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
  }
  // まど（左うえ）
  const wx = 10, wy = 5, ww = 38, wh = 25;
  for (let y = wy; y < wy + wh; y++){
    b.fillStyle = rgb2hex(...mixc(sky.top, sky.bot, Math.round((y - wy) / wh * 4) / 4));
    b.fillRect(wx, y, ww, 1);
  }
  b.fillStyle = rgb2hex(...mixc(sky.land, '#5f7a4a', .5));
  b.fillRect(wx, wy + wh - 7, ww, 7);
  b.fillStyle = '#8f6a3c';
  b.fillRect(wx - 3, wy - 3, ww + 6, 3); b.fillRect(wx - 3, wy + wh, ww + 6, 3);
  b.fillRect(wx - 3, wy - 3, 3, wh + 6); b.fillRect(wx + ww, wy - 3, 3, wh + 6);
  b.fillStyle = '#a8804c';
  b.fillRect(wx + (ww >> 1), wy, 1, wh);

  // たな板
  for (const y of ROW_Y){
    b.fillStyle = '#c69a5e'; b.fillRect(4, y, W - 8, 5);
    b.fillStyle = '#e0b880'; b.fillRect(4, y, W - 8, 1);
    b.fillStyle = '#9a6f3f'; b.fillRect(4, y + 4, W - 8, 1);
    // ささえ
    b.fillStyle = '#a8804c'; b.fillRect(6, y + 5, 3, 4); b.fillRect(W - 9, y + 5, 3, 4);
    // 板の 木目
    b.fillStyle = 'rgba(120,85,45,.25)';
    for (let x = 8; x < W - 8; x += 11) b.fillRect(x, y + 2, 5, 1);
  }
  // 小さな 植木ばち（右うえ）
  b.fillStyle = '#c98a6a'; b.fillRect(132, 30, 12, 10);
  b.fillStyle = '#a86a4a'; b.fillRect(131, 28, 14, 3);
  b.fillStyle = '#6f9a54';
  b.fillRect(135, 22, 2, 7); b.fillRect(139, 20, 2, 9);
  b.fillStyle = '#8fbf6a'; b.fillRect(134, 21, 2, 2); b.fillRect(140, 19, 2, 2);

  bgCache = c; bgKey = key;
  return c;
}
export function resetBackdrop(){ bgKey = ''; }

/* ---------- 毎フレーム ---------- */
export function draw(dt){
  t += dt;
  g.clearRect(0, 0, W, H);
  g.drawImage(backdrop(), 0, 0);

  for (const item of S.shelf){
    const r = Math.floor(item.slot / COLS), c = item.slot % COLS;
    if (r >= ROWS) continue;
    const cx = COL_X[c], by = ROW_Y[r];
    if (item.kind === 'stone'){
      const st = stoneByUid(item.ref);
      if (!st) continue;
      const size = 22;
      // かげ
      g.globalAlpha = .2; g.fillStyle = '#6a4f30';
      g.fillRect(cx - 8, by - 1, 16, 2); g.globalAlpha = 1;
      g.drawImage(renderStone(st.id, st.seed, size, 'normal', st.gloss), cx - size / 2, by - size + 1, size, size);
      // つやが 高いと きらり
      if (st.gloss > .6){
        const ph = (t * .7 + item.slot) % 5;
        if (ph < .3){
          g.fillStyle = 'rgba(255,253,235,.9)';
          g.fillRect(cx + 4, by - size + 3, 1, 3);
          g.fillRect(cx + 3, by - size + 4, 3, 1);
        }
      }
    } else {
      const f = FIND_BY_ID[item.ref];
      if (!f) continue;
      g.font = '15px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(f.ic, cx, by - 2);
    }
  }

  // えらんでいる ときは おける ところを ひからせる
  if (sel){
    const a = .25 + .2 * Math.sin(t * 4);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      if (shelfAt(r * COLS + c)) continue;
      g.globalAlpha = a;
      g.fillStyle = '#ffe9a0';
      g.fillRect(COL_X[c] - 10, ROW_Y[r] - 20, 20, 20);
      g.globalAlpha = 1;
    }
  }
}

/* ---------- いしばこ（したの 一覧） ---------- */
export function render(){
  const tray = $('#tray-grid');
  tray.innerHTML = '';
  const placed = new Set(S.shelf.filter(s => s.kind === 'stone').map(s => s.ref));
  const list = [...S.stones].reverse();

  for (const st of list){
    const def = STONE_BY_ID[st.id];
    if (!def) continue;
    const cell = document.createElement('div');
    cell.className = 'cell' + (sel && sel.kind === 'stone' && sel.ref === st.uid ? ' sel' : '');
    if (placed.has(st.uid)) cell.style.opacity = '.4';
    const src = renderStone(st.id, st.seed, 36, 'normal', st.gloss);
    const c = document.createElement('canvas');
    c.width = 36; c.height = 36;
    c.getContext('2d').drawImage(src, 0, 0);
    cell.appendChild(c);
    const nm = document.createElement('span');
    nm.className = 'name';
    nm.textContent = def.name;
    cell.appendChild(nm);
    cell.addEventListener('click', () => {
      sel = (sel && sel.kind === 'stone' && sel.ref === st.uid) ? null : { kind: 'stone', ref: st.uid };
      sound.sfx('tap');
      render();
      $('#tray-hint').textContent = sel
        ? `「${def.name}」を たなに タップして おく`
        : '石を えらんで、たなを タップ';
      $('#shelf-murmur').textContent = sel ? `${glossRank(st.gloss).label}の ${def.name}。` : murmur();
    });
    tray.appendChild(cell);
  }

  // みつけもの
  for (const f of FINDS){
    const n = S.finds[f.id] || 0;
    if (!n) continue;
    const cell = document.createElement('div');
    cell.className = 'cell find-cell' + (sel && sel.kind === 'find' && sel.ref === f.id ? ' sel' : '');
    cell.textContent = f.ic;
    const c = document.createElement('span');
    c.className = 'n'; c.textContent = '×' + n;
    cell.appendChild(c);
    cell.addEventListener('click', () => {
      sel = (sel && sel.kind === 'find' && sel.ref === f.id) ? null : { kind: 'find', ref: f.id };
      sound.sfx('tap');
      render();
      $('#tray-hint').textContent = sel ? `「${f.name}」を たなに タップして おく` : '石を えらんで、たなを タップ';
    });
    tray.appendChild(cell);
  }

  const empty = S.stones.length === 0 && Object.keys(S.finds).length === 0;
  $('#tray-empty').style.display = empty ? '' : 'none';
  $('#tray-grid').style.display = empty ? 'none' : '';
}
