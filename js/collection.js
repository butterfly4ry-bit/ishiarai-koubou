/* =========================================================
   collection.js — いしころ ずかん
   ========================================================= */

import { STONES, FINDS, renderStone, stars, glossRank } from './stones.js';
import { S, save, dexCount, dexTotal } from './state.js';
import { $, modal, toast } from './ui.js';
import * as sound from './audio.js';

export function render(){
  const grid = $('#dex-grid');
  grid.innerHTML = '';
  for (const def of STONES){
    const d = S.dex[def.id];
    const cell = document.createElement('div');
    cell.className = 'cell' + (d ? '' : ' locked') + (S.newDex[def.id] ? ' newmark' : '');
    if (d){
      const cv = renderStone(def.id, d.seed || 1, 40, 'normal', d.best || 0);
      const c2 = cv.cloneNode();
      c2.getContext('2d').drawImage(cv, 0, 0);
      cell.appendChild(c2);
      const nm = document.createElement('span');
      nm.className = 'name'; nm.textContent = def.name;
      cell.appendChild(nm);
      if (d.n > 1){
        const n = document.createElement('span');
        n.className = 'n'; n.textContent = '×' + d.n;
        cell.appendChild(n);
      }
      cell.addEventListener('click', () => openDetail(def));
    } else {
      const q = document.createElement('span');
      q.className = 'q'; q.textContent = '？';
      cell.appendChild(q);
    }
    grid.appendChild(cell);
  }

  $('#dex-found').textContent = dexCount();
  $('#dex-total').textContent = dexTotal();
  $('#dex-bar-fill').style.width = (dexCount() / dexTotal() * 100).toFixed(1) + '%';

  // みつけもの
  const fg = $('#finds-grid');
  fg.innerHTML = '';
  for (const f of FINDS){
    const n = S.finds[f.id] || 0;
    const cell = document.createElement('div');
    cell.className = 'cell find-cell' + (n ? '' : ' locked');
    cell.textContent = n ? f.ic : '？';
    if (n){
      const c = document.createElement('span');
      c.className = 'n'; c.textContent = '×' + n;
      cell.appendChild(c);
      cell.title = f.name;
      cell.addEventListener('click', () => {
        sound.sfx('page');
        modal(f.name, `<p style="text-align:center;font-size:34px;margin:6px 0">${f.ic}</p>
          <p style="font-size:13px">${f.desc}</p>
          <p class="dim" style="margin-top:8px">もっている数: ${n}こ</p>`);
      });
    } else {
      cell.style.color = 'var(--line-2)';
    }
    fg.appendChild(cell);
  }
}

/* ---------- 1つの 石の ページ ---------- */
function openDetail(def){
  sound.sfx('page');
  const d = S.dex[def.id] || { n: 1, best: 0, at: Date.now(), seed: 1 };
  delete S.newDex[def.id];
  save();

  const wrap = document.createElement('div');
  wrap.className = 'detail';

  const two = document.createElement('div');
  two.className = 'two';
  [['あらったところ', 'normal'], ['ひかりに かざして', 'light']].forEach(([cap, mode]) => {
    const fig = document.createElement('figure');
    const src = renderStone(def.id, d.seed || 1, 48, mode, d.best || 0);
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    c.getContext('2d').drawImage(src, 0, 0);
    const fc = document.createElement('figcaption');
    fc.textContent = cap;
    fig.appendChild(c); fig.appendChild(fc);
    two.appendChild(fig);
  });
  wrap.appendChild(two);

  const g = glossRank(d.best || 0);
  const info = document.createElement('div');
  info.innerHTML = `
    <p class="stars" style="margin:8px 0 0">${stars(def.rarity)}</p>
    <p class="dim" style="margin:0">${def.kanji ? def.kanji + ' ・ ' : ''}めずらしさ ${def.rarity}</p>
    <p class="desc">${def.desc}</p>
    <p class="desc" style="color:var(--ink-2);font-style:italic">${def.light}</p>
    <p class="meta">みつけた数 ${d.n}こ ／ いちばんの つや「${g.label}」<br>
       はじめて ${new Date(d.at).toLocaleDateString('ja-JP')}</p>`;
  wrap.appendChild(info);

  const memo = document.createElement('input');
  memo.type = 'text';
  memo.maxLength = 40;
  memo.placeholder = 'メモ（じゆうに かいてね）';
  memo.value = S.memo?.[def.id] || '';
  Object.assign(memo.style, {
    width: '100%', marginTop: '10px', font: 'inherit', fontSize: '13px',
    padding: '8px 10px', borderRadius: '10px', border: '2px solid var(--line)',
    background: 'var(--cream-2)', color: 'var(--ink)', boxSizing: 'border-box',
  });
  memo.addEventListener('input', () => {
    if (!S.memo) S.memo = {};
    S.memo[def.id] = memo.value;
    save();
  });
  wrap.appendChild(memo);

  modal(def.name, wrap, { onClose: render });
}

/* ---------- はじめての 石を みつけたときの おしらせ ---------- */
export function celebrate(def, gloss){
  const g = glossRank(gloss);
  toast(`ずかんに くわわった → <b>${def.name}</b>（${g.label}）`);
}
