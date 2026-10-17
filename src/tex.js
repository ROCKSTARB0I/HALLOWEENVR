// HALLOWEENVR surface painter. Every texture in the game is generated here at
// load time: colour, a height field turned into a normal map, and roughness.
// Nothing is downloaded; tiles repeat in world metres (see geo.js).
import * as THREE from '../vendor/three.module.js';

let seed = 1337;
export function srand(s) { seed = (s >>> 0) || 1; }
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

// tileable value noise on an integer lattice of period p
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fractal noise sampled in [0,1)² so it tiles
export function fbm(u, v, base = 4, oct = 4, s = 0) {
  let sum = 0, amp = 0.5, norm = 0, f = base;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(u * f, v * f, f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const mix = (a, b, t) => a + (b - a) * t;

// Paint a texture: fn(u, v, out) fills out = [r,g,b,height,rough] in 0..1
function paint(size, fn, { normal = 1.5, srgb = true, alpha = false } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  const h = new Float32Array(size * size), rough = new Uint8ClampedArray(size * size);
  const o = [0, 0, 0, 0.5, 0.8, 1];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    o[3] = 0.5; o[4] = 0.8; o[5] = 1;
    fn(x / size, y / size, o);
    const i = (y * size + x);
    d[i * 4] = clamp(o[0]) * 255; d[i * 4 + 1] = clamp(o[1]) * 255; d[i * 4 + 2] = clamp(o[2]) * 255;
    d[i * 4 + 3] = alpha ? clamp(o[5]) * 255 : 255;
    h[i] = o[3]; rough[i] = clamp(o[4]) * 255;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  if (srgb) map.colorSpace = THREE.SRGBColorSpace;
  const out = { map };
  if (normal > 0) {
    const nc = document.createElement('canvas'); nc.width = nc.height = size;
    const ng = nc.getContext('2d'), ni = ng.createImageData(size, size), nd = ni.data;
    const rc = document.createElement('canvas'); rc.width = rc.height = size;
    const rg = rc.getContext('2d'), ri = rg.createImageData(size, size), rd = ri.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const t = h[((y - 1 + size) % size) * size + x], b = h[((y + 1) % size) * size + x];
      let nx = (l - r) * normal * size / 64, ny = (t - b) * normal * size / 64, nz = 1;
      const k = 1 / Math.hypot(nx, ny, nz); nx *= k; ny *= k; nz *= k;
      const i = (y * size + x) * 4;
      nd[i] = (nx * 0.5 + 0.5) * 255; nd[i + 1] = (ny * 0.5 + 0.5) * 255; nd[i + 2] = (nz * 0.5 + 0.5) * 255; nd[i + 3] = 255;
      const rv = rough[y * size + x]; rd[i] = rd[i + 1] = rd[i + 2] = rv; rd[i + 3] = 255;
    }
    ng.putImageData(ni, 0, 0); rg.putImageData(ri, 0, 0);
    out.normalMap = new THREE.CanvasTexture(nc); out.roughnessMap = new THREE.CanvasTexture(rc);
    for (const t of [out.normalMap, out.roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  }
  return out;
}

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
function setc(o, c, k = 1) { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; }

export const T = {};

export function buildTextures(lowRes = false) {
  const S = lowRes ? 256 : 512, H = lowRes ? 128 : 256;

  // autumn lawn: dead and live grass, fallen leaves, bare dirt
  const g1 = hex(0x3f4a26), g2 = hex(0x5b5a2e), dirt = hex(0x3b2e22), lf1 = hex(0x8a3d14), lf2 = hex(0x9a6a1c), lf3 = hex(0x5a2a12);
  T.grass = paint(S, (u, v, o) => {
    const n = fbm(u, v, 6, 5, 1), blades = vnoise(u * 180, v * 60, 180, 3), d = fbm(u, v, 3, 3, 9);
    const c = [mix(g1[0], g2[0], n), mix(g1[1], g2[1], n), mix(g1[2], g2[2], n)];
    const k = 0.7 + blades * 0.5; setc(o, c, k);
    if (d > 0.68) { const t = clamp((d - 0.68) * 6); o[0] = mix(o[0], dirt[0], t); o[1] = mix(o[1], dirt[1], t); o[2] = mix(o[2], dirt[2], t); }
    o[3] = blades * 0.6 + n * 0.4; o[4] = 0.95;
    const lv = vnoise(u * 40, v * 40, 40, 5);
    if (lv > 0.8) { const pick = vnoise(u * 40, v * 40, 40, 6); setc(o, pick < 0.33 ? lf1 : pick < 0.66 ? lf2 : lf3, 0.8 + blades * 0.3); o[3] = 0.8; o[4] = 0.7; }
  }, { normal: 2.5 });

  // asphalt: aggregate, patches, cracks
  T.asphalt = paint(S, (u, v, o) => {
    const n = fbm(u, v, 8, 5, 21), grit = vnoise(u * 300, v * 300, 300, 22), patch = fbm(u, v, 2, 3, 23);
    let c = 0.1 + n * 0.06 + grit * 0.05 + (patch > 0.6 ? -0.02 : 0);
    const crack = Math.abs(fbm(u, v, 3, 4, 24) - 0.5);
    let h = grit * 0.5 + n * 0.3;
    if (crack < 0.012) { c *= 0.4; h -= 0.4; }
    o[0] = c; o[1] = c; o[2] = c * 1.05; o[3] = h; o[4] = 0.85 - grit * 0.2;
  }, { normal: 2 });

  // sidewalk slabs (1.5 m period in geo tiling) with expansion joints
  T.concrete = paint(S, (u, v, o) => {
    const n = fbm(u, v, 6, 5, 31), grit = vnoise(u * 220, v * 220, 220, 32);
    let c = 0.42 + n * 0.12 + grit * 0.05;
    let h = 0.6 + grit * 0.2;
    const jx = Math.min(u, 1 - u), jy = Math.min(v, 1 - v);
    if (jx < 0.006 || jy < 0.006) { c *= 0.45; h = 0.1; }
    const stain = fbm(u, v, 3, 3, 33); if (stain > 0.62) c *= 0.85;
    o[0] = c; o[1] = c * 0.98; o[2] = c * 0.94; o[3] = h; o[4] = 0.9;
  }, { normal: 2 });

  // clapboard siding (white base so vertex colour paints it)
  T.siding = paint(S, (u, v, o) => {
    const board = (v * 10) % 1, n = fbm(u, v, 4, 4, 41), grain = vnoise(u * 8, v * 200, 8, 42);
    const lap = board < 0.08 ? board / 0.08 : 1;
    const c = 0.78 + n * 0.12 - (1 - lap) * 0.35 + grain * 0.04;
    const peel = fbm(u, v, 5, 4, 43) > 0.72 ? 0.75 : 1;
    o[0] = c * peel; o[1] = c * peel; o[2] = c * peel; o[3] = board * 0.7 + grain * 0.1; o[4] = 0.75;
  }, { normal: 3 });

  // asphalt roof shingles
  T.shingle = paint(S, (u, v, o) => {
    const row = Math.floor(v * 8), rv = (v * 8) % 1, off = (row % 2) * 0.5;
    const tab = ((u * 6 + off) % 1), col = Math.floor(u * 6 + off);
    const tone = hash(col, row, 51) * 0.08, grit = vnoise(u * 260, v * 260, 260, 52);
    let c = 0.17 + tone + grit * 0.06; let h = rv * 0.6 + grit * 0.2;
    if (tab < 0.025 || rv < 0.06) { c *= 0.45; h = 0; }
    o[0] = c; o[1] = c * 0.95; o[2] = c * 0.92; o[3] = h; o[4] = 0.9;
  }, { normal: 3 });

  T.brick = paint(S, (u, v, o) => {
    const row = Math.floor(v * 16), rv = (v * 16) % 1, off = (row % 2) * 0.5, cu = (u * 4 + off) % 1;
    const tone = hash(Math.floor(u * 4 + off), row, 61), n = fbm(u, v, 8, 4, 62);
    const mortar = rv < 0.12 || cu < 0.04;
    if (mortar) { o[0] = 0.45; o[1] = 0.43; o[2] = 0.4; o[3] = 0.1; o[4] = 0.95; return; }
    const c = 0.6 + tone * 0.25 + n * 0.1;
    o[0] = 0.48 * c; o[1] = 0.2 * c; o[2] = 0.15 * c; o[3] = 0.6 + n * 0.3; o[4] = 0.85;
  }, { normal: 3 });

  // oak floor boards
  T.wood = paint(S, (u, v, o) => {
    const plank = Math.floor(u * 8), pu = (u * 8) % 1, seg = Math.floor(v * 2 + hash(plank, 0, 71)), tone = hash(plank, seg, 72);
    const grain = fbm(u * 0.25 + plank * 0.37, v * 4, 4, 4, 73);
    const rings = Math.sin((grain * 30 + pu * 3) * 6.28) * 0.5 + 0.5;
    const c = 0.35 + tone * 0.15 + rings * 0.08;
    let h = 0.6 + rings * 0.1;
    if (pu < 0.025 || Math.abs(((v * 2 + hash(plank, 0, 71)) % 1)) < 0.006) { h = 0; }
    o[0] = c * 0.62; o[1] = c * 0.42; o[2] = c * 0.26; o[3] = h; o[4] = 0.45 + tone * 0.2;
    if (h === 0) { o[0] *= 0.4; o[1] *= 0.4; o[2] *= 0.4; }
  }, { normal: 1.5 });

  T.darkwood = paint(H, (u, v, o) => {
    const grain = fbm(u * 0.5, v * 6, 4, 4, 81), rings = Math.sin(grain * 40) * 0.5 + 0.5;
    const c = 0.18 + rings * 0.06; o[0] = c * 0.9; o[1] = c * 0.6; o[2] = c * 0.38; o[3] = rings * 0.3; o[4] = 0.5;
  }, { normal: 1 });

  T.carpet = paint(H, (u, v, o) => {
    const f = vnoise(u * 120, v * 120, 120, 91), n = fbm(u, v, 4, 3, 92);
    const c = 0.65 + f * 0.25 + n * 0.1; o[0] = o[1] = o[2] = c; o[3] = f; o[4] = 1;
  }, { normal: 1.5 });

  // 70s wallpaper, light so vertex colour tints it
  T.paper = paint(S, (u, v, o) => {
    const stripe = Math.sin(u * 6.283 * 6) * 0.5 + 0.5;
    const motif = Math.sin(u * 6.283 * 12 + Math.sin(v * 6.283 * 4) * 2) * Math.sin(v * 6.283 * 8);
    const n = fbm(u, v, 6, 3, 101), stain = fbm(u, v, 2, 4, 102);
    let c = 0.78 + stripe * 0.06 + (motif > 0.6 ? -0.08 : 0) + n * 0.05;
    if (stain > 0.66) c *= 0.88;
    o[0] = c; o[1] = c * 0.97; o[2] = c * 0.9; o[3] = n * 0.2; o[4] = 0.9;
  }, { normal: 0.6 });

  T.plaster = paint(H, (u, v, o) => {
    const n = fbm(u, v, 8, 4, 111); const c = 0.8 + n * 0.08; o[0] = c; o[1] = c * 0.98; o[2] = c * 0.94; o[3] = n; o[4] = 0.95;
  }, { normal: 1 });

  // kitchen linoleum checker
  T.tile = paint(H, (u, v, o) => {
    const cx = Math.floor(u * 4), cy = Math.floor(v * 4), dark = (cx + cy) % 2;
    const n = fbm(u, v, 6, 3, 121), wear = fbm(u, v, 3, 3, 122);
    let c = dark ? 0.12 : 0.72; c += n * 0.05 - (wear > 0.6 ? 0.06 : 0);
    o[0] = c; o[1] = c * (dark ? 1 : 0.96); o[2] = c * (dark ? 1 : 0.86); o[3] = 0.5; o[4] = 0.35 + wear * 0.3;
    const gu = (u * 4) % 1, gv = (v * 4) % 1; if (gu < 0.02 || gv < 0.02) { o[3] = 0.3; }
  }, { normal: 0.8 });

  T.bark = paint(H, (u, v, o) => {
    const ridges = fbm(u * 3, v * 0.6, 4, 5, 131), n = fbm(u, v, 8, 3, 132);
    const r = Math.pow(Math.abs(Math.sin(ridges * 18)), 0.5);
    const c = 0.14 + r * 0.12 + n * 0.05; o[0] = c * 0.9; o[1] = c * 0.8; o[2] = c * 0.7; o[3] = r; o[4] = 0.95;
  }, { normal: 4 });

  T.hedge = paint(H, (u, v, o) => {
    const leaf = vnoise(u * 60, v * 60, 60, 141), n = fbm(u, v, 4, 4, 142), hole = vnoise(u * 20, v * 20, 20, 143);
    const c = 0.08 + leaf * 0.12 + n * 0.05; o[0] = c * 0.6; o[1] = c * 1.0; o[2] = c * 0.45;
    o[3] = leaf * 0.7 + (hole > 0.75 ? -0.3 : 0); o[4] = 0.8; if (hole > 0.75) { o[0] *= 0.3; o[1] *= 0.3; o[2] *= 0.3; }
  }, { normal: 3 });

  // general cloth weave, white so a colour multiplies it
  T.cloth = paint(H, (u, v, o) => {
    const w = vnoise(u * 90, v * 90, 90, 150), n = fbm(u, v, 4, 3, 151);
    const c = 0.86 + w * 0.06 + n * 0.08; o[0] = o[1] = o[2] = c; o[3] = n * 0.6 + w * 0.2; o[4] = 0.95;
  }, { normal: 1 });

  T.metal = paint(H, (u, v, o) => {
    const n = fbm(u, v, 4, 4, 161), s = vnoise(u * 2, v * 200, 2, 162);
    const c = 0.6 + n * 0.1 + s * 0.05; o[0] = o[1] = o[2] = c; o[3] = s * 0.2; o[4] = 0.35 + n * 0.3;
  }, { normal: 0.4 });

  // leaf atlas: 2x2 leaves with alpha (maple, oak, elm, curled)
  const leafCols = [hex(0x9b3a12), hex(0xb7701e), hex(0x6e2a10), hex(0x8a5a22)];
  T.leaves = paint(H, (u, v, o) => {
    const q = (u < 0.5 ? 0 : 1) + (v < 0.5 ? 0 : 2), lu = (u % 0.5) * 4 - 1, lv = (v % 0.5) * 4 - 1;
    const a = Math.atan2(lv, lu), r = Math.hypot(lu, lv);
    let edge;
    if (q === 0) edge = 0.62 + 0.28 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.6);
    else if (q === 1) edge = 0.55 + 0.1 * Math.cos(a * 9) + 0.15 * Math.cos(a);
    else if (q === 2) edge = 0.48 + 0.25 * Math.abs(Math.sin(a)) + 0.04 * Math.cos(a * 14);
    else edge = 0.6 + 0.2 * Math.cos(a * 3);
    const inside = r < edge && !(lv > 0.5 && Math.abs(lu) > 0.05);
    const stem = Math.abs(lu) < 0.03 && lv > 0;
    const c = leafCols[q], n = fbm(u, v, 8, 3, 171), vein = Math.abs(Math.sin(a * 5)) < 0.08 ? 0.75 : 1;
    setc(o, c, (0.75 + n * 0.4) * vein); o[5] = inside || stem ? 1 : 0; o[3] = n; o[4] = 0.7;
  }, { normal: 0.5, alpha: true });

  // blood splats, white with alpha, tinted by material colour
  T.splat = paint(H, (u, v, o) => {
    const q = (u < 0.5 ? 0 : 1) + (v < 0.5 ? 0 : 2), lu = (u % 0.5) * 4 - 1, lv = (v % 0.5) * 4 - 1;
    const a = Math.atan2(lv, lu), r = Math.hypot(lu, lv);
    const edge = 0.45 + 0.2 * vnoise(a * 3 + 10, q * 3, 64, 181) + 0.12 * vnoise(a * 9 + 10, q, 64, 182);
    let alpha = r < edge ? 1 : 0;
    // satellite drops
    const dx = vnoise(u * 30, v * 30, 30, 183 + q); if (dx > 0.86 && r < 0.95) alpha = 1;
    const thick = clamp(1 - r / edge);
    o[0] = o[1] = o[2] = 0.7 + thick * 0.3; o[3] = thick; o[4] = 0.2; o[5] = alpha;
  }, { normal: 3, alpha: true });

  return T;
}

// A face is painted onto the head's UV wrap: u around the head (0.5 = front),
// v from chin (0) to crown (1). Eyes, lids and teeth are real geometry in
// flesh.js, so this only carries skin, stubble, brows and lip colour.
export function skinTexture(p) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const sk = p.skin, lip = p.lip;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = 1 - y / S, i = (y * S + x) * 4;
    const n = fbm(u, v, 16, 3, p.seed), pores = vnoise(u * 200, v * 200, 200, p.seed + 1);
    let r = sk[0] * (0.92 + n * 0.12 + pores * 0.03), gg = sk[1] * (0.92 + n * 0.1 + pores * 0.03), b = sk[2] * (0.92 + n * 0.1);
    const fu = (u - 0.5) * 4;               // across the face
    // flushed cheeks, darker under the eyes
    const cheek = Math.exp(-((Math.abs(fu) - 0.42) ** 2 + (v - 0.42) ** 2) / 0.008);
    r += cheek * 0.06 * p.blush; gg -= cheek * 0.02;
    const under = Math.exp(-((Math.abs(fu) - 0.28) ** 2 / 0.006 + (v - 0.49) ** 2 / 0.0006));
    r -= under * 0.08; gg -= under * 0.08; b -= under * 0.04;
    // lips
    const ly = v - 0.233, lx = fu;
    const lipShape = (lx * lx) / 0.05 + (ly * ly) / (ly > 0 ? 0.00045 : 0.0007);
    if (lipShape < 1) { const t = clamp((1 - lipShape) * 3); r = mix(r, lip[0], t); gg = mix(gg, lip[1], t); b = mix(b, lip[2], t); }
    // brows
    const bx = Math.abs(fu) - 0.27, by = v - 0.63 - (0.02 - bx * bx * 0.6);
    if (Math.abs(bx) < 0.16 && Math.abs(by) < 0.012 * (1 - Math.abs(bx) * 4)) {
      const h = p.hair; const t = 0.3 * (0.6 + vnoise(u * 300, v * 80, 300, 9) * 0.4);
      r = mix(r, h[0] * 0.7, t); gg = mix(gg, h[1] * 0.7, t); b = mix(b, h[2] * 0.7, t);
    }
    // stubble / scalp shadow
    if (p.stubble && v < 0.25 && Math.abs(fu) < 0.6) { const t = 0.18 * vnoise(u * 250, v * 250, 250, 3); r -= t; gg -= t; b -= t * 0.8; }
    if (v > 0.75) { const t = clamp((v - 0.75) * 6); const h = p.hair; r = mix(r, h[0], t); gg = mix(gg, h[1], t); b = mix(b, h[2], t); }
    if (p.mask) {
      const m = 0.86 + n * 0.08 - pores * 0.02; r = m; gg = m * 0.99; b = m * 0.93;
      const hole = Math.exp(-((Math.abs(fu) - 0.29) ** 2 / 0.004 + (v - 0.555) ** 2 / 0.0012));
      r *= 1 - hole * 0.9; gg *= 1 - hole * 0.9; b *= 1 - hole * 0.9;
      const shade = Math.exp(-((Math.abs(fu) - 0.3) ** 2 / 0.02 + (v - 0.6) ** 2 / 0.006)); r -= shade * 0.12; gg -= shade * 0.12; b -= shade * 0.1;
      if (lipShape < 1) { r *= 0.92; gg *= 0.9; b *= 0.9; }
      if (v > 0.75) { const t = clamp((v - 0.75) * 6); r = mix(r, 0.24, t); gg = mix(gg, 0.17, t); b = mix(b, 0.11, t); }
    }
    d[i] = clamp(r) * 255; d[i + 1] = clamp(gg) * 255; d[i + 2] = clamp(b) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, canvas: c, ctx: g };
}

export function eyeTexture(iris) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // equirect: u around, v pole-to-pole; the pupil sits on the +Z pole (v ~ 0.5, u ~ 0.25 after mapping)
    const u = x / S, v = y / S, lon = (u - 0.25) * Math.PI * 2, lat = (0.5 - v) * Math.PI;
    const zf = Math.cos(lat) * Math.cos(lon);  // +Z facing amount
    const ang = Math.acos(clamp(zf, -1, 1));
    let r = 0.93, gg = 0.9, b = 0.86;
    const vein = vnoise(u * 40, v * 40, 40, 7);
    if (ang > 0.5 && vein > 0.8) { r = 0.8; gg = 0.45; b = 0.45; }
    if (ang < 0.42) { const t = ang / 0.42; const n = vnoise(Math.atan2(lat, lon) * 20 + 40, t * 6, 64, 5);
      r = iris[0] * (0.6 + n * 0.6) * (1 - t * 0.3); gg = iris[1] * (0.6 + n * 0.6) * (1 - t * 0.3); b = iris[2] * (0.6 + n * 0.6) * (1 - t * 0.3);
      if (t > 0.88) { r *= 0.4; gg *= 0.4; b *= 0.4; } }
    if (ang < 0.17) { r = gg = b = 0.02; }
    const i = (y * S + x) * 4; d[i] = r * 255; d[i + 1] = gg * 255; d[i + 2] = b * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
