/* =========================================================
   pixel.js — ドット絵をその場で描くための道具箱
   画像ファイルを一枚も使わないので、色・ノイズ・図形はここで作る。
   ========================================================= */

/* ---------- 乱数（種を与えると毎回同じ結果） ---------- */
export function rng(seed){
  let a = (seed >>> 0) || 1;
  return function(){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashInt(x, y, s){
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function hash01(x, y, s){ return hashInt(x, y, s) / 4294967296; }

const smooth = t => t * t * (3 - 2 * t);

/* ---------- 値ノイズ（なめらかなムラ） ---------- */
export function noise2(x, y, s){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash01(xi, yi, s),     b = hash01(xi + 1, yi, s);
  const c = hash01(xi, yi + 1, s), d = hash01(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/* ---------- 重ねノイズ（岩肌っぽいざらざら） ---------- */
export function fbm(x, y, s, oct = 3){
  let v = 0, amp = .5, f = 1;
  for (let i = 0; i < oct; i++){
    v += noise2(x * f, y * f, s + i * 131) * amp;
    amp *= .5; f *= 2;
  }
  return v;
}

/* ---------- 色 ---------- */
export function hex2rgb(h){
  if (typeof h !== 'string') return h;
  const t = h.replace('#', '');
  const n = parseInt(t.length === 3 ? t.split('').map(c => c + c).join('') : t, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r, g, b){
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function mixc(a, b, t){
  const A = hex2rgb(a), B = hex2rgb(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}
export function lighten(c, t){ return mixc(c, '#ffffff', t); }
export function darken(c, t){ return mixc(c, '#241a12', t); }
export function scaleRGB(c, k){ const A = hex2rgb(c); return [A[0] * k, A[1] * k, A[2] * k]; }

/* ---------- キャンバス ---------- */
export function makeCv(w, h){
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { cv, g };
}
export function ctx2d(cv){
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  return g;
}

/* ---------- ピクセル直書き用のバッファ ---------- */
export class Buf{
  constructor(w, h){
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.d = this.img.data;
  }
  set(x, y, rgb, a = 255){
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = rgb[0]; this.d[i + 1] = rgb[1]; this.d[i + 2] = rgb[2]; this.d[i + 3] = a;
  }
  get(x, y){
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  alpha(x, y){
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  toCanvas(){
    const { cv, g } = makeCv(this.w, this.h);
    g.putImageData(this.img, 0, 0);
    return cv;
  }
}

/* ---------- 図形（整数ドット） ---------- */
export function rect(g, x, y, w, h, col){
  g.fillStyle = typeof col === 'string' ? col : rgb2hex(...col);
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}
export function px(g, x, y, col){ rect(g, x, y, 1, 1, col); }

export function circle(g, cx, cy, r, col){
  g.fillStyle = typeof col === 'string' ? col : rgb2hex(...col);
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++){
    const dy = y - cy;
    const w = Math.sqrt(Math.max(0, r2 - dy * dy));
    g.fillRect(Math.round(cx - w), y, Math.max(1, Math.round(w * 2)), 1);
  }
}

/* ---------- なめらかな折れ線（水面や丘のライン） ---------- */
export function hillLine(w, baseY, amp, s, freq = .06){
  const out = new Array(w);
  for (let x = 0; x < w; x++){
    out[x] = Math.round(baseY + (fbm(x * freq, 0.5, s, 3) - .5) * amp * 2);
  }
  return out;
}

/* ---------- 便利 ---------- */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export function pick(r, arr){ return arr[Math.floor(r() * arr.length) % arr.length]; }

/* 重み付きの抽選: table = [[値, 重み], ...] */
export function weighted(r, table){
  let sum = 0;
  for (const t of table) sum += t[1];
  let x = r() * sum;
  for (const t of table){ x -= t[1]; if (x <= 0) return t[0]; }
  return table[table.length - 1][0];
}
