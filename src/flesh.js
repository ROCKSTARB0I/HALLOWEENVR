// HALLOWEENVR people. Each person is ONE skinned mesh lofted around a real
// bone hierarchy (no jointed parts), with a sculpted head whose face is live
// geometry: eyeballs that aim and saccade, upper and lower lids that blink and
// widen, brows that lift and knit, and a hinged jaw that talks and screams.
// Animated procedurally while alive; handed to kinetic.js rigid bodies when
// they go limp, and blended back if they get up.
import * as THREE from '../vendor/three.module.js';
import { Body, Joint, Pin } from './kinetic.js?v=3';
import { skinTexture, eyeTexture, vnoise, T } from './tex.js?v=3';

const V = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler;
const _v = new V(), _v2 = new V(), _v3 = new V(), _q = new Q(), _q2 = new Q(), _e = new E(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const col = (h) => new THREE.Color(h);

// rest skeleton, 1.75 m person facing +Z, world metres (scaled per person)
const BONES = [
  ['hips', -1, 0, 0.98, 0], ['spine', 0, 0, 1.12, -0.005], ['chest', 1, 0, 1.31, 0], ['neck', 2, 0, 1.5, -0.01], ['head', 3, 0, 1.565, 0], ['jaw', 4, 0, 1.643, -0.012],
  ['lUp', 2, -0.178, 1.435, -0.01], ['lFo', 6, -0.205, 1.155, -0.025], ['lHa', 7, -0.218, 0.915, 0.0],
  ['rUp', 2, 0.178, 1.435, -0.01], ['rFo', 9, 0.205, 1.155, -0.025], ['rHa', 10, 0.218, 0.915, 0.0],
  ['lTh', 0, -0.092, 0.935, 0], ['lSh', 12, -0.098, 0.51, 0.008], ['lFt', 13, -0.1, 0.085, -0.02],
  ['rTh', 0, 0.092, 0.935, 0], ['rSh', 15, 0.098, 0.51, 0.008], ['rFt', 16, 0.1, 0.085, -0.02],
];
// hands: palm on the hand bone; four fingers and a thumb, two bones each, so they curl
// [name, z of knuckle, y of knuckle, proximal length, distal length, radius]
export const FINGERS = [['I', 0.028, 0.838, 0.046, 0.042, 0.0088], ['M', 0.009, 0.835, 0.051, 0.046, 0.0092], ['R', -0.01, 0.838, 0.048, 0.042, 0.0086], ['P', -0.027, 0.846, 0.036, 0.032, 0.0074]];
const thumbDirs = (x) => [new V(-x * 0.25, -0.75, 0.6).normalize(), new V(-x * 0.3, -0.85, 0.45).normalize()];
for (const [L, x] of [['l', -1], ['r', 1]]) {
  const hi = BONES.findIndex((b) => b[0] === L + 'Ha'), hx = 0.22 * x;
  for (const [f, z, y, l1] of FINGERS) { BONES.push([L + f + '1', hi, hx, y, z]); BONES.push([L + f + '2', BONES.length - 1, hx, y - l1, z]); }
  const tb = new V(hx - x * 0.008, 0.9, 0.03), [d1] = thumbDirs(x);
  BONES.push([L + 'T1', hi, tb.x, tb.y, tb.z]); const t2 = tb.clone().addScaledVector(d1, 0.04); BONES.push([L + 'T2', BONES.length - 1, t2.x, t2.y, t2.z]);
}
export const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

// --------------------------------------------------------------- mesh build
class MeshData {
  constructor() { this.p = []; this.uv = []; this.c = []; this.si = []; this.sw = []; this.idx = [[], [], []]; }
  vert(p, uv, color, w) {
    this.p.push(p.x, p.y, p.z); this.uv.push(uv[0], uv[1]); this.c.push(color.r, color.g, color.b);
    const ent = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4); let s = 0; for (const e of ent) s += e[1];
    for (let i = 0; i < 4; i++) { this.si.push(ent[i] ? +ent[i][0] : 0); this.sw.push(ent[i] ? ent[i][1] / s : 0); }
    return this.p.length / 3 - 1;
  }
}
// rings: [{c:V3, rx, rz, w:{bone:wt}, color, mat, front?:V3(optional ref)}], seg around
function loft(D, rings, seg, { capA = false, capB = false, tile = 0.25, flatFront = 0 } = {}) {
  const base = D.p.length / 3, start = [];
  let L = 0;
  for (let i = 0; i < rings.length; i++) {
    const R = rings[i], prev = rings[Math.max(0, i - 1)], next = rings[Math.min(rings.length - 1, i + 1)];
    const t = _v.subVectors(next.c, prev.c).normalize().clone();
    if (i > 0) L += R.c.distanceTo(prev.c);
    let front = Math.abs(t.y) > 0.6 ? new V(0, 0, 1) : new V(0, 1, 0);
    front.addScaledVector(t, -front.dot(t)).normalize();
    const side = new V().crossVectors(t, front).normalize();
    start.push(D.p.length / 3);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let fz = sa * R.rz; if (sa > 0 && R.bulge) fz += sa * sa * sa * R.bulge * Math.max(0, 1 - Math.abs(ca) * 1.6);
      if (sa < 0 && R.back) fz += sa * R.back;
      const p = R.c.clone().addScaledVector(side, ca * R.rx).addScaledVector(front, fz);
      D.vert(p, [k / seg, L / tile], R.color, R.w);
    }
  }
  const tris = [];
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = start[i] + k, b = start[i] + k + 1, c = start[i + 1] + k + 1, d = start[i + 1] + k;
    tris.push([rings[i].mat, a, b, c], [rings[i].mat, a, c, d]);
  }
  const cap = (ri, flip) => {
    const R = rings[ri], ci = D.vert(R.c.clone().add(rings[ri === 0 ? 0 : ri].c.clone().sub(rings[ri === 0 ? 1 : ri - 1].c).multiplyScalar(0.25)), [0.5, 0], R.color, R.w);
    for (let k = 0; k < seg; k++) tris.push(flip ? [R.mat, ci, start[ri] + k + 1, start[ri] + k] : [R.mat, ci, start[ri] + k, start[ri] + k + 1]);
  };
  if (capA) cap(0, false); if (capB) cap(rings.length - 1, true);
  // make the winding face outward: test the first band
  const P = D.p, pv = (i) => new V(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const [_, a, b, c] = tris[Math.floor(seg / 4)], A = pv(a), B = pv(b), C = pv(c);
  const n = new V().crossVectors(B.clone().sub(A), C.clone().sub(A));
  const out = A.clone().sub(rings[0].c);
  const flip = n.dot(out) < 0;
  for (const [m, a1, b1, c1] of tris) D.idx[m].push(...(flip ? [a1, c1, b1] : [a1, b1, c1]));
  return base;
}

const HEAD_C = new V(0, 1.70, -0.004);
const DROP = 0.035;            // the head is sculpted at 1.70 and set down onto the neck
// sculpted head surface: returns position for angles (th around, ph latitude)
function headPoint(th, ph, sex, out) {
  const rx = sex === 'f' ? 0.075 : 0.079, ry = 0.112, rz = sex === 'f' ? 0.092 : 0.096;
  let x = rx * Math.cos(ph) * Math.sin(th), y = ry * Math.sin(ph), z = rz * Math.cos(ph) * Math.cos(th);
  const Y = HEAD_C.y + y, front = Math.max(0, Math.cos(th));
  const g = (a, s) => Math.exp(-(a * a) / (s * s));
  // jaw narrows toward the chin, neck tucks under at the back
  if (Y < 1.67) { const t = sm(1.67, 1.59, Y); x *= 1 - 0.13 * t * (0.3 + 0.7 * front); }
  if (Y < 1.64 && Math.cos(th) < 0.2) { const t = sm(1.64, 1.6, Y); x *= 1 - 0.3 * t; z *= 1 - 0.35 * t; }
  let d = 0;
  d -= 0.008 * g(Math.abs(th) - 0.45, 0.2) * g(Y - 1.713, 0.016);                       // eye sockets
  d += 0.006 * g(th, 0.75) * g(Y - 1.731, 0.008);                                          // brow ridge
  d += 0.007 * g(Math.abs(th) - 0.78, 0.2) * g(Y - 1.693, 0.018);                          // cheekbones
  const nose = Y > 1.708 ? 0.003 * sm(1.728, 1.708, Y) : Y > 1.664 ? 0.003 + 0.009 * sm(1.708, 1.666, Y) : 0.012 * sm(1.652, 1.664, Y);
  d += nose * g(th, Y < 1.672 ? 0.12 : 0.075);                                                 // nose bridge to tip
  d += 0.005 * g(Math.abs(th) - 0.17, 0.08) * g(Y - 1.662, 0.007);                          // nostril wings
  d += 0.004 * g(th, 0.32) * (g(Y - 1.642, 0.007) + g(Y - 1.629, 0.007));                   // lips
  d += 0.007 * g(th, 0.3) * g(Y - 1.598, 0.014) * (sex === 'f' ? 0.7 : 1);                  // chin
  d += 0.015 * g(Math.abs(th) - 1.57, 0.13) * g(Y - 1.697, 0.024);                          // ears
  const n = new V(x / (rx * rx), y / (ry * ry), z / (rz * rz)).normalize();
  return out.set(x, y, z).addScaledVector(n, d).add(HEAD_C);
}
const MOUTH_Y = 1.6355;

function buildHead(D, sex, colors, jawB, headB) {
  const NT = 52, rows = [];
  // latitude rows, with an exact row at the mouth line duplicated so lips part
  const phM = Math.asin((MOUTH_Y - HEAD_C.y) / 0.112);
  const phs = []; for (let i = 0; i <= 30; i++) phs.push(-Math.PI / 2 + Math.PI * i / 30);
  let near = 0; for (let i = 1; i < phs.length; i++) if (Math.abs(phs[i] - phM) < Math.abs(phs[near] - phM)) near = i;
  phs[near] = phM;
  const list = []; for (let i = 0; i < phs.length; i++) { list.push({ ph: phs[i], jaw: i <= near }); if (i === near) list.push({ ph: phM, jaw: false, upper: true }); }
  const ths = []; for (let k = 0; k <= NT; k++) { const s = k / NT * 2 - 1; ths.push(Math.sign(s) * Math.pow(Math.abs(s), 1.45) * Math.PI); }
  const p = new V(), white = col(0xffffff);
  for (const r of list) {
    const row = [];
    for (let k = 0; k <= NT; k++) {
      const th = ths[k]; headPoint(th, r.ph, sex, p);
      if (r.jaw && !r.upper && Math.abs(th) < 0.26 && Math.abs(r.ph - phM) < 1e-6) p.y -= 0.0015; // lower lip edge
      const wj = r.jaw ? sm(1.5, 0.95, Math.abs(th)) * (p.y > 1.565 ? 1 : 0.5) : 0;
      const w = {}; if (wj > 0) w[jawB] = wj; if (wj < 1) w[headB] = 1 - wj;
      const u = 0.5 + th / (Math.PI * 2), v = (p.y - 1.58) / 0.24;
      p.y -= DROP; row.push(D.vert(p, [u, v], white, w));
    }
    rows.push({ ...r, idx: row });
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], B = rows[i + 1];
    for (let k = 0; k < NT; k++) {
      if (A.jaw && B.upper && Math.abs(ths[k] + ths[k + 1]) / 2 < 0.25) continue;   // the mouth slit
      const a = A.idx[k], b = A.idx[k + 1], c = B.idx[k + 1], d = B.idx[k];
      D.idx[2].push(a, b, c, a, c, d);
    }
  }
}

export function eyePos(sex, side) {          // eyeball centre in rest space
  const p = headPoint(0.45 * side, Math.asin((1.713 - HEAD_C.y) / 0.112), sex, new V());
  p.z -= 0.006; p.x = 0.0315 * side * (sex === 'f' ? 0.97 : 1); p.y -= DROP; return p;
}

function hairTexture(c) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const s = vnoise(x * 0.9, y * 0.04, 115, 7) * 0.6 + vnoise(x * 2.3, y * 0.1, 294, 9) * 0.4;
    const k = 0.55 + s * 0.65, i = (y * S + x) * 4;
    d[i] = Math.min(255, c.r * 255 * k); d[i + 1] = Math.min(255, c.g * 255 * k); d[i + 2] = Math.min(255, c.b * 255 * k); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function buildHair(def, sex) {
  const style = def.hairStyle || 'short', NT = 40, NR = 18, P = [], UV = [], I = [];
  const len = { long: 1.42, shoulder: 1.53, feather: 1.57, short: 1.66, bun: 1.66, balding: 1.66, mask: 1.6 }[style];
  const p = new V();
  for (let k = 0; k <= NT; k++) {
    const th = (k / NT * 2 - 1) * Math.PI, f = Math.cos(th);
    // hairline latitude by direction: high at the forehead, low at the nape
    let stopY = f > 0.55 ? (style === 'balding' ? 1.79 : 1.79 - 0.035 * Math.min(1, Math.abs(th - 0.15) / 0.7) - (style === 'feather' || style === 'long' ? 0.008 : 0)) : f > 0.1 ? 1.735 : 1.70;
    const endY = f > 0.55 ? stopY : f > 0.15 ? Math.max(len, 1.6) : len;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const ph = Math.PI / 2 - i / 12 * (Math.PI / 2 + 0.45);
      headPoint(th, ph, sex, p); const n = p.clone().sub(HEAD_C).normalize();
      const thick = style === 'balding' ? 0.004 : style === 'short' ? 0.007 : 0.011;
      p.addScaledVector(n, thick + (style === 'bun' && f < -0.3 && i < 6 ? 0.02 * Math.sin(i / 6 * Math.PI) : 0));
      if (p.y < stopY && i > 0) break; pts.push(p.clone());
    }
    const last = pts[pts.length - 1].clone();
    if (endY < last.y - 0.01) { const out = last.clone().sub(HEAD_C); out.y = 0; out.normalize(); const steps = 6;
      for (let s = 1; s <= steps; s++) { const t = s / steps; pts.push(new V(last.x + out.x * 0.02 * t, lerp(last.y, endY, t), last.z + out.z * 0.025 * t)); } }
    // resample to NR+1 points by arc length
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    for (let r = 0; r <= NR; r++) {
      const s = cum[cum.length - 1] * r / NR; let j = 1; while (j < cum.length - 1 && cum[j] < s) j++;
      const t = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1), q = pts[j - 1].clone().lerp(pts[j], Math.min(1, Math.max(0, t)));
      P.push(q.x, q.y, q.z); UV.push(k / NT * 4, r / NR);
    }
  }
  for (let k = 0; k < NT; k++) for (let r = 0; r < NR; r++) { const a = k * (NR + 1) + r, b = (k + 1) * (NR + 1) + r; I.push(a, b, b + 1, a, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------- person
const CAPS = [ // body, bone, capsule from joint A to B (bone names or offsets), radius, mass
  ['pelvis', 'hips', [-0.085, 0.95, 0], [0.085, 0.95, 0], 0.125, 11],
  ['torso', 'spine', [0, 1.1, 0], [0, 1.4, 0], 0.135, 20],
  ['head', 'neck', [0, 1.53, 0], [0, 1.7, 0.01], 0.095, 5],
  ['lUp', 'lUp', 'lUp', 'lFo', 0.05, 2.2], ['lFo', 'lFo', 'lFo', [-0.222, 0.83, 0.01], 0.045, 1.6],
  ['rUp', 'rUp', 'rUp', 'rFo', 0.05, 2.2], ['rFo', 'rFo', 'rFo', [0.222, 0.83, 0.01], 0.045, 1.6],
  ['lTh', 'lTh', 'lTh', 'lSh', 0.075, 8], ['lSh', 'lSh', 'lSh', [-0.1, 0.06, 0.06], 0.055, 4],
  ['rTh', 'rTh', 'rTh', 'rSh', 0.075, 8], ['rSh', 'rSh', 'rSh', [0.1, 0.06, 0.06], 0.055, 4],
];
const PART_OF = { hips: 'pelvis', spine: 'torso', chest: 'torso', neck: 'head', head: 'head', jaw: 'head', lUp: 'lUp', lFo: 'lFo', lHa: 'lFo', rUp: 'rUp', rFo: 'rFo', rHa: 'rFo', lTh: 'lTh', lSh: 'lSh', lFt: 'lSh', rTh: 'rTh', rSh: 'rSh', rFt: 'rSh' };

export class Person {
  constructor(scene, def) {
    this.def = def; this.name = def.name; this.sex = def.sex || 'm';
    const s = this.s = (def.height || (this.sex === 'f' ? 1.66 : 1.8)) / 1.75;
    this.root = new THREE.Group(); scene.add(this.root);
    this.rest = BONES.map((b) => new V(b[2], b[3], b[4]).multiplyScalar(s));
    // bones
    this.bones = BONES.map((b) => { const o = new THREE.Bone(); o.name = b[0]; return o; });
    BONES.forEach((b, i) => { const bn = this.bones[i]; if (b[1] < 0) { bn.position.copy(this.rest[i]); this.root.add(bn); } else { bn.position.copy(this.rest[i]).sub(this.rest[b[1]]); this.bones[b[1]].add(bn); } });
    this.B = Object.fromEntries(BONES.map((b, i) => [b[0], this.bones[i]]));
    this.buildBody();
    this.buildFace();
    this.root.updateMatrixWorld(true);
    // state
    this.phase = Math.random() * 6; this.yaw = 0; this.limp = false; this.alive = true; this.ragBlend = 0;
    this.face = { blink: 0, nextBlink: 1 + Math.random() * 3, lid: -0.35, brow: 0, worry: 0, jaw: 0.02, look: new V(0, 1.6, 5), saccade: new V(), nextSac: 0, talk: 0, scream: 0, fear: 0, dead: false, flush: 0 };
    this.pose = {}; this.wounds = []; this.bleed = 0;
  }

  buildBody() {
    const def = this.def, s = this.s, D = new MeshData(), f = this.sex === 'f';
    const skin = col(def.skin || 0xd9a888), shirt = col(def.shirt || 0x555555), pants = col(def.pants || 0x2a3550), shoes = col(def.shoes || 0x1a1410);
    const coat = def.coat ? col(def.coat) : null, robe = def.robe ? col(def.robe) : null;
    const top = coat || robe || shirt;
    const W = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [BI[k], v]));
    const ring = (x, y, z, rx, rz, w, color, mat = 0, extra = {}) => ({ c: new V(x, y, z).multiplyScalar(s), rx: rx * s, rz: rz * s, w: W(w), color, mat, ...extra });
    const sh = f ? 0.93 : 1.06, hp = f ? 1.07 : 0.97;
    // torso
    const lowCol = robe || coat || pants;
    loft(D, [
      ring(0, 0.8, 0, 0.12 * hp, 0.085, { hips: 1 }, lowCol),
      ring(0, 0.86, -0.004, 0.155 * hp, 0.1, { hips: 1 }, lowCol, 0, { back: 0.015 * hp }),
      ring(0, 0.95, -0.006, 0.168 * hp, 0.108, { hips: 1 }, lowCol, 0, { back: 0.02 * hp }),
      ring(0, 1.03, -0.004, 0.155 * hp, 0.1, { hips: 0.55, spine: 0.45 }, def.belt ? col(def.belt) : (robe || coat || pants)),
      ring(0, 1.12, 0, 0.142, 0.094, { spine: 1 }, top),
      ring(0, 1.22, 0.004, 0.15 * sh, 0.1, { spine: 0.5, chest: 0.5 }, top),
      ring(0, 1.31, 0.008, 0.162 * sh, 0.106, { chest: 1 }, top, 0, { bulge: f ? 0.035 : 0.006 }),
      ring(0, 1.39, 0.004, 0.178 * sh, 0.102, { chest: 1 }, top, 0, { bulge: f ? 0.012 : 0.004 }),
      ring(0, 1.45, -0.006, 0.168 * sh, 0.085, { chest: 1 }, top),
      ring(0, 1.495, -0.01, 0.13, 0.07, { chest: 0.6, neck: 0.4 }, def.collarSkin ? skin : top),
      ring(0, 1.53, -0.012, 0.058, 0.054, { neck: 1 }, skin, 1),
    ], 18, { capA: true });
    loft(D, [ring(0, 1.5, -0.012, 0.056, 0.052, { neck: 1 }, skin, 1), ring(0, 1.56, -0.01, 0.05, 0.048, { neck: 0.5, head: 0.5 }, skin, 1), ring(0, 1.625, -0.014, 0.047, 0.05, { head: 1 }, skin, 1)], 14);
    // skirt / coat tails / robe hang from the hips and follow both thighs
    if (coat || robe || def.skirt) {
      const c = coat || robe || col(def.skirt), bottom = robe ? 0.12 : def.skirt ? 0.55 : 0.5;
      const rings = []; for (let i = 0; i <= 5; i++) { const t = i / 5, y = lerp(0.98, bottom, t), r = lerp(0.172 * hp, robe ? 0.22 : 0.21, t);
        rings.push(ring(0, y, -0.008, r, r * 0.72, t < 0.2 ? { hips: 1 } : { hips: 1 - t * 0.6, lTh: t * 0.3, rTh: t * 0.3 }, c)); }
      loft(D, rings, 22);
    }
    // legs
    for (const [L, x] of [['l', -1], ['r', 1]]) {
      const legCol = robe ? skin : pants, legMat = robe ? 1 : 0;
      loft(D, [
        ring(0.09 * x, 0.97, 0, 0.088, 0.09, { hips: 0.6, [L + 'Th']: 0.4 }, pants),
        ring(0.094 * x, 0.88, 0.004, 0.084, 0.088, { [L + 'Th']: 1 }, robe ? pants : pants),
        ring(0.096 * x, 0.72, 0.008, 0.07, 0.074, { [L + 'Th']: 1 }, legCol, legMat),
        ring(0.098 * x, 0.56, 0.01, 0.054, 0.058, { [L + 'Th']: 0.6, [L + 'Sh']: 0.4 }, legCol, legMat),
        ring(0.098 * x, 0.47, 0.012, 0.05, 0.054, { [L + 'Th']: 0.3, [L + 'Sh']: 0.7 }, legCol, legMat),
        ring(0.099 * x, 0.36, 0.0, 0.052, 0.057, { [L + 'Sh']: 1 }, legCol, legMat, { back: 0.012 }),
        ring(0.1 * x, 0.2, -0.012, 0.038, 0.04, { [L + 'Sh']: 1 }, legCol, legMat),
        ring(0.1 * x, 0.11, -0.018, 0.04, 0.042, { [L + 'Sh']: 0.5, [L + 'Ft']: 0.5 }, shoes),
      ], 14);
      loft(D, [
        ring(0.1 * x, 0.075, -0.07, 0.034, 0.03, { [L + 'Ft']: 1 }, shoes),
        ring(0.1 * x, 0.06, -0.04, 0.042, 0.045, { [L + 'Ft']: 1 }, shoes),
        ring(0.102 * x, 0.05, 0.04, 0.046, 0.04, { [L + 'Ft']: 1 }, shoes),
        ring(0.104 * x, 0.04, 0.12, 0.044, 0.03, { [L + 'Ft']: 1 }, shoes),
        ring(0.105 * x, 0.035, 0.165, 0.03, 0.02, { [L + 'Ft']: 1 }, shoes),
      ], 12, { capA: true, capB: true });
      // arms
      const sleeve = def.shortSleeves ? skin : (coat || robe || shirt), sm2 = def.shortSleeves ? 1 : 0;
      const ax = (y) => lerp(0.178, 0.218, (1.435 - y) / 0.52) * x;
      loft(D, [
        ring(0.15 * x, 1.45, -0.01, 0.055 * sh, 0.06, { chest: 0.5, [L + 'Up']: 0.5 }, coat || robe || shirt),
        ring(ax(1.42), 1.42, -0.01, 0.054 * sh, 0.058, { [L + 'Up']: 1 }, coat || robe || shirt),
        ring(ax(1.3), 1.3, -0.014, 0.046, 0.049, { [L + 'Up']: 1 }, sleeve, sm2),
        ring(ax(1.18), 1.18, -0.022, 0.039, 0.042, { [L + 'Up']: 0.5, [L + 'Fo']: 0.5 }, sleeve, sm2),
        ring(ax(1.08), 1.08, -0.018, 0.04, 0.042, { [L + 'Fo']: 1 }, sleeve, sm2),
        ring(ax(0.95), 0.95, -0.006, 0.029, 0.026, { [L + 'Fo']: 0.8, [L + 'Ha']: 0.2 }, def.shortSleeves || def.gloves ? (def.gloves ? col(def.gloves) : skin) : sleeve, def.gloves ? 0 : (def.shortSleeves ? 1 : 0)),
        ring(ax(0.93), 0.93, -0.002, 0.026, 0.022, { [L + 'Ha']: 1 }, def.gloves ? col(def.gloves) : skin, def.gloves ? 0 : 1),
      ], 12);
      // hand: palm, four jointed fingers, thumb
      const hc = def.gloves ? col(def.gloves) : skin, hm = def.gloves ? 0 : 1, hx = 0.22 * x, H = L + 'Ha';
      loft(D, [ring(hx, 0.95, -0.002, 0.024, 0.024, { [L + 'Fo']: 0.6, [H]: 0.4 }, hc, hm), ring(hx, 0.928, 0.0, 0.014, 0.028, { [H]: 1 }, hc, hm), ring(hx, 0.9, 0.003, 0.0135, 0.038, { [H]: 1 }, hc, hm),
        ring(hx, 0.865, 0.002, 0.0145, 0.044, { [H]: 1 }, hc, hm), ring(hx, 0.838, 0.0, 0.013, 0.043, { [H]: 1 }, hc, hm), ring(hx, 0.83, 0.0, 0.01, 0.036, { [H]: 1 }, hc, hm)], 12, { capB: true });
      for (const [f, z, y, l1, l2, r] of FINGERS) {
        const F1 = L + f + '1', F2 = L + f + '2', ym = y - l1, yt = ym - l2;
        loft(D, [ring(hx, y + 0.006, z, r * 0.9, r * 1.05, { [H]: 0.6, [F1]: 0.4 }, hc, hm), ring(hx, y - 0.006, z, r * 0.88, r, { [F1]: 1 }, hc, hm),
          ring(hx, ym + 0.004, z, r * 0.8, r * 0.9, { [F1]: 0.6, [F2]: 0.4 }, hc, hm), ring(hx, ym - 0.004, z, r * 0.78, r * 0.86, { [F2]: 1 }, hc, hm),
          ring(hx, yt + 0.006, z, r * 0.7, r * 0.78, { [F2]: 1 }, hc, hm), ring(hx, yt, z, r * 0.45, r * 0.5, { [F2]: 1 }, hc, hm)], 8, { capB: true });
      }
      { const [d1, d2] = thumbDirs(x), tb = new V(hx - x * 0.008, 0.9, 0.03), tm = tb.clone().addScaledVector(d1, 0.04), tt = tm.clone().addScaledVector(d2, 0.034);
        const rp = (p, rx, rz, w) => ({ c: p.clone().multiplyScalar(s), rx: rx * s, rz: rz * s, w: W(w), color: hc, mat: hm });
        loft(D, [rp(tb.clone().addScaledVector(d1, -0.012), 0.012, 0.014, { [H]: 1 }), rp(tb, 0.011, 0.012, { [H]: 0.5, [L + 'T1']: 0.5 }), rp(tm, 0.0095, 0.0105, { [L + 'T1']: 0.5, [L + 'T2']: 0.5 }),
          rp(tt.clone().addScaledVector(d2, -0.006), 0.008, 0.009, { [L + 'T2']: 1 }), rp(tt, 0.005, 0.0055, { [L + 'T2']: 1 })], 8, { capB: true }); }
    }
    // head (sculpted, mouth slit)
    const D2 = D; buildHead(D2, this.sex, null, BI.jaw, BI.head);
    // scale the head part
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(D.p);
    // head verts were built unscaled; scale everything after the body (body rings already scaled)
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(D.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(D.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(D.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(D.sw, 4));
    const all = [...D.idx[0], ...D.idx[1], ...D.idx[2]];
    g.setIndex(all); g.addGroup(0, D.idx[0].length, 0); g.addGroup(D.idx[0].length, D.idx[1].length, 1); g.addGroup(D.idx[0].length + D.idx[1].length, D.idx[2].length, 2);
    this.geo = g;
    // head verts: scale by s (body was scaled by ring())
    const hStart = Math.min(...D.idx[2]);
    for (let i = hStart; i < P.length / 3; i++) { P[i * 3] *= s; P[i * 3 + 1] *= s; P[i * 3 + 2] *= s; }
    g.computeVertexNormals();
    const st = skinTexture({ skin: [skin.r, skin.g, skin.b].map((v) => Math.pow(v, 1 / 2.2)), lip: def.lip || (this.sex === 'f' ? [0.62, 0.3, 0.32] : [0.6, 0.38, 0.36]), hair: (def.mask ? [0.25, 0.18, 0.12] : [col(def.hair || 0x3a2a1a).r, col(def.hair || 0x3a2a1a).g, col(def.hair || 0x3a2a1a).b].map((v) => Math.pow(v, 1 / 2.2))), seed: (def.seed || 7) * 13, blush: this.sex === 'f' ? 1 : 0.5, stubble: !!def.stubble, mask: !!def.mask });
    this.skinCanvas = st;
    const clothMat = new THREE.MeshStandardMaterial({ map: T.cloth.map, normalMap: T.cloth.normalMap, roughness: 0.92, vertexColors: true });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62 });
    const headMat = new THREE.MeshStandardMaterial({ map: st.tex, roughness: def.mask ? 0.45 : 0.6 });
    if (def.mask) skinMat.roughness = 0.6;
    this.headMat = headMat; this.skinMat = skinMat;
    const mesh = this.mesh = new THREE.SkinnedMesh(g, [clothMat, skinMat, headMat]);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.skel = new THREE.Skeleton(this.bones);
    this.root.add(mesh); this.root.updateMatrixWorld(true); mesh.bind(this.skel);
  }

  buildFace() {
    const def = this.def, s = this.s, head = this.B.head, jaw = this.B.jaw;
    const headRest = this.rest[BI.head], jawRest = this.rest[BI.jaw];
    const skin = col(def.skin || 0xd9a888);
    const toHead = (p, drop = DROP) => { const q = p.clone(); q.y -= drop; return q.multiplyScalar(s).sub(headRest); };
    // hair
    if (def.hairStyle !== 'none') {
      const hg = buildHair(def, this.sex); hg.translate(0, -DROP, 0); hg.scale(s, s, s); hg.translate(-headRest.x, -headRest.y, -headRest.z);
      const hairCol = col(def.mask ? 0x3b2c20 : (def.hair || 0x3a2a1a));
      const hm = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: hairTexture(hairCol), roughness: 0.75, side: THREE.DoubleSide }));
      hm.castShadow = true; head.add(hm); this.hair = hm;
    }
    // eyes, lids, brows
    this.eyes = []; this.lids = []; this.brows = [];
    const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(def.mask ? [0.02, 0.02, 0.02] : (def.iris || [0.3, 0.42, 0.55])), roughness: 0.08, metalness: 0 });
    const lidMat = new THREE.MeshStandardMaterial({ color: def.mask ? 0xe9e6dc : skin.clone().multiplyScalar(0.95), roughness: 0.6 });
    const eyeG = new THREE.SphereGeometry(0.0122 * s, 16, 12);
    const lidG = new THREE.SphereGeometry(0.0134 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lowG = new THREE.SphereGeometry(0.0131 * s, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.3); lowG.rotateX(Math.PI);
    for (const side of [-1, 1]) {
      const c = toHead(eyePos(this.sex, side), 0);
      const eye = new THREE.Mesh(eyeG, eyeMat); eye.position.copy(c); head.add(eye); this.eyes.push(eye);
      if (def.mask) { eye.material = new THREE.MeshBasicMaterial({ color: 0x050505 }); }
      const lid = new THREE.Mesh(lidG, lidMat); lid.position.copy(c); head.add(lid); this.lids.push(lid);
      const low = new THREE.Mesh(lowG, lidMat); low.position.copy(c); low.rotation.x = -0.12; head.add(low);
      if (!def.mask) {
        const bg = new THREE.BoxGeometry(0.034 * s, 0.0045 * s, 0.007 * s);
        const brow = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: col(def.hair || 0x3a2a1a).multiplyScalar(0.6), roughness: 0.9 }));
        const bp = headPoint(side * 0.36, Math.asin((1.731 - HEAD_C.y) / 0.112), this.sex, new V()); bp.z += 0.001;
        brow.position.copy(toHead(bp)); brow.rotation.y = side * 0.32; brow.userData.y0 = brow.position.y; brow.userData.side = side;
        head.add(brow); this.brows.push(brow);
      }
    }
    // mouth: dark cavity + teeth on head and jaw
    const cav = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1a0606, roughness: 1 }));
    cav.scale.set(1, 0.8, 0.9); cav.position.copy(toHead(new V(0, 1.636, 0.045))); head.add(cav);
    const toothMat = new THREE.MeshStandardMaterial({ color: def.teeth || 0xd8d2bc, roughness: 0.35 });
    const tg = new THREE.TorusGeometry(0.024 * s, 0.0045 * s, 4, 14, Math.PI * 0.9); tg.rotateX(Math.PI / 2); tg.rotateY(-Math.PI * 0.05);
    const up = new THREE.Mesh(tg, toothMat); up.position.copy(toHead(new V(0, 1.6415, 0.05))); up.scale.set(1, 1, 0.75); head.add(up);
    const lo = new THREE.Mesh(tg, toothMat); lo.position.copy(new V(0, 1.6305 - DROP, 0.047).multiplyScalar(s).sub(jawRest)); lo.scale.set(0.95, 1, 0.7); jaw.add(lo);
    if (def.mustache) {
      const mg = new THREE.BoxGeometry(0.05 * s, 0.009 * s, 0.01 * s);
      const mu = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: col(def.hair || 0x3a2a1a).multiplyScalar(0.7), roughness: 1 }));
      mu.position.copy(toHead(new V(0, 1.648, 0.09))); head.add(mu);
    }
    if (def.mask) { this.lids.forEach((l) => l.visible = false); }
  }

  // ---------------------------------------------------------------- face
  updateFace(dt, t) {
    const F = this.face, def = this.def;
    if (def.mask) return;
    // blinking
    F.nextBlink -= dt; if (F.nextBlink < 0 && !F.dead) { F.blink = 0.16; F.nextBlink = (F.fear > 0.5 ? 0.8 : 2) + Math.random() * 4; }
    F.blink = Math.max(0, F.blink - dt);
    const blinkAmt = F.blink > 0 ? Math.sin((F.blink / 0.16) * Math.PI) : 0;
    // lids: relaxed, wide with fear, closed on blink, half shut when dead
    const open = F.dead ? 0.35 : lerp(-0.55, -0.85, Math.min(1, F.fear + F.scream * 0.5)) + (F.strain || 0) * -0.2;
    const lidA = lerp(open, 1.62, blinkAmt * (F.dead ? 0 : 1));
    for (const l of this.lids) l.rotation.x = lidA;
    // brows: lift and knit with fear
    const raise = F.dead ? 0 : Math.min(1, F.fear * 0.8 + F.scream * 0.6 + F.brow), worry = F.dead ? 0 : Math.min(1, F.fear * 0.9 + F.worry);
    for (const b of this.brows) { b.position.y = b.userData.y0 + raise * 0.0055 * this.s; b.rotation.z = -b.userData.side * worry * 0.28; }
    // eyes: aim at the look target with small saccades
    if (!F.dead) {
      F.nextSac -= dt; if (F.nextSac < 0) { F.nextSac = 0.3 + Math.random() * (F.fear > 0.5 ? 0.4 : 1.6); F.saccade.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.1, 0); if (F.fear > 0.6) F.saccade.multiplyScalar(2); }
      this.B.head.updateWorldMatrix(true, false);
      for (const e of this.eyes) {
        _m.copy(this.B.head.matrixWorld).invert();
        const tgt = _v.copy(F.look).applyMatrix4(_m).sub(e.position).normalize();
        let yaw = Math.atan2(tgt.x, tgt.z), pit = Math.asin(Math.max(-1, Math.min(1, -tgt.y)));
        yaw = Math.max(-0.6, Math.min(0.6, yaw + F.saccade.x)); pit = Math.max(-0.45, Math.min(0.45, pit + F.saccade.y));
        e.rotation.set(pit, yaw, 0, 'YXZ');
      }
    }
    // jaw: talk syllables, scream, gasp, slack in death
    let jaw = 0.015;
    if (F.talk > 0) { const syl = Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 7.3) * 0.4); jaw += syl * 0.17 * F.talk; }
    jaw = Math.max(jaw, F.scream * (0.42 + Math.sin(t * 31) * 0.03));
    if (F.gasp) jaw = Math.max(jaw, F.gasp * (0.22 + Math.sin(t * 9) * 0.1));
    if (F.dead) jaw = 0.22;
    F.jaw += (jaw - F.jaw) * Math.min(1, dt * 18);
    this.B.jaw.rotation.x = F.jaw;
    // face colour: strangling turns it dusky, death drains it
    const target = F.dead ? 0.75 : 1;
    const c = this.headMat.color; const fl = F.flush || 0;
    c.setRGB(lerp(1, 0.85, fl) * target, lerp(1, 0.62, fl) * target, lerp(1, 0.78, fl) * (F.dead ? 0.82 : 1));
  }

  // ---------------------------------------------------------- animation
  // pose: { speed, run, sit, crouch, cower, phone, pound, aim, light, look:V3|null, lean, hands }
  animate(dt, t) {
    if (this.limp) { this.fromRagdoll(); this.updateFace(dt, t); return; }
    const P = this.pose, B = this.B, s = this.s;
    const sp = P.speed || 0, run = sp > 2.4 ? Math.min(1, (sp - 2.4) / 1.5) : 0;
    const stride = lerp(1.35, 2.4, run) * s;
    this.phase += (sp / stride) * Math.PI * 2 * dt;
    const ph = this.phase, w = Math.min(1, sp / 1.2);
    const sit = P.sit || 0, cr = Math.max(P.crouch || 0, P.cower || 0);
    const set = (b, x, y, z) => B[b].quaternion.setFromEuler(_e.set(x, y, z, 'YXZ'));
    // legs
    const A = lerp(0.36, 0.65, run) * w, K = lerp(0.55, 1.25, run) * w;
    const lS = Math.sin(ph), rS = Math.sin(ph + Math.PI);
    const thL = -A * lS, thR = -A * rS;
    const knL = 0.06 + K * Math.max(0, Math.sin(ph + 1.9)) + 0.15 * run, knR = 0.06 + K * Math.max(0, Math.sin(ph + Math.PI + 1.9)) + 0.15 * run;
    const breath = Math.sin(t * (1.6 + (this.face.fear || 0) * 2.5)) * 0.012;
    let hipY = this.rest[0].y - Math.abs(Math.sin(ph)) * 0.025 * w - run * 0.05;
    let spineX = 0.05 * w + 0.22 * run + (P.lean || 0), hipX = 0;
    set('lTh', thL, 0.04, -0.04); set('rTh', thR, -0.04, 0.04);
    set('lSh', knL, 0, 0); set('rSh', knR, 0, 0);
    set('lFt', -knL * 0.3 + thL * 0.2, 0, 0); set('rFt', -knR * 0.3 + thR * 0.2, 0, 0);
    if (sit > 0) {
      hipY = lerp(hipY, 0.5 * s, sit);
      for (const L of ['l', 'r']) { set(L + 'Th', lerp(B[L + 'Th'].rotation.x, -1.5, sit), 0, 0); set(L + 'Sh', lerp(B[L + 'Sh'].rotation.x, 1.45, sit), 0, 0); set(L + 'Ft', 0.05, 0, 0); }
      spineX = lerp(spineX, -0.12, sit);
    }
    if (cr > 0) {
      hipY = lerp(hipY, 0.42 * s, cr);
      for (const L of ['l', 'r']) { set(L + 'Th', lerp(B[L + 'Th'].rotation.x, -1.95, cr), 0, L === 'l' ? -0.18 * cr : 0.18 * cr); set(L + 'Sh', lerp(B[L + 'Sh'].rotation.x, 2.3, cr), 0, 0); set(L + 'Ft', -0.4 * cr, 0, 0); }
      spineX = lerp(spineX, 0.55, cr);
    }
    B.hips.position.set(0, hipY, 0);
    set('hips', hipX, Math.sin(ph) * 0.08 * w, 0);
    set('spine', spineX * 0.5 + breath, -Math.sin(ph) * 0.12 * w, 0);
    set('chest', spineX * 0.5 + breath, -Math.sin(ph) * 0.05 * w, 0);
    // arms
    const swing = lerp(0.3, 0.7, run) * w;
    let la = [lS * swing * -1 * -1, 0, -0.08], ra = [rS * swing * -1 * -1, 0, 0.08];
    la = [-(-lS) * swing * 0 + Math.sin(ph + Math.PI) * -swing, 0, -0.07]; ra = [Math.sin(ph) * -swing, 0, 0.07];
    let le = -0.15 - run * 1.1, re = -0.15 - run * 1.1;
    if (P.phone) { ra = [-0.35, 0.3, 0.75]; re = -2.45; }
    if (P.aim) { ra = [-1.42, 0.12, 0]; re = -0.05; la = [-1.25, -0.5, 0]; le = -0.45; }
    if (P.light) { la = [-1.1, 0.25, 0]; le = -0.3; }
    if (P.pound) { const k = Math.max(0, Math.sin(t * 9)); ra = [-1.6 - k * 0.5, 0, 0.1]; re = -1.2 + k * 0.6; la = [-1.6 - (1 - k) * 0.4, 0, -0.1]; le = -1.0; }
    if (P.hands) { la = [-0.9, 0.35, -0.2]; le = -1.6; ra = [-0.9, -0.35, 0.2]; re = -1.6; }   // defensive, hands up
    if (P.cower) { la = [-1.9, 0.6, -0.3]; le = -2.2; ra = [-1.9, -0.6, 0.3]; re = -2.2; }
    if (P.reach) { ra = [-1.3, 0, 0.05]; re = -0.2; }
    if (sit > 0 && !P.phone) { la = [-0.6, 0, -0.1]; le = -0.9; ra = [-0.6, 0, 0.1]; re = -0.9; }
    set('lUp', la[0], la[1], la[2]); set('rUp', ra[0], ra[1], ra[2]); set('lFo', le, 0, 0); set('rFo', re, 0, 0);
    set('lHa', 0, 0, 0); set('rHa', P.phone ? 0.3 : 0, 0, 0);
    // fingers: relaxed, or closed on a phone, a gun, a door, a knife
    const relax = 0.32 + Math.sin(t * 0.7 + this.phase) * 0.03;
    this.curl('l', P.curlL ?? (P.pound || P.aim ? 0.95 : P.cower ? 0.55 : relax));
    this.curl('r', P.curlR ?? (P.pound ? 0.95 : P.phone || P.aim ? 0.8 : P.light ? 0.85 : relax));
    // head looks at its target within the neck's range
    let hy = 0, hx = 0;
    if (P.look) {
      this.root.updateMatrixWorld(); B.chest.updateWorldMatrix(true, false);
      _m.copy(B.chest.matrixWorld).invert(); _v.copy(P.look).applyMatrix4(_m).sub(_v2.set(0, 0.3 * s, 0)).normalize();
      hy = Math.max(-1.2, Math.min(1.2, Math.atan2(_v.x, _v.z))); hx = Math.max(-0.6, Math.min(0.7, Math.asin(-_v.y)));
      if (_v.z < -0.2) hy = Math.sign(hy || 1) * 1.2;
    }
    this.headYaw = lerp(this.headYaw || 0, hy, Math.min(1, dt * 6)); this.headPitch = lerp(this.headPitch || 0, hx, Math.min(1, dt * 6));
    set('neck', this.headPitch * 0.4, this.headYaw * 0.45, 0); set('head', this.headPitch * 0.6 - (cr ? 0.3 : 0), this.headYaw * 0.55, (P.tilt || 0));
    this.face.look.copy(P.look || _v3.set(0, 1.6, 4).applyMatrix4(this.root.matrixWorld));
    // getting up: blend from the last ragdoll pose
    if (this.ragBlend > 0) {
      this.ragBlend = Math.max(0, this.ragBlend - dt / 0.9);
      const k = this.ragBlend * this.ragBlend;
      this.bones.forEach((b, i) => { if (this.lastRag && this.lastRag[i]) b.quaternion.slerp(this.lastRag[i], k); });
      if (this.lastRagHip) B.hips.position.lerp(this.lastRagHip, k);
    }
    this.updateFace(dt, t);
  }

  curl(side, amt) {
    const k = side === 'l' ? 1 : -1, B = this.B;
    for (const [f] of FINGERS) {
      const spread = { I: 0.06, M: 0.02, R: -0.03, P: -0.08 }[f] * (1 - amt);
      B[side + f + '1'].quaternion.setFromEuler(_e.set(spread, 0, k * amt * 1.35, 'YXZ'));
      B[side + f + '2'].quaternion.setFromEuler(_e.set(0, 0, k * amt * 1.55, 'YXZ'));
    }
    B[side + 'T1'].quaternion.setFromEuler(_e.set(amt * 0.55, 0, k * amt * 0.45, 'YXZ'));
    B[side + 'T2'].quaternion.setFromEuler(_e.set(0, 0, k * amt * 0.8, 'YXZ'));
  }
  place(x, y, z, yaw) { this.root.position.set(x, y, z); this.yaw = yaw; this.root.rotation.set(0, yaw, 0); }

  // ------------------------------------------------------------- ragdoll
  goLimp(phys, vel = null) {
    if (this.limp) return;
    this.limp = true; this.root.updateMatrixWorld(true);
    const s = this.s, bodies = {}, rig = this.rig = { asleep: false, still: 0, angDamp: 3, person: this, bodies };
    const jointPos = (ref, bone) => typeof ref === 'string' ? this.B[ref].getWorldPosition(new V()) : new V(ref[0] * s, ref[1] * s, ref[2] * s).sub(this.rest[BI[bone]]).applyMatrix4(this.B[bone].matrixWorld);
    for (const [name, bone, A, Bn, r, m] of CAPS) {
      const a = jointPos(A, bone), b = jointPos(Bn, bone);
      const bn = this.B[bone]; bn.updateWorldMatrix(true, false);
      const bq = new Q(); bn.matrixWorld.decompose(_v3, bq, _v);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const inv = bq.clone().invert();
      const body = new Body(m, r * s, a.clone().sub(mid).applyQuaternion(inv), b.clone().sub(mid).applyQuaternion(inv));
      body.x.copy(mid); body.q.copy(bq); body.rig = rig; body.name = name;
      // bone pose relative to the body
      body.boneOff = new THREE.Matrix4().compose(mid, bq, new V(1, 1, 1)).invert().multiply(_m.copy(bn.matrixWorld));
      if (vel) body.v.copy(vel);
      bodies[name] = body; phys.add(body);
    }
    const J = (n1, n2, at, o) => {
      const b1 = bodies[n1], b2 = bodies[n2], p = typeof at === 'string' ? this.B[at].getWorldPosition(new V()) : at;
      const loc = (b) => p.clone().sub(b.x).applyQuaternion(b.q.clone().invert());
      const wl = (b, v) => v.clone().applyQuaternion(b.q.clone().invert());
      const opts = { ...o };
      for (const k of ['ax', 'ref', 'hinge']) if (o[k]) { opts[k + '1'] = wl(b1, o[k + 'W1'] || o[k]); opts[k + '2'] = wl(b2, o[k]); }
      phys.joint(new Joint(b1, loc(b1), b2, loc(b2), opts));
    };
    this.root.updateMatrixWorld(true);
    const fw = new V(0, 0, 1).applyQuaternion(this.root.quaternion), up = new V(0, 1, 0), side = new V(1, 0, 0).applyQuaternion(this.root.quaternion);
    const dirOf = (n) => { const b = bodies[n]; return b.worldPoint(b.b, new V()).sub(b.worldPoint(b.a, new V())).normalize(); };
    J('pelvis', 'torso', 'spine', { ax: up.clone(), axW1: up.clone(), ref: fw.clone(), swing: 0.55, twist: 0.45 });
    J('torso', 'head', 'neck', { ax: dirOf('head'), axW1: up.clone(), ref: fw.clone(), swing: 0.75, twist: 0.9 });
    for (const L of ['l', 'r']) {
      const sg = L === 'l' ? -1 : 1;
      J('torso', L + 'Up', L + 'Up', { ax: dirOf(L + 'Up'), axW1: new V(sg * 0.55, -0.8, 0.1).applyQuaternion(this.root.quaternion).normalize(), ref: fw.clone(), swing: 1.75, twist: 1.2 });
      J(L + 'Up', L + 'Fo', L + 'Fo', { hinge: side.clone(), ax: dirOf(L + 'Fo'), axW1: dirOf(L + 'Up'), min: -2.6, max: 0.05 });
      J('pelvis', L + 'Th', L + 'Th', { ax: dirOf(L + 'Th'), axW1: new V(sg * 0.25, -0.86, 0.45).applyQuaternion(this.root.quaternion).normalize(), ref: fw.clone(), swing: 1.15, twist: 0.5 });
      J(L + 'Th', L + 'Sh', L + 'Sh', { hinge: side.clone(), ax: dirOf(L + 'Sh'), axW1: dirOf(L + 'Th'), min: -0.05, max: 2.5 });
    }
    // a living ragdoll struggles
    rig.drive = (h) => this.struggle(h);
    phys.drives.push(rig.drive);
    this.phys = phys;
  }
  struggle(h) {
    const R = this.rig; if (!R || R.asleep) return;
    const k = this.alive ? (this.strangled ? 1 : 0.35) : (this.dying || 0);
    if (k <= 0) return;
    const t = performance.now() / 1000, b = R.bodies;
    for (const [n, f, ph] of [['lSh', 9, 0], ['rSh', 11, 2], ['lFo', 7, 1], ['rFo', 8, 3], ['lTh', 5, 4], ['rTh', 6, 5]]) {
      const amp = k * (n.endsWith('Fo') ? 26 : 16) * h * (0.5 + 0.5 * Math.sin(t * f * 0.37 + ph));
      b[n].w.x += Math.sin(t * f + ph) * amp; b[n].w.z += Math.cos(t * f * 1.3 + ph) * amp * 0.6;
    }
    if (this.grabTarget && this.alive) {   // hands claw at whatever is choking them
      for (const n of ['lFo', 'rFo']) { const bb = b[n], tip = bb.worldPoint(bb.b, _v); const d = _v2.subVectors(this.grabTarget, tip); const L = d.length(); if (L > 0.05) bb.v.addScaledVector(d, (h * 30 * k) / L); }
    }
  }
  fromRagdoll() {
    const R = this.rig; if (!R) return;
    this.root.updateMatrixWorld(true);
    _m2.copy(this.root.matrixWorld).invert();
    const done = new Set();
    for (const [name, bone] of CAPS) {
      const b = R.bodies[name], bn = this.B[bone];
      _m.compose(b.x, b.q, _v.set(1, 1, 1)).multiply(b.boneOff);       // desired bone world
      const parent = bn.parent;
      parent.updateWorldMatrix(true, false);
      const local = _v3; const pm = parent === this.root ? this.root.matrixWorld : parent.matrixWorld;
      const L = new THREE.Matrix4().copy(pm).invert().multiply(_m);
      L.decompose(bn.position, bn.quaternion, _v);
      bn.updateMatrixWorld(true); done.add(bone);
    }
    // sleep when everything has settled
    let maxV = 0; for (const n in R.bodies) maxV = Math.max(maxV, R.bodies[n].v.lengthSq(), R.bodies[n].w.lengthSq() * 0.05);
    if (!this.alive && !this.held && maxV < 0.02) { R.still += 1 / 72; if (R.still > 1.5) R.asleep = true; } else R.still = 0;
  }
  wake() { if (this.rig) { this.rig.asleep = false; this.rig.still = 0; } }
  // stand back up from a ragdoll (released before death)
  getUp(phys) {
    if (!this.limp) return;
    const R = this.rig, pel = R.bodies.pelvis, tor = R.bodies.torso;
    this.lastRag = this.bones.map((b) => b.quaternion.clone()); this.lastRag[0] = null;
    phys.remove(R); phys.drives.splice(phys.drives.indexOf(R.drive), 1);
    const fwd = tor.worldPoint(tor.b, new V()).sub(pel.x); fwd.y = 0;
    const yaw = Math.atan2(fwd.x, fwd.z) || this.yaw;
    this.place(pel.x.x, 0, pel.x.z, yaw);
    this.lastRagHip = new V(0, 0.35 * this.s, 0);   // rise from low
    this.ragBlend = 1; this.limp = false; this.rig = null;
    this.B.hips.position.set(0, 0.3 * this.s, 0);
  }
  // knife / hand hit-test capsules in world space
  capsules(out = []) {
    out.length = 0; this.root.updateMatrixWorld(true);
    const s = this.s;
    for (const [name, bone, A, Bn, r] of CAPS) {
      const a = typeof A === 'string' ? this.B[A].getWorldPosition(new V()) : null;
      const bn = this.B[bone];
      let pa, pb;
      if (this.limp && this.rig) { const b = this.rig.bodies[name]; pa = b.worldPoint(b.a, new V()); pb = b.worldPoint(b.b, new V()); }
      else {
        pa = a || new V(A[0] * s, A[1] * s, A[2] * s).sub(this.rest[BI[bone]]).applyMatrix4(bn.matrixWorld);
        pb = typeof Bn === 'string' ? this.B[Bn].getWorldPosition(new V()) : new V(Bn[0] * s, Bn[1] * s, Bn[2] * s).sub(this.rest[BI[bone]]).applyMatrix4(bn.matrixWorld);
      }
      out.push({ name, bone, a: pa, b: pb, r: r * s });
    }
    return out;
  }
  // a stab or cut leaves a wound on the skin that keeps welling and running
  wound(point, normal, boneName, big = false) {
    const bn = this.B[boneName]; bn.updateWorldMatrix(true, false);
    const m = new THREE.Mesh(WOUND_G, WOUND_MAT.clone());
    m.material.opacity = 1; const local = point.clone().addScaledVector(normal, 0.004);
    bn.worldToLocal(local); m.position.copy(local);
    const n = normal.clone().transformDirection(_m.copy(bn.matrixWorld).invert());
    m.quaternion.setFromUnitVectors(new V(0, 0, 1), n); m.rotateZ(Math.random() * 6);
    m.scale.setScalar(big ? 0.05 : 0.03); bn.add(m);
    this.wounds.push({ m, bone: bn, local: local.clone(), n, grow: big ? 0.2 : 0.12, age: 0 });
  }
  updateWounds(dt) {
    for (const w of this.wounds) { w.age += dt; const s = w.m.scale.x; if (s < w.grow) { w.m.scale.x = w.m.scale.y = s + dt * 0.012; w.m.scale.y += dt * 0.004; } }
  }
}
// a wound decal: dark centre, wet blood spreading into the cloth
const WOUND_G = new THREE.PlaneGeometry(1, 1);
export let WOUND_MAT = null;
export function initFleshMaterials() {
  WOUND_MAT = new THREE.MeshStandardMaterial({ map: T.splat.map, color: 0x4a0606, roughness: 0.25, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
}
