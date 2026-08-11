/* =========================================================
   state.js — セーブデータと 時間の ながれ
   ・localStorage に ためる
   ・アプリを 閉じている あいだも 石は たまっていく（放置要素）
   ========================================================= */

import { FIELDS, FIELD_BY_ID, STONE_BY_ID, FINDS, TOTAL_STONES } from './stones.js';
import { rng, weighted, clamp } from './pixel.js';

const KEY = 'ishiarai.save.v1';
export const BASKET_MAX = 12;
const SPAWN_MS = 72_000;      // どろだんごが 1つ 生まれる 間かく
const NODE_MAX = 6;           // 1つの ばしょに ころがる 上限
const TEA_MS = 6 * 60_000;    // お茶の 効果じかん

function freshSave(){
  return {
    v: 1,
    started: false,
    lastSeen: Date.now(),
    field: 'kawara',
    basket: [],
    cur: null,
    stones: [],
    dex: {},
    finds: {},
    newDex: {},
    memo: {},
    shelf: [],
    fs: {},
    tea: 0,
    cat: { last: 0, pets: 0, gifts: 0 },
    opts: { bgm: true, se: true },
    stats: { picked: 0, washed: 0, polished: 0, days: 0 },
    seq: 1,
  };
}

export let S = freshSave();

/* ---------- 読み込み / 保存 ---------- */
export function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if (raw){
      const o = JSON.parse(raw);
      if (o && o.v === 1) S = Object.assign(freshSave(), o, {
        opts: Object.assign({ bgm: true, se: true }, o.opts || {}),
        cat: Object.assign({ last: 0, pets: 0, gifts: 0 }, o.cat || {}),
        stats: Object.assign({ picked: 0, washed: 0, polished: 0, days: 0 }, o.stats || {}),
      });
    }
  }catch(e){ /* こわれていたら 新規で はじめる */ }
  ensureFields();
  return S;
}

let saveTimer = 0;
export function save(now = false){
  S.lastSeen = Date.now();
  if (now){
    try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(true), 400);
}
export function wipe(){
  try{ localStorage.removeItem(KEY); }catch(e){}
  S = freshSave();
  ensureFields();
}

export const uid = () => 's' + (S.seq++).toString(36) + Date.now().toString(36).slice(-4);

/* ---------- ずかんの すすみ ---------- */
export const dexCount = () => Object.keys(S.dex).length;
export const dexTotal = () => TOTAL_STONES;
export const isUnlocked = f => dexCount() >= f.need;
export const unlockedFields = () => FIELDS.filter(isUnlocked);

/* ---------- ばしょの 初期化 ---------- */
function ensureFields(){
  for (const f of FIELDS){
    if (!S.fs[f.id]) S.fs[f.id] = { nodes: [], last: Date.now() - SPAWN_MS * 2, seed: (Math.random() * 1e9) | 0 };
  }
  if (!FIELD_BY_ID[S.field]) S.field = 'kawara';
}

export const teaActive = () => S.tea > Date.now();
export function brewTea(){
  S.tea = Date.now() + TEA_MS;
  save();
}
export const spawnInterval = () => teaActive() ? SPAWN_MS * .5 : SPAWN_MS;

/* ---------- 時間を すすめて どろだんごを 生やす ---------- */
export function tickSpawns(){
  const now = Date.now();
  let added = 0;
  for (const f of FIELDS){
    if (!isUnlocked(f)) continue;
    const st = S.fs[f.id];
    const iv = spawnInterval();
    let n = Math.floor((now - st.last) / iv);
    if (n <= 0) continue;
    st.last += n * iv;
    if (st.last > now) st.last = now;
    n = Math.min(n, NODE_MAX);
    for (let i = 0; i < n && st.nodes.length < NODE_MAX; i++){
      st.nodes.push(newNode(f, st));
      if (f.id === S.field) added++;
    }
  }
  if (added) save();
  return added;
}

function newNode(f, st){
  const seed = ((Math.random() * 1e9) | 0) ^ (Date.now() & 0xffff);
  const r = rng(seed);
  return {
    id: 'n' + (S.seq++).toString(36),
    seed,
    x: .10 + r() * .80,          // 0..1 の 位置
    y: .67 + r() * .25,
    born: Date.now(),
  };
}

/* ---------- どろだんごを ひろう ---------- */
// 天気による レア度の おまけ（weather.js から わたす）
export function pickNode(fieldId, nodeId, rareBoost = 0){
  const st = S.fs[fieldId];
  if (!st) return null;
  const i = st.nodes.findIndex(n => n.id === nodeId);
  if (i < 0) return null;
  if (S.basket.length >= BASKET_MAX) return { full: true };
  const node = st.nodes.splice(i, 1)[0];

  const f = FIELD_BY_ID[fieldId];
  const r = rng(node.seed ^ 0x9e37);
  const table = f.table.map(([id, w]) => {
    const rar = STONE_BY_ID[id]?.rarity || 1;
    return [id, w * (1 + rareBoost * (rar - 1) / 4)];
  });
  const stoneId = weighted(r, table);

  const item = { uid: uid(), id: stoneId, seed: node.seed, at: Date.now() };
  S.basket.push(item);
  S.stats.picked++;

  // おまけの みつけもの
  let find = null;
  if (r() < .16) find = addFind(fieldId, r);

  save();
  return { item, find };
}

const FIND_TABLE = {
  kawara:  ['leaf', 'feather', 'acorn', 'petal', 'wood'],
  keiryu:  ['leaf', 'cone', 'acorn', 'feather', 'firefly'],
  hamabe:  ['shell', 'wood', 'feather', 'petal'],
  iwayama: ['cone', 'feather', 'leaf', 'wood'],
  doukutsu:['wood', 'firefly', 'shell'],
  yozora:  ['star', 'firefly', 'snow', 'petal'],
};
function addFind(fieldId, r){
  const list = FIND_TABLE[fieldId] || ['leaf'];
  const id = list[Math.floor(r() * list.length) % list.length];
  S.finds[id] = (S.finds[id] || 0) + 1;
  return id;
}

/* ---------- 洗う ---------- */
export function startWash(uidStr){
  const i = S.basket.findIndex(b => b.uid === uidStr);
  if (i < 0) return null;
  const b = S.basket[i];
  S.cur = { uid: b.uid, id: b.id, seed: b.seed, mud: 1, gloss: 0, phase: 'wash' };
  S.basket.splice(i, 1);
  save();
  return S.cur;
}
export function returnCurToBasket(){
  if (!S.cur) return;
  if (S.basket.length < BASKET_MAX)
    S.basket.push({ uid: S.cur.uid, id: S.cur.id, seed: S.cur.seed, at: Date.now() });
  S.cur = null;
  save();
}

/* ---------- ずかんに 登録 ---------- */
export function identify(){
  const c = S.cur;
  if (!c) return null;
  const first = !S.dex[c.id];
  const d = S.dex[c.id] || { n: 0, best: 0, at: Date.now() };
  d.n++;
  d.best = Math.max(d.best, c.gloss);
  d.seed = d.seed ?? c.seed;         // ずかんに のせる 見本
  S.dex[c.id] = d;
  if (first) S.newDex[c.id] = 1;

  const stone = { uid: c.uid, id: c.id, seed: c.seed, gloss: c.gloss, at: Date.now() };
  S.stones.push(stone);
  if (S.stones.length > 240) S.stones.shift();
  S.stats.washed++;
  S.cur = null;
  save(true);
  return { stone, first };
}

/* ---------- たな ---------- */
export const SHELF_SLOTS = 18;   // 3だん × 6
export function placeOnShelf(slot, kind, ref){
  S.shelf = S.shelf.filter(s => s.slot !== slot && !(s.kind === kind && s.ref === ref));
  S.shelf.push({ slot, kind, ref });
  save();
}
export function clearSlot(slot){
  S.shelf = S.shelf.filter(s => s.slot !== slot);
  save();
}
export const shelfAt = slot => S.shelf.find(s => s.slot === slot) || null;
export const stoneByUid = u => S.stones.find(s => s.uid === u) || null;

/* ---------- 猫 ---------- */
export function catHere(){
  // 20分ごとに 気が むいたら あそびに 来る
  const bucket = Math.floor(Date.now() / (20 * 60_000));
  const r = rng(bucket * 7919 + 13);
  return r() < .45;
}
export function petCat(){
  S.cat.pets++;
  const bucket = Math.floor(Date.now() / (20 * 60_000));
  if (S.cat.last === bucket) return null;   // おみやげは 1回だけ
  S.cat.last = bucket;
  const r = rng(bucket * 104729 + S.cat.pets);
  if (r() < .5 && S.basket.length < BASKET_MAX){
    const f = FIELD_BY_ID[S.field];
    const id = weighted(r, f.table);
    const item = { uid: uid(), id, seed: (r() * 1e9) | 0, at: Date.now() };
    S.basket.push(item);
    S.cat.gifts++;
    save();
    return item;
  }
  save();
  return null;
}

export { SPAWN_MS, NODE_MAX, TEA_MS };
