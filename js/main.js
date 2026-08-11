/* =========================================================
   main.js — ぜんたいの すすめ役
   画面の きりかえ・くりかえし描画・ボタンの ふるまい
   ========================================================= */

import { STONE_BY_ID, FIELDS, FIELD_BY_ID, FIND_BY_ID,
         renderStone, renderMud, stars, glossRank, TOTAL_STONES } from './stones.js';
import * as st from './state.js';
import { S } from './state.js';
import * as weather from './weather.js';
import * as field from './field.js';
import * as wash from './wash.js';
import * as light from './light.js';
import * as dex from './collection.js';
import * as shelf from './shelf.js';
import * as workshop from './workshop.js';
import * as sound from './audio.js';
import { $, $$, toast, modal, closeModal, initModal, murmur, switchEl } from './ui.js';
import { mixc, rgb2hex, rng } from './pixel.js';

let screen = 'field';
let info = weather.now();
let last = 0, running = false;

/* =========================================================
   はじまり
   ========================================================= */
st.load();
initModal();
buildOpening();
bindTabs();
bindButtons();

field.init($('#cv-field'), $('#field-fx'), onPickedInField);
wash.init($('#cv-wash'), $('#cv-polish'), {
  onWashProgress: p => {
    $('#wash-fill').style.width = (p * 100).toFixed(0) + '%';
    $('#wash-label').textContent = 'どろ ' + Math.max(0, Math.round((1 - p) * 100)) + '%';
    st.save();
  },
  onWashDone: toPolish,
  onPolish: gl => {
    $('#polish-fill').style.width = (gl * 100).toFixed(0) + '%';
    $('#polish-label').textContent = 'つや ' + Math.round(gl * 100) + '%（' + glossRank(gl).label + '）';
    st.save();
  },
});
light.init($('#cv-light'), {
  onReveal: p => {
    $('#light-fill').style.width = (p * 100).toFixed(0) + '%';
    $('#light-label').textContent = p < .99 ? 'すけてきた… ' + Math.round(p * 100) + '%' : 'わかった！';
  },
  onDone: onIdentified,
});
shelf.init($('#cv-shelf'));
workshop.init($('#cv-workshop'), () => { renderBasket(); refreshTop(); });

field.setContext(info);
st.tickSpawns();

/* さいしょは 石が 0こだと さみしいので すこし おいておく */
if (!S.started && S.fs.kawara.nodes.length < 3){
  S.fs.kawara.last = Date.now() - st.SPAWN_MS * 5;
  st.tickSpawns();
}

refreshTop();
renderBasket();
dex.render();
shelf.render();
$('#field-murmur').textContent = weather.weatherLine(info.weather, info.time);
$('#dex-total').textContent = TOTAL_STONES;

/* =========================================================
   オープニング
   ========================================================= */
function buildOpening(){
  drawTitle();
  if (S.started){
    // 2回目からは すぐ はじめる（音は 最初の タップで 出す）
    $('#opening').hidden = true;
    document.addEventListener('pointerdown', firstTouch, { once: true });
    startLoop();
  }
  $('#btn-start').addEventListener('click', () => {
    S.started = true; st.save(true);
    $('#opening').hidden = true;
    sound.init(S.opts);
    if (S.opts.bgm){ sound.startBgm(); ambience(); }
    startLoop();
    toast('かわらに ついた。');
  });
}
function firstTouch(){
  sound.init(S.opts);
  if (S.opts.bgm){ sound.startBgm(); ambience(); }
}

function drawTitle(){
  const cv = $('#cv-title');
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;
  const inf = weather.now();
  for (let y = 0; y < H; y++){
    g.fillStyle = rgb2hex(...mixc(inf.sky.top, inf.sky.bot, Math.round(y / H * 6) / 6));
    g.fillRect(0, y, W, 1);
  }
  // 水
  for (let y = 74; y < 96; y++){
    g.fillStyle = rgb2hex(...mixc(inf.sky.water, '#ffffff', (y - 74) / 40));
    g.fillRect(0, y, W, 1);
  }
  // 岸
  g.fillStyle = rgb2hex(...mixc(inf.sky.land, '#c8b898', .4));
  g.fillRect(0, 96, W, H - 96);
  const r = rng(4242);
  for (let i = 0; i < 200; i++){
    const x = (r() * W) | 0, y = 96 + ((r() * (H - 96)) | 0);
    g.fillStyle = r() < .5 ? 'rgba(255,255,255,.25)' : 'rgba(90,70,45,.2)';
    g.fillRect(x, y, 1, 1);
  }
  // 石 3つ
  const trio = [['agate', 26, 12], ['crystal', 62, 34], ['mossagate', 118, 20]];
  trio.forEach(([id, x, s], i) => {
    const c = renderStone(id, 7 + i * 13, 28, i === 1 ? 'light' : 'normal', 1);
    g.drawImage(c, x, 100 - s, s + 22, s + 22);
  });
  // きらり
  g.fillStyle = '#fffbe0';
  [[54, 60], [96, 74], [30, 88]].forEach(([x, y]) => {
    g.fillRect(x, y - 2, 1, 5); g.fillRect(x - 2, y, 5, 1);
  });
}

/* =========================================================
   タブと 画面
   ========================================================= */
function bindTabs(){
  $$('#tabbar .tab').forEach(b => {
    b.addEventListener('click', () => go(b.dataset.screen));
  });
}

function go(name){
  screen = name;
  $$('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
  $$('.screen').forEach(s => s.classList.remove('on'));
  $('#sc-' + name).classList.add('on');
  sound.sfx('tap');

  if (name === 'wash'){
    if (S.cur) resumeWash();
    else setPhase('pick');
    renderBasket();
  }
  if (name === 'dex') dex.render();
  if (name === 'shelf'){ shelf.render(); $('#shelf-murmur').textContent = murmur(); }
  if (name === 'field') $('#field-murmur').textContent = weather.weatherLine(info.weather, info.time);
  window.scrollTo(0, 0);
}

/* =========================================================
   くりかえし 描画
   ========================================================= */
function startLoop(){
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (screen === 'field') field.draw(dt);
  else if (screen === 'wash'){
    const ph = $('#sc-wash').dataset.phase;
    if (ph === 'wash') wash.drawWash(dt);
    else if (ph === 'polish') wash.drawPolish(dt);
    else if (ph === 'light') light.draw(dt);
    else if (ph === 'pick') workshop.draw(dt);
  }
  else if (screen === 'shelf') shelf.draw(dt);
  requestAnimationFrame(frame);
}

/* =========================================================
   うえの バー
   ========================================================= */
function refreshTop(){
  const f = FIELD_BY_ID[S.field];
  $('#ui-place').textContent = f.short;
  $('#ui-weather').textContent = info.weather.name + '・' + info.time.name;
  $('#ui-weather-ic').textContent = info.weather.ic;
  $('#ui-basket').textContent = S.basket.length;
  $('#chip-basket').querySelector('.dim').textContent = '/' + st.BASKET_MAX;
  const badge = $('#tab-badge');
  const n = S.basket.length + (S.cur ? 1 : 0);
  badge.textContent = n;
  badge.hidden = n === 0;
  const nodes = field.nodeCount();
  $('#btn-collect-all').disabled = nodes === 0;
  $('#btn-collect-all').textContent = nodes ? `まとめて ひろう（${nodes}）` : 'まとめて ひろう';
}

function ambience(){
  const f = FIELD_BY_ID[S.field];
  sound.ambience(screen === 'wash' ? 'river' : f.scene, info.weather);
}

/* =========================================================
   フィールド
   ========================================================= */
function onPickedInField(res){
  refreshTop();
  if (res.find){
    const f = FIND_BY_ID[res.find];
    toast(`${f.ic} ${f.name} も ひろった`);
  }
  if (S.basket.length === st.BASKET_MAX) toast('かごが いっぱい。あらいばへ どうぞ。');
}

function bindButtons(){
  $('#btn-collect-all').addEventListener('click', () => {
    const n = field.collectAll();
    if (!n) toast('いまは 落ちていない。すこし 待とう。');
    refreshTop();
  });

  $('#btn-places').addEventListener('click', openPlaces);
  $('#btn-settings').addEventListener('click', openSettings);

  $$('#sc-wash .btn.tool').forEach(b => {
    b.addEventListener('click', () => {
      $$('#sc-wash .btn.tool').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      wash.setTool(b.dataset.tool);
      sound.sfx('tap');
    });
  });

  $('#btn-wash-back').addEventListener('click', () => {
    st.returnCurToBasket();
    wash.clearStone();
    setPhase('pick');
    renderBasket(); refreshTop();
  });

  $('#btn-to-light').addEventListener('click', () => {
    light.setStone(S.cur);
    setPhase('light');
    $('#light-fill').style.width = '0%';
    $('#light-label').textContent = 'かざして…';
  });

  $('#btn-result-ok').addEventListener('click', () => {
    setPhase('pick'); renderBasket(); refreshTop();
  });
  $('#btn-result-next').addEventListener('click', () => {
    if (S.basket.length){
      beginWash(S.basket[0].uid);
    } else {
      setPhase('pick'); renderBasket(); refreshTop();
      toast('かごが からっぽ。石を ひろいに いこう。');
    }
  });
}

/* ---------- ばしょ えらび ---------- */
function openPlaces(){
  const box = document.createElement('div');
  for (const f of FIELDS){
    const ok = st.isUnlocked(f);
    const b = document.createElement('button');
    b.className = 'list-btn' + (ok ? '' : ' locked') + (f.id === S.field ? ' cur' : '');
    const n = S.fs[f.id] ? S.fs[f.id].nodes.length : 0;
    b.innerHTML = ok
      ? `${f.name}<small>${f.note}　${n ? 'いま ' + n + 'こ 落ちている' : '落ちていない'}</small>`
      : `？？？<small>ずかんが ${f.need}しゅるいに なると 行ける（いま ${st.dexCount()}）</small>`;
    if (ok) b.addEventListener('click', () => {
      S.field = f.id; st.save();
      field.resetBackdrop();
      refreshTop(); ambience();
      $('#field-murmur').textContent = f.note;
      closeModal();
      go('field');
      toast(f.name + 'に きた。');
    });
    box.appendChild(b);
  }
  modal('どこへ 行く？', box);
}

/* ---------- せってい ---------- */
function openSettings(){
  const box = document.createElement('div');
  const row = (label, el) => {
    const d = document.createElement('div');
    d.className = 'set-row';
    const s = document.createElement('span'); s.textContent = label;
    d.appendChild(s); d.appendChild(el);
    box.appendChild(d);
  };
  row('おと（BGM・環境音）', switchEl(S.opts.bgm, v => {
    S.opts.bgm = v; st.save(); sound.setOpts(S.opts);
    if (v){ sound.init(S.opts); sound.startBgm(); ambience(); }
    else { sound.stopBgm(); sound.stopAmbience(); }
  }));
  row('こうかおん', switchEl(S.opts.se, v => { S.opts.se = v; st.save(); sound.setOpts(S.opts); }));

  const stats = document.createElement('p');
  stats.className = 'dim';
  stats.style.marginTop = '12px';
  stats.innerHTML = `ひろった石 ${S.stats.picked}こ ／ あらった石 ${S.stats.washed}こ<br>
    ずかん ${st.dexCount()} / ${TOTAL_STONES}　みつけもの ${Object.keys(S.finds).length}しゅるい<br>
    ねこを なでた ${S.cat.pets}回`;
  box.appendChild(stats);

  const help = document.createElement('p');
  help.className = 'dim';
  help.style.marginTop = '10px';
  help.innerHTML = `あそびかた：<br>
    ①「ひろう」で どろだんごを タップ<br>
    ②「あらう」で 指で なでて どろを おとす<br>
    ③ 布で みがいて、まどの ひかりに かざす<br>
    ④ 正体が わかって ずかんに のる<br><br>
    石は 待っているだけでも たまります（アプリを 閉じている あいだも）。<br>
    工房の きゅうすを タップすると しばらく 石が 早く たまります。`;
  box.appendChild(help);

  const del = document.createElement('button');
  del.className = 'btn wide';
  del.style.marginTop = '14px';
  del.textContent = 'データを けす';
  del.addEventListener('click', () => {
    if (!confirm('ずかんも たなも ぜんぶ 消えます。よろしいですか？')) return;
    st.wipe();
    location.reload();
  });
  box.appendChild(del);

  const ver = document.createElement('p');
  ver.className = 'dim';
  ver.style.marginTop = '10px';
  ver.textContent = 'いしあらい工房 v1.0 — オフラインでも あそべます';
  box.appendChild(ver);

  modal('せってい', box);
}

/* =========================================================
   あらいば
   ========================================================= */
function setPhase(p){
  $('#sc-wash').dataset.phase = p;
  if (p === 'pick'){
    $('#ws-murmur').textContent = S.basket.length ? murmur() : 'かごが からっぽ。石を ひろいに いこう。';
  }
}

function renderBasket(){
  const grid = $('#basket-grid');
  grid.innerHTML = '';
  for (const b of S.basket){
    const cell = document.createElement('div');
    cell.className = 'cell';
    const src = renderMud(b.seed, 36);
    const c = document.createElement('canvas');
    c.width = 36; c.height = 36;
    c.getContext('2d').drawImage(src, 0, 0);
    cell.appendChild(c);
    cell.addEventListener('click', () => beginWash(b.uid));
    grid.appendChild(cell);
  }
  $('#basket-empty').style.display = S.basket.length ? 'none' : '';
  grid.style.display = S.basket.length ? '' : 'none';
  refreshTop();
}

function beginWash(uid){
  const cur = st.startWash(uid);
  if (!cur) return;
  wash.setStone(cur);
  setPhase('wash');
  $('#wash-fill').style.width = '0%';
  $('#wash-label').textContent = 'どろ 100%';
  $('#polish-fill').style.width = '0%';
  $('#polish-label').textContent = 'つや 0%';
  sound.sfx('drop');
  renderBasket();
  go('wash');
}

function resumeWash(){
  // すでに 同じ石を あらっている ときは 作りなおさない
  if (wash.current() !== S.cur) wash.setStone(S.cur);
  if (S.cur.mud > 0){
    setPhase('wash');
    $('#wash-fill').style.width = ((1 - S.cur.mud) * 100).toFixed(0) + '%';
    $('#wash-label').textContent = 'どろ ' + Math.round(S.cur.mud * 100) + '%';
  } else {
    setPhase('polish');
    $('#polish-fill').style.width = ((S.cur.gloss || 0) * 100).toFixed(0) + '%';
    $('#polish-label').textContent = 'つや ' + Math.round((S.cur.gloss || 0) * 100) + '%';
  }
}

function toPolish(){
  setPhase('polish');
  $('#polish-fill').style.width = '0%';
  $('#polish-label').textContent = 'つや 0%';
  toast('どろが おちた！ 布で みがこう。');
  st.save();
}

/* ---------- 正体が わかった ---------- */
function onIdentified(){
  const before = st.dexCount();
  const res = st.identify();
  if (!res) return;
  const def = STONE_BY_ID[res.stone.id];
  const g = glossRank(res.stone.gloss);

  $('#rc-new').hidden = !res.first;
  const c = $('#cv-result');
  const cg = c.getContext('2d');
  cg.imageSmoothingEnabled = false;
  cg.clearRect(0, 0, c.width, c.height);
  cg.drawImage(renderStone(def.id, res.stone.seed, 48, 'light', res.stone.gloss), 0, 0, 96, 96);
  $('#rc-name').textContent = def.name;
  $('#rc-kanji').textContent = def.kanji || '';
  $('#rc-rarity').textContent = stars(def.rarity);
  $('#rc-gloss').textContent = 'つや：' + g.label;
  $('#rc-desc').textContent = def.desc;
  $('#rc-light').textContent = def.light;
  setPhase('result');

  if (res.first){
    sound.sfx('newdex');
    dex.celebrate(def, res.stone.gloss);
  }
  dex.render(); shelf.render(); refreshTop();

  // あたらしい ばしょが 開いたか
  const after = st.dexCount();
  for (const f of FIELDS){
    if (f.need > before && f.need <= after){
      setTimeout(() => toast(`あたらしい ばしょ → <b>${f.name}</b>`), 900);
    }
  }
  wash.clearStone();
}

/* =========================================================
   じかんの ながれ
   ========================================================= */
setInterval(() => {
  const n = st.tickSpawns();
  const nowInfo = weather.now();
  const changed = nowInfo.weather.id !== info.weather.id || nowInfo.time.phase !== info.time.phase;
  info = nowInfo;
  field.setContext(info);
  if (changed){
    field.resetBackdrop(); light.resetWall(); shelf.resetBackdrop(); workshop.resetBackdrop();
    ambience();
    if (screen === 'field') $('#field-murmur').textContent = weather.weatherLine(info.weather, info.time);
  }
  refreshTop();
}, 5000);

/* ひとりごと */
setInterval(() => {
  if (screen === 'field' && Math.random() < .5) $('#field-murmur').textContent = murmur();
  if (screen === 'wash' && $('#sc-wash').dataset.phase === 'pick' && Math.random() < .5)
    $('#ws-murmur').textContent = murmur();
}, 22000);

/* もどってきたとき */
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ st.save(true); return; }
  const added = st.tickSpawns();
  info = weather.now();
  field.setContext(info);
  field.resetBackdrop(); light.resetWall(); shelf.resetBackdrop(); workshop.resetBackdrop();
  refreshTop();
  if (added) toast(`石が ${added}こ ふえている。`);
  if (S.opts.bgm && sound.isReady()) ambience();
});
window.addEventListener('pagehide', () => st.save(true));

/* =========================================================
   サービスワーカー（オフライン用）
   ========================================================= */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
