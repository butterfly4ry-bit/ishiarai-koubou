/* =========================================================
   weather.js — 天気と 時間帯
   ・ほんとうの 時計に あわせて 空の 色が かわる
   ・天気は 15分ごとに ゆっくり かわる（種から きまるので みんな同じ）
   ========================================================= */

import { rng, weighted, mixc, rgb2hex, clamp } from './pixel.js';

export const WEATHERS = {
  clear:  { id:'clear',  name:'はれ',   ic:'☀️',  rare:0,   rain:0, fog:0,   snow:0 },
  cloud:  { id:'cloud',  name:'くもり', ic:'☁️',  rare:.12, rain:0, fog:.12, snow:0 },
  rain:   { id:'rain',   name:'あめ',   ic:'🌧️', rare:.40, rain:1, fog:.18, snow:0 },
  drizzle:{ id:'drizzle',name:'こさめ', ic:'🌦️', rare:.26, rain:.45, fog:.1, snow:0 },
  fog:    { id:'fog',    name:'きり',   ic:'🌫️', rare:.30, rain:0, fog:.75, snow:0 },
  snow:   { id:'snow',   name:'ゆき',   ic:'🌨️', rare:.45, rain:0, fog:.3,  snow:1 },
};

const BUCKET = 15 * 60_000;

export function weatherAt(t = Date.now()){
  const b = Math.floor(t / BUCKET);
  const r = rng(b * 2654435761 + 12345);
  const month = new Date(t).getMonth();          // 0..11
  const winter = month === 11 || month <= 1;
  const table = winter
    ? [['clear', 30], ['cloud', 26], ['snow', 14], ['drizzle', 10], ['fog', 12], ['rain', 8]]
    : [['clear', 40], ['cloud', 24], ['drizzle', 12], ['rain', 10], ['fog', 9], ['snow', 0]];
  return WEATHERS[weighted(r, table)] || WEATHERS.clear;
}

/* ---------- 時間帯 ---------- */
export function timeOfDay(t = Date.now()){
  const d = new Date(t);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4.5 && h < 7.5)  return { phase:'dawn',  name:'あさ',   h };
  if (h >= 7.5 && h < 16)   return { phase:'day',   name:'ひなか', h };
  if (h >= 16 && h < 18.5)  return { phase:'dusk',  name:'ゆうがた', h };
  return { phase:'night', name:'よる', h };
}

/* ---------- 空の 色 ---------- */
const SKY = {
  dawn:  { top:'#8fb0d8', bot:'#ffd9b0', sun:'#ffe6b8', land:'#c8b898', water:'#a9c6d8', amb:.92 },
  day:   { top:'#8ec9e8', bot:'#d9eef5', sun:'#ffffff', land:'#cbd8a8', water:'#a6d2de', amb:1 },
  dusk:  { top:'#6a7fb8', bot:'#f6b183', sun:'#ffd9a0', land:'#b09878', water:'#c39a94', amb:.86 },
  night: { top:'#1e2740', bot:'#41537a', sun:'#cfe0ff', land:'#4d5a5f', water:'#3f5570', amb:.62 },
};

export function skyOf(phase, weather){
  const s = Object.assign({}, SKY[phase] || SKY.day);
  const gray = weather.id === 'rain' ? .55 : weather.id === 'cloud' ? .32
             : weather.id === 'drizzle' ? .4 : weather.id === 'fog' ? .5
             : weather.id === 'snow' ? .45 : 0;
  if (gray > 0){
    const g = phase === 'night' ? '#3a4152' : '#b7bcc0';
    s.top = rgb2hex(...mixc(s.top, g, gray));
    s.bot = rgb2hex(...mixc(s.bot, phase === 'night' ? '#4c5566' : '#d7d9d6', gray * .9));
    s.water = rgb2hex(...mixc(s.water, g, gray * .6));
    s.land = rgb2hex(...mixc(s.land, g, gray * .35));
    s.amb *= 1 - gray * .18;
  }
  return s;
}

/* ---------- 今の じょうきょうを まとめて ---------- */
export function now(){
  const w = weatherAt();
  const t = timeOfDay();
  const sky = skyOf(t.phase, w);
  // よるは すこし レアが 出やすい
  const rareBoost = clamp(w.rare + (t.phase === 'night' ? .12 : 0), 0, 1);
  return { weather: w, time: t, sky, rareBoost };
}

/* 毎フレーム 呼んでも 重くないように 5秒だけ 使いまわす */
let _cache = null, _cacheT = 0;
export function cached(){
  const t = Date.now();
  if (!_cache || t - _cacheT > 5000){ _cache = now(); _cacheT = t; }
  return _cache;
}

/* ---------- ひとこと ---------- */
export function weatherLine(w, t){
  const key = w.id + ':' + t.phase;
  const lines = {
    'clear:dawn':'あさの ひかりが 川に とどく。',
    'clear:day':'いい 天気。石が よく 見える。',
    'clear:dusk':'ゆうやけが 水に とけている。',
    'clear:night':'星が しずかに ならんでいる。',
    'cloud:day':'くもり空。まぶしくないのが ありがたい。',
    'rain:day':'あめの日は、石の 色が よく わかる。',
    'rain:night':'あめの音を きいていると ねむくなる。',
    'drizzle:day':'こさめ。かさは いらないくらい。',
    'fog:dawn':'きりの 中。すぐ そこしか 見えない。',
    'fog:day':'きりが 出て、音が やわらかい。',
    'snow:day':'ゆきが 石の あいだに たまる。',
    'snow:night':'しずかすぎて、じぶんの 音が きこえる。',
  };
  return lines[key] || lines[w.id + ':day'] || 'きょうも のんびり いこう。';
}
