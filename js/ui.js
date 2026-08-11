/* =========================================================
   ui.js — トースト・モーダル・ひとりごと
   ========================================================= */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- トースト ---------- */
export function toast(msg){
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2700);
  while (host.children.length > 3) host.firstChild.remove();
}

/* ---------- モーダル ---------- */
let onClose = null;
export function modal(title, bodyNode, opt = {}){
  const m = $('#modal');
  $('#modal-title').textContent = title;
  const b = $('#modal-body');
  b.innerHTML = '';
  if (typeof bodyNode === 'string') b.innerHTML = bodyNode;
  else if (bodyNode) b.appendChild(bodyNode);
  $('#modal-close').textContent = opt.closeLabel || 'とじる';
  onClose = opt.onClose || null;
  m.hidden = false;
  return b;
}
export function closeModal(){
  $('#modal').hidden = true;
  const f = onClose; onClose = null;
  if (f) f();
}
export function initModal(){
  $('#modal-close').addEventListener('click', closeModal);
  $('.modal-back').addEventListener('click', closeModal);
}

/* ---------- 画面に ぽわんと 出る 文字 ---------- */
export function popText(host, x, y, text, color = '#fff'){
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.left = (x * 100) + '%';
  el.style.top = (y * 100) + '%';
  el.style.color = color;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1050);
}

/* ---------- ひとりごと ---------- */
const MURMURS = [
  'この石、なんだか いい かたち。',
  'あわてなくて いいや。',
  '水が つめたくて きもちいい。',
  'どろの 下は だれも 知らない。',
  'きょうは ゆっくり やろう。',
  'ひとつ ずつ。それで じゅうぶん。',
  '石は 何万年も 待っていたらしい。',
  '手が つめたい。でも やめられない。',
  'かごが かるいと 気も かるい。',
  'この形、パンみたい。',
  'いい 音の する 石が ある。',
  '光に かざす 前が いちばん たのしい。',
  'ぜんぶ ちがう。ぜんぶ いい。',
  'そっと おいて、また ながめる。',
  'つやが 出ると うれしくなる。',
];
let mi = (Math.random() * MURMURS.length) | 0;
export function murmur(){
  mi = (mi + 1 + ((Math.random() * 3) | 0)) % MURMURS.length;
  return MURMURS[mi];
}

/* ---------- スイッチ ---------- */
export function switchEl(checked, onChange){
  const b = document.createElement('button');
  b.className = 'switch';
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', checked ? 'true' : 'false');
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', v ? 'true' : 'false');
    onChange(v);
  });
  return b;
}

/* ---------- キャンバスの すわり位置から 論理座標へ ---------- */
export function canvasPos(cv, ev){
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * cv.width;
  const y = (ev.clientY - r.top) / r.height * cv.height;
  return { x, y };
}
