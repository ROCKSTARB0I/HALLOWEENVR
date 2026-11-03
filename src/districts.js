// HALLOWEENVR: the rest of Haddonfield around Lampkin Lane. Two avenues run
// north-south at the ends of the lane; Main Street crosses them to the north
// with a row of storefronts and Nichols Hardware (enterable); Haddonfield High
// sits east of the east avenue; the cemetery lies south, past the back fences.
import * as THREE from '../vendor/three.module.js';
import { T, rnd, srand } from './tex.js?v=6';

const V = THREE.Vector3;
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const signTex = (text, { bg = '#1a1a1a', fg = '#f0e6c8', font = 'bold 72px Georgia, serif', w = 1024, h = 160, border = null } = {}) => canvasTex(w, h, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
});

export function buildDistricts(B, W, town, K) {
  srand(19631031);
  const I = new THREE.Matrix4(), scene = town.root;
  town.footprints = []; town.items = {}; town.mission = {};
  B.material('stone', new THREE.MeshStandardMaterial({ map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.95 }), { tile: 0.8 });
  B.batch('fabric').mat.side = THREE.DoubleSide;   // awnings are seen from underneath
  const foot = (x0, z0, x1, z1) => town.footprints.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const mesh = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const quadXZ = (mat, x0, z0, x1, z1, y, col = 0xffffff) => B.quad(mat, I, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col);
  const streetLight = (x, z, armX, armZ, tall = 6.6) => {
    B.box('metal', I, x - 0.08, 0, z - 0.08, x + 0.08, tall, z + 0.08, 0x3a3a38);
    const lx = x + armX, lz = z + armZ;
    B.box('metal', I, Math.min(x, lx) - 0.05, tall - 0.15, Math.min(z, lz) - 0.05, Math.max(x, lx) + 0.05, tall - 0.05, Math.max(z, lz) + 0.05, 0x3a3a38);
    B.box('metal', I, lx - 0.22, tall - 0.3, lz - 0.32, lx + 0.22, tall - 0.1, lz + 0.32, 0x2a2a28);
    B.box('glow', I, lx - 0.18, tall - 0.33, lz - 0.28, lx + 0.18, tall - 0.3, lz + 0.28, 0xffe3b0);
    W.addWall(x - 0.1, z, x + 0.1, z, 0, 6, { thick: 0.16, low: true });
    K.light({ x: lx, y: tall - 0.5, z: lz, color: 0xffc98a, intensity: 120, range: 22, see: 0.75, outdoor: true, spot: true });
  };
  const globeLamp = (x, z) => {   // Main Street's old cast-iron posts
    B.geom('metal', new THREE.CylinderGeometry(0.06, 0.1, 4.0, 8), K.place(x, 2.0, z), 0x1e2420);
    B.geom('glow', new THREE.SphereGeometry(0.26, 14, 10), K.place(x, 4.25, z), 0xfff0d0);
    W.addWall(x - 0.08, z, x + 0.08, z, 0, 4, { thick: 0.16, low: true });
    K.light({ x, y: 4.2, z, color: 0xffd8a0, intensity: 70, range: 16, see: 0.7, outdoor: true, spot: true });
  };

  // ------------------------------------------------------------- streets
  // west avenue (x -88..-80) and east avenue (80..88), Main Street (z -124..-116)
  quadXZ('asphalt', -88, -124, -80, 104, 0.012); quadXZ('asphalt', 80, -124, 88, 40, 0.012);
  quadXZ('asphalt', -88, -124, 88, -116, 0.013);
  for (const [x0, x1] of [[-92, -90], [-78, -76]]) quadXZ('concrete', x0, -112, x1, 104, 0.03);
  for (const [x0, x1] of [[76, 78], [90, 92]]) quadXZ('concrete', x0, -112, x1, 40, 0.03);
  quadXZ('concrete', -92, -112, 92, -110, 0.03); quadXZ('concrete', -92, -130, 92, -128, 0.03);
  for (let z = -116; z < 104; z += 6) { if (Math.abs(z) < 6) continue; quadXZ('trim', -84.06, z, -83.94, z + 3, 0.016, 0x8a8060); if (z < 40) quadXZ('trim', 83.94, z, 84.06, z + 3, 0.016, 0x8a8060); }
  for (let x = -80; x < 80; x += 6) quadXZ('trim', x, -120.06, x + 3, -119.94, 0.016, 0x8a8060);
  for (const z of [-60, -28, 30, 70]) streetLight(-91.2, z, 2.4, 0);
  for (const z of [-60, -28, 22]) streetLight(91.2, z, -2.4, 0);
  for (let x = -80; x <= 80; x += 20) { globeLamp(x, -128.6); globeLamp(x + 10, -111.4); }
  for (const z of [-90, -45, 45, 88]) { K.tree(-95 + rnd() * 2, z + rnd() * 4); }
  for (const z of [-92, -40, 14]) K.tree(95 + rnd() * 2, z + rnd() * 4);
  for (let x = -70; x < 70; x += 16 + rnd() * 8) K.tree(x, -82 + rnd() * 20);

  // ------------------------------------------------------------- storefronts
  const fakeH = (name, cx, zf, rot) => { const m = K.place(cx, 0, zf, rot); const H = { name, m, rot, w: (x, y, z) => new V(x, y, z).applyMatrix4(m), rooms: {}, doors: {}, nodes: {}, lights: {} };
    H.wbox = (x0, y0, z0, x1, y1, z1) => { const a = H.w(x0, y0, z0), b = H.w(x1, y1, z1); return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)]; }; return H; };
  const STORES = [
    { x: -72, n: true, w: 12, sign: 'FIVE & DIME', bg: '#6a1c18', c: 0x8a5a48, lit: 0.0 },
    { x: -56, n: true, w: 14, sign: 'HADDONFIELD DRUGS', bg: '#1c3a5a', c: 0x9a7a62, lit: 0.6 },
    { x: -14, n: true, w: 14, sign: 'FIRST NATIONAL BANK', bg: '#2a2a22', c: 0xb8b0a0, lit: 0.2 },
    { x: 4, n: true, w: 16, sign: 'RIALTO', bg: '#3a0a0a', c: 0x7a4838, lit: 1, marquee: 'CREATURE FEATURE  ·  ALL NIGHT' },
    { x: 24, n: true, w: 12, sign: 'BARBER', bg: '#f0f0f0', fg: '#8a1010', c: 0x8a6a58, lit: 0 },
    { x: 42, n: true, w: 16, sign: 'LAUNDROMAT', bg: '#205a5a', c: 0xa0907a, lit: 0.8 },
    { x: 62, n: true, w: 14, sign: 'SHERIFF', bg: '#1a2a4a', c: 0xa8a08a, lit: 1 },
    { x: -66, n: false, w: 18, sign: 'THE CORNER DINER', bg: '#7a1010', c: 0xc8c0b0, lit: 1 },
    { x: -40, n: false, w: 14, sign: 'GROCERY', bg: '#1e4a1e', c: 0x9a8268, lit: 0.3 },
    { x: -20, n: false, w: 12, sign: 'BOOKS', bg: '#3a2a1a', c: 0x8a7060, lit: 0 },
    { x: 0, n: false, w: 16, sign: 'HADDONFIELD GAZETTE', bg: '#101010', c: 0xb0a898, lit: 0.3 },
    { x: 22, n: false, w: 14, sign: 'GAS & SERVICE', bg: '#a01010', c: 0xd8d4c8, lit: 0.6 },
    { x: 46, n: false, w: 18, sign: 'HADDONFIELD SAVINGS', bg: '#2a2a2a', c: 0xb8a890, lit: 0 },
    { x: 68, n: false, w: 14, sign: 'FLORIST', bg: '#3a1a3a', c: 0x9a8878, lit: 0 },
  ];
  for (const S of STORES) {
    const zf = S.n ? -128.5 : -111.5, rot = S.n ? Math.PI : 0, d = 15, w = S.w, H = fakeH('store' + S.x, S.x, zf, rot);
    B.box({ def: 'brick', ny: 'black' }, H.m, -w / 2, 0, 0, w / 2, 7.4, d, S.c);
    B.box('trim', H.m, -w / 2 - 0.1, 7.2, -0.2, w / 2 + 0.1, 7.6, 0.4, 0x6a5a4a);
    W.addBox(...H.wbox(-w / 2, 0, 0, w / 2, 7.4, d)); foot(...[H.wbox(-w / 2, 0, 0, w / 2, 0, d)].map((b) => [b[0], b[2], b[3], b[5]])[0]);
    const lit = rnd() < S.lit;
    for (const [a, b] of [[-w / 2 + 0.6, -1.0], [1.0, w / 2 - 0.6]]) {
      B.box('trim', H.m, a - 0.08, 0.4, -0.12, b + 0.08, 0.55, 0.02, 0xd8d0c0);
      B.quad(lit ? 'lit' : 'glass', H.m, [b, 0.55, -0.03], [a, 0.55, -0.03], [a, 3.0, -0.03], [b, 3.0, -0.03], lit ? 0xffd090 : 0x14181c);
      B.box('trim', H.m, a - 0.08, 3.0, -0.12, b + 0.08, 3.12, 0.02, 0xd8d0c0);
    }
    B.box('dark', H.m, -0.7, 0, -0.06, 0.7, 2.5, 0.0, 0x3a2418);
    for (let i = 0; i < 3; i++) { const x0 = -w / 2 + 1 + i * (w - 2) / 3, x1 = x0 + (w - 2) / 3 - 0.8; B.quad(lit && i === 1 ? 'lit' : 'glass', H.m, [x1, 4.4, -0.03], [x0, 4.4, -0.03], [x0, 6.0, -0.03], [x1, 6.0, -0.03], lit && i === 1 ? 0xe0a060 : 0x14181c); }
    // striped awning and the sign board
    B.quad('fabric', H.m, [-w / 2 + 0.3, 3.35, 0], [w / 2 - 0.3, 3.35, 0], [w / 2 - 0.3, 2.85, -1.5], [-w / 2 + 0.3, 2.85, -1.5].map((v) => v), S.awn || 0x6a2a24);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 2, 10), 0.75), new THREE.MeshStandardMaterial({ map: signTex(S.sign, { bg: S.bg, fg: S.fg || '#f0e6c8' }), roughness: 0.6, emissive: lit ? 0x3a3020 : 0x000000 }));
    const sp = H.w(0, 3.85, -0.08); sg.position.copy(sp); sg.rotation.y = rot + Math.PI; scene.add(sg);
    if (S.marquee) {   // the Rialto's marquee juts over the sidewalk, lit up
      B.box({ def: 'metal', ny: 'glow' }, H.m, -w / 2 + 1.5, 3.4, -2.2, w / 2 - 1.5, 4.6, 0, { def: 0x6a1a10, ny: 0xffe8b0 });
      const mq = new THREE.Mesh(new THREE.PlaneGeometry(w - 3.2, 0.9), new THREE.MeshBasicMaterial({ map: signTex(S.marquee, { bg: '#f8f0d8', fg: '#1a1010', font: 'bold 64px Helvetica, Arial', border: '#c8a050' }) }));
      mq.position.copy(H.w(0, 4.0, -2.22)); mq.rotation.y = rot + Math.PI; scene.add(mq);
      const p = H.w(0, 3.2, -2.5); K.light({ x: p.x, y: p.y, z: p.z, color: 0xffe0b0, intensity: 14, range: 9, see: 0.8, outdoor: true });
    }
    if (lit) { const p = H.w(0, 1.8, -1.2); K.light({ x: p.x, y: p.y, z: p.z, color: 0xffcf90, intensity: 3, range: 7, see: 0.5, outdoor: true }); }
    // the back: a service door and a bare bulb (the alley behind the north row)
    B.box('dark', H.m, w / 2 - 2.6, 0, d, w / 2 - 1.6, 2.2, d + 0.06, 0x4a3a2e);
    if (S.n) { const p = H.w(w / 2 - 2.1, 2.6, d + 0.25); B.box('glow', H.m, w / 2 - 2.2, 2.5, d + 0.05, w / 2 - 2.0, 2.7, d + 0.25, 0xffe2b0); K.light({ x: p.x, y: p.y, z: p.z, color: 0xffd09a, intensity: 14, range: 13, see: 0.65, outdoor: true }); }
    for (let k = 0; k < 2; k++) if (S.n && rnd() < 0.6) { const x = -w / 2 + 1 + rnd() * (w - 4); B.box('dark', H.m, x, 0, d + 0.3, x + 0.9, 0.7 + rnd() * 0.4, d + 1.1, 0x7a5a38); W.addBox(...H.wbox(x, 0, d + 0.3, x + 0.9, 1.0, d + 1.1)); }
  }

  // ---------------------------------------------------------- Nichols Hardware
  // north side of Main Street; local x -7..7, z 0 (front, faces the street) .. 16 (back, on the alley)
  {
    const H = fakeH('hardware', -33, -128.5, Math.PI); town.houses.hardware = H; H.label = 'Nichols Hardware';
    const F = 0.12, TOPH = 4.2, t = 0.2;
    const ext = (axis, c, a0, a1, ops, outFace) => K.wallRun(B, W, H, axis, c, a0, a1, F, TOPH, t, ops, { def: 'trim', [outFace]: 'brick', [outFace[0] === 'n' ? 'p' + outFace[1] : 'n' + outFace[1]]: 'plaster' }, { def: 0xe0d8c8, [outFace]: 0x8a4a38 });
    const win = (a, b) => ({ a, b, lo: 0.4, hi: 3.2, kind: 'window' }), door = (a, b) => ({ a, b, lo: 0, hi: 2.3, kind: 'door' });
    ext('x', 0, -7, 7, [win(-6.4, -1.2), door(-0.6, 0.6), win(1.2, 6.4)], 'nz');
    ext('x', 16, -7, 7, [door(2.0, 3.0)], 'pz');
    ext('z', -7, -t / 2, 16 + t / 2, [], 'nx'); ext('z', 7, -t / 2, 16 + t / 2, [], 'px');
    K.wallRun(B, W, H, 'x', 11, -7, 7, F, TOPH, 0.12, [{ a: -1, b: 1, lo: 0, hi: 2.4, kind: 'arch' }], 'plaster', 0xd8d0c0);
    B.box({ def: 'brick' }, H.m, -7.1, TOPH, -0.1, 7.1, 7.6, 16.1, 0x8a4a38);           // the dark upper floor
    B.box('trim', H.m, -7.3, 7.4, -0.3, 7.3, 7.8, 0.5, 0x5a4a3a);
    B.box({ def: 'plaster' }, H.m, -7, TOPH - 0.12, 0, 7, TOPH, 16, 0xd8d4c8);
    B.quad('wood', H.m, [-7, F + 0.002, 16], [7, F + 0.002, 16], [7, F + 0.002, 0], [-7, F + 0.002, 0]);
    B.box('concrete', H.m, -7, 0, 0, 7, F, 16, 0x9a9a9a);
    W.addFloor(...(() => { const b = H.wbox(-7, 0, 0, 7, 0, 16); return [b[0], b[2], b[3], b[5]]; })(), F);
    const zone = (() => { const b = H.wbox(-7, 0, 0, 7, 0, 16); return { x0: b[0], z0: b[2], x1: b[3], z1: b[5], y0: F, y1: TOPH, indoor: true, house: 'hardware', room: 'store' }; })();
    W.addZone(zone); H.rooms.store = zone;
    const sc = { add: (o) => scene.add(o) };
    H.doors.front = K.makeDoor(sc, W, H, 'x', 0, -0.6, 0.6, F, 1, { locked: true, window: true, color: 0x2a3a2a });
    H.doors.back = K.makeDoor(sc, W, H, 'x', 16, 3.0, 2.0, F, -1, { locked: true, color: 0x5a4a3a });
    town.doors.push(H.doors.front, H.doors.back);
    // sign, awning, the night light inside
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.85), new THREE.MeshStandardMaterial({ map: signTex('NICHOLS HARDWARE', { bg: '#14321e', fg: '#f2e8c8', border: '#c8b070' }), roughness: 0.6 }));
    sg.position.copy(H.w(0, 3.9, -0.12)); sg.rotation.y = Math.PI + Math.PI; scene.add(sg);
    B.quad('fabric', H.m, [-6.6, 3.4, 0], [6.6, 3.4, 0], [6.6, 2.9, -1.5], [-6.6, 2.9, -1.5], 0x1e4a2a);
    const nl = H.w(0, 3.6, 8); const L = { x: nl.x, y: nl.y, z: nl.z, color: 0xc8e0ff, intensity: 3.5, range: 12, see: 0.55, on: true, zone, flicker: 3 }; W.lights.push(L);
    // aisles of stock
    const stock = [];
    for (const ax of [-4.2, 0, 4.2]) {
      B.box('metal', H.m, ax - 0.35, F, 3, ax + 0.35, F + 1.9, 9.6, 0x5a6a5a);
      W.addBox(...H.wbox(ax - 0.35, F, 3, ax + 0.35, F + 1.9, 9.6));
      for (let y = 0.45; y < 1.9; y += 0.48) for (let z = 3.2; z < 9.5; z += 0.36 + rnd() * 0.2) for (const sd of [-1, 1]) if (rnd() > 0.15) stock.push([ax + sd * (0.2 + rnd() * 0.08), F + y, z, 0.18 + rnd() * 0.14, 0.14 + rnd() * 0.24, 0.16 + rnd() * 0.12]);
    }
    const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: T.cloth.map, roughness: 0.7 }), stock.length);
    const COLS = [0xb03020, 0x2a5a9a, 0xd8b030, 0x3a7a3a, 0xe0e0d0, 0x8a5a2a, 0x5a2a6a, 0xc86020];
    stock.forEach(([x, y, z, w, h, d], i) => { const p = H.w(x, y, z); sm.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new V(w, h, d))); sm.setColorAt(i, new THREE.Color(COLS[(rnd() * COLS.length) | 0])); });
    sm.castShadow = true; scene.add(sm);
    // counter and register; the knife case on it
    B.box('dark', H.m, 3.2, F, 1.6, 6.6, F + 1.0, 2.4, 0x6a4a2a); W.addBox(...H.wbox(3.2, F, 1.6, 6.6, F + 1.0, 2.4));
    B.box('metal', H.m, 5.4, F + 1.0, 1.7, 6.2, F + 1.3, 2.2, 0x3a3a38);
    B.box('glass', H.m, 3.4, F + 1.0, 1.7, 5.0, F + 1.25, 2.3, 0xffffff);
    // the Halloween display in the left window: a board of masks
    B.box('dark', H.m, -6.2, F, 0.5, -1.6, F + 0.8, 1.4, 0x5a3a22); W.addBox(...H.wbox(-6.2, F, 0.5, -1.6, F + 0.8, 1.4));
    B.box('dark', H.m, -6.0, F + 0.8, 1.25, -1.8, F + 2.4, 1.35, 0x4a2e1a);
    const maskTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e8e4da'; g.fillRect(0, 0, w, h); g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(42, 54, 13, 7, 0, 0, 6.28); g.ellipse(86, 54, 13, 7, 0, 0, 6.28); g.fill(); g.fillStyle = '#c8c0b0'; g.fillRect(58, 60, 12, 26); g.fillStyle = '#5a4a3a'; g.fillRect(44, 98, 40, 4); g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, 22); });
    const others = [0x5a8a3a, 0xc8a070, 0x8a1a1a, 0xd0d0c0];
    const maskGeo = new THREE.SphereGeometry(0.13, 18, 12, Math.PI * 0.25, Math.PI * 0.5, 0.2, 2.6); maskGeo.scale(1, 1.25, 0.7);
    for (let i = 0; i < 5; i++) {
      const p = H.w(-5.4 + i * 0.85, F + 1.65, 1.22), mat = i === 2 ? new THREE.MeshStandardMaterial({ map: maskTex, roughness: 0.5, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: others[i % 4], roughness: 0.6, side: THREE.DoubleSide });
      const m = mesh(maskGeo, mat, p.x, p.y, p.z, H.rot + Math.PI);
      if (i === 2) town.items.mask = { mesh: m, pos: p, label: 'the pale mask' };
    }
    // the knife on the counter case, the rope in the stockroom
    const knife = new THREE.Group(); const kb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.004, 0.22), new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.2 })); kb.position.z = 0.11; knife.add(kb);
    const kh = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 })); kh.position.z = -0.06; knife.add(kh);
    { const p = H.w(4.2, F + 1.27, 2.0); knife.position.copy(p); knife.rotation.y = 0.6; scene.add(knife); town.items.knife = { mesh: knife, pos: p, label: 'a kitchen knife' }; }
    B.box('metal', H.m, -6.8, F, 12, -5.6, F + 2.2, 15.6, 0x5a5a50); W.addBox(...H.wbox(-6.8, F, 12, -5.6, F + 2.2, 15.6));
    { const p = H.w(-6.2, F + 1.12, 13.6); const rope = mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 22), new THREE.MeshStandardMaterial({ color: 0x9a8058, roughness: 0.9, map: T.cloth.map }), p.x, p.y, p.z); rope.rotation.x = Math.PI / 2; town.items.rope = { mesh: rope, pos: p, label: 'the rope' }; }
    for (let i = 0; i < 6; i++) B.box('dark', H.m, 1.5 + (i % 3) * 1.6, F, 12.4 + (i > 2 ? 1.4 : 0), 2.7 + (i % 3) * 1.6, F + 0.9 + rnd() * 0.5, 13.5 + (i > 2 ? 1.4 : 0), 0x8a6a42);
    // navigation inside: front, aisles, stockroom, back door, alley
    const N = H.nodes, n = (name, x, z, extra = {}) => { const p = H.w(x, 0, z); const node = { x: p.x, y: F, z: p.z, house: 'hardware', room: 'store', name, ...extra }; node.id = town.nav.nodes.length; town.nav.nodes.push(node); return (N[name] = node); };
    n('porch', 0, -1.6, { room: null, outside: true }); n('front', 0, 1.2, { door: H.doors.front });
    n('aisleL', -2.1, 6); n('aisleR', 2.1, 6); n('frontRoom', 0, 2.2); n('stockArch', 0, 11); n('stock', 0, 13.5); n('backDoor', 2.5, 16, { door: H.doors.back }); n('back', 2.5, 17.8, { room: null, outside: true });
    for (const [a, b] of [['porch', 'front'], ['front', 'frontRoom'], ['frontRoom', 'aisleL'], ['frontRoom', 'aisleR'], ['aisleL', 'stockArch'], ['aisleR', 'stockArch'], ['stockArch', 'stock'], ['stock', 'backDoor'], ['backDoor', 'back']]) town.nav.edges.push([N[a].id, N[b].id]);
    foot(...(() => { const b = H.wbox(-7.2, 0, -0.2, 7.2, 0, 16.2); return [b[0], b[2], b[3], b[5]]; })());
    town.mission.hardwareBack = H.w(2.5, 0, 19);
  }
  // the alley behind the north storefronts
  quadXZ('asphalt', -88, -154, 88, -146, 0.012, 0x8a8a8a);
  for (const x of [-80, -45, -5, 30, 70]) { B.box('metal', I, x, 0, -153.5, x + 2.2, 1.4, -152.0, 0x3a5a3a); W.addBox(x, 0, -153.5, x + 2.2, 1.4, -152.0); }
  for (const x of [-72, -48, -20, 10, 40, 70]) streetLight(x, -153.6, 0, 1.6, 5.8);
  // fill the gaps between storefronts so Main Street reads as one wall of shops, leaving two passages to the alley
  for (const north of [true, false]) {
    const occ = STORES.filter((q) => q.n === north).map((q) => [q.x - q.w / 2, q.x + q.w / 2]);
    if (north) occ.push([-40, -26]);                                     // Nichols Hardware
    occ.sort((a, b) => a[0] - b[0]);
    const passages = north ? [[-46.5, -43.5], [11, 13.5]] : [[-30, -27.5]];
    let x = -80;
    for (const [a, b] of [...occ, [80, 80]]) {
      const gaps = [[x, a]]; for (const [p0, p1] of passages) for (let i = gaps.length - 1; i >= 0; i--) { const [g0, g1] = gaps[i]; if (p0 < g1 && p1 > g0) gaps.splice(i, 1, [g0, p0], [p1, g1]); }
      for (const [g0, g1] of gaps) if (g1 - g0 > 0.4) {
        const z0 = north ? -128.5 : -111.5, z1 = north ? -143.5 : -96.5, h = 5.8 + rnd() * 2.4, c = new THREE.Color().setHSL(0.03 + rnd() * 0.05, 0.3, 0.32 + rnd() * 0.12).getHex();
        B.box({ def: 'brick', ny: 'black' }, I, g0, 0, Math.min(z0, z1), g1, h, Math.max(z0, z1), c);
        B.box('trim', I, g0, h - 0.2, north ? z0 - 0.2 : z0, g1, h + 0.15, north ? z0 + 0.3 : z0 + 0.2, 0x5a4a3a);
        if (g1 - g0 > 3) for (let k = 0; k < Math.floor((g1 - g0) / 3); k++) { const wx = g0 + 0.8 + k * 3; B.quad('glass', I, ...(north ? [[wx, 3.9, z0 + 0.03], [wx + 1.4, 3.9, z0 + 0.03], [wx + 1.4, 5.2, z0 + 0.03], [wx, 5.2, z0 + 0.03]] : [[wx + 1.4, 3.9, z0 - 0.03], [wx, 3.9, z0 - 0.03], [wx, 5.2, z0 - 0.03], [wx + 1.4, 5.2, z0 - 0.03]]), 0x14181c); }
        W.addBox(g0, 0, Math.min(z0, z1), g1, h, Math.max(z0, z1)); foot(g0, Math.min(z0, z1), g1, Math.max(z0, z1));
      }
      x = Math.max(x, b);
    }
  }
  town.mission.alleyStart = new V(-60, 0, -150);
  { const L = { x: -33, y: 3.4, z: -146.4, color: 0xffd8a0, intensity: 6, range: 9, see: 0.6, on: true, outdoor: true }; W.lights.push(L); B.box('glow', I, -33.3, 3.3, -146.4, -32.7, 3.5, -146.2, 0xffe0b0); }

  // ---------------------------------------------------------- Haddonfield High
  {
    const x0 = 100, x1 = 152, z0 = -84, z1 = -50, hgt = 8.6;
    B.box({ def: 'brick', py: 'black' }, I, x0, 0, z0, x1, hgt, z1, 0xa05a42);
    B.box('trim', I, x0 - 0.25, hgt - 0.3, z0 - 0.25, x1 + 0.25, hgt + 0.25, z1 + 0.25, 0xd8d0c0);
    W.addBox(x0, 0, z0, x1, hgt, z1); foot(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
    for (const fy of [1.2, 5.0]) for (let z = z0 + 2; z < z1 - 2; z += 3.2) {
      if (Math.abs(z - (z0 + z1) / 2) < 4) continue;
      const lit = rnd() < 0.18;
      B.quad(lit ? 'lit' : 'glass', I, [x0 - 0.03, fy, z], [x0 - 0.03, fy, z + 2], [x0 - 0.03, fy + 2.2, z + 2], [x0 - 0.03, fy + 2.2, z], lit ? 0xd8e0c8 : 0x182026);
      B.box('trim', I, x0 - 0.14, fy - 0.12, z - 0.1, x0, fy, z + 2.1, 0xe0d8c8);
    }
    // entrance portico: steps, columns, doors, lettering
    const zc = (z0 + z1) / 2;
    B.box('concrete', I, x0 - 4, 0, zc - 4.5, x0, 0.6, zc + 4.5, 0xb0aca0); W.addFloor(x0 - 4, zc - 4.5, x0, zc + 4.5, 0.6);
    W.addRamp(x0 - 6, zc - 3, x0 - 4, zc + 3, 'x', x0 - 6, x0 - 4, 0, 0.6);
    for (const dz of [-3.6, -1.2, 1.2, 3.6]) { B.geom('trim', new THREE.CylinderGeometry(0.3, 0.34, 6.2, 14), K.place(x0 - 3.4, 3.7, zc + dz), 0xe8e2d4); W.addWall(x0 - 3.7, zc + dz, x0 - 3.1, zc + dz, 0, 6, { thick: 0.6 }); }
    B.box('trim', I, x0 - 4.2, 6.8, zc - 4.8, x0, 7.6, zc + 4.8, 0xe8e2d4);
    B.box('dark', I, x0 - 0.06, 0.6, zc - 1.4, x0, 3.2, zc + 1.4, 0x3a2a1c);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.6), new THREE.MeshStandardMaterial({ map: signTex('HADDONFIELD HIGH SCHOOL', { bg: '#e8e2d4', fg: '#3a2a20', font: 'bold 70px Georgia, serif' }), roughness: 0.7 }));
    sg.position.set(x0 - 4.22, 7.2, zc); sg.rotation.y = -Math.PI / 2; scene.add(sg);
    { const L = { x: x0 - 3, y: 6.4, z: zc, color: 0xffe2b8, intensity: 18, range: 11, see: 0.7, on: true, outdoor: true }; W.lights.push(L); }
    // walk, lawn edging, flagpole, bike rack, the bus, the lot
    quadXZ('concrete', 92, zc - 1.5, x0 - 6, zc + 1.5, 0.028);
    B.geom('metal', new THREE.CylinderGeometry(0.06, 0.09, 10, 10), K.place(95.5, 5, zc - 8), 0xcfcfcf); W.addWall(95.4, zc - 8, 95.6, zc - 8, 0, 9, { thick: 0.2, low: true });
    const flag = mesh(new THREE.PlaneGeometry(1.8, 1.0, 12, 6), new THREE.MeshStandardMaterial({ map: canvasTex(180, 100, (g) => { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f0f0f0' : '#b01818'; g.fillRect(0, i * 100 / 13, 180, 100 / 13 + 1); } g.fillStyle = '#1c2a6a'; g.fillRect(0, 0, 76, 54); }), side: THREE.DoubleSide, roughness: 0.9 }), 95.5, 9.2, zc - 7.1, Math.PI / 2);
    town.flag = flag;
    for (let i = 0; i < 6; i++) B.box('metal', I, 97, 0, zc + 6 + i * 0.5, 97.05, 0.8, zc + 6.05 + i * 0.5, 0x8a8a88);
    { const bx = 93.2, bz = -40; B.box({ def: 'paint', ny: 'black' }, I, bx - 1.25, 0.45, bz - 5.5, bx + 1.25, 3.1, bz + 5.5, 0xd8a018);
      B.box('black', I, bx - 1.27, 1.9, bz - 5.2, bx + 1.27, 2.7, bz + 4.4, 0x141414);
      for (const z of [-3.8, 3.6]) for (const sx of [-1, 1]) B.geom('black', new THREE.CylinderGeometry(0.48, 0.48, 0.3, 16).rotateZ(Math.PI / 2), K.place(bx + sx * 1.1, 0.48, bz + z), 0x111111);
      W.addBox(bx - 1.3, 0, bz - 5.6, bx + 1.3, 3.1, bz + 5.6); foot(bx - 1.6, bz - 6, bx + 1.6, bz + 6); }
    quadXZ('asphalt', 100, -112, 152, -88, 0.012, 0x9a9a9a);
    for (let x = 102; x < 150; x += 3) quadXZ('trim', x, -100.1, x + 0.12, -96, 0.016, 0xc8c0a0);
    town.cars.push({ x: 108, z: -98, yaw: 0, color: 0x3a5a3a, owner: 'lot' }, { x: 120, z: -98, yaw: Math.PI, color: 0x8a7a5a, owner: 'lot' }, { x: 133, z: -98, yaw: 0, color: 0x2a2a3a, owner: 'lot' });
    for (const [x, z] of [[96, -96], [96, -20], [130, -40], [146, -40]]) K.tree(x, z);
    town.mission.schoolDoor = new V(x0 - 6.5, 0, zc); town.mission.schoolFront = new V(91, 0, zc);
    // Laurie's walk home: out the front, down the east avenue, along Lampkin Lane to the Doyle house
    town.mission.walkHome = [new V(x0 - 7, 0, zc), new V(91, 0, zc), new V(91, 0, -30), new V(91, 0, 6.8), new V(60, 0, 6.8), new V(40, 0, 6.8), new V(25.5, 0, 6.8), new V(25.5, 0, 10.2)];
    town.mission.stalkerStart = new V(97.5, 0, -33);   // behind the school bus
  }

  // ---------------------------------------------------------- the cemetery
  {
    const cx0 = -74, cx1 = -14, cz0 = 52, cz1 = 100;
    quadXZ('grass', cx0, cz0, cx1, cz1, 0.008, 0x8a9a78);
    town.noLeaves = (x, z) => false;
    // iron fence with a gate on the avenue side
    const bars = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.2);
      for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; B.box('black', I, x - 0.018, 0, z - 0.018, x + 0.018, 1.75, z + 0.018, 0x1a1a1a); }
      B.box('black', I, Math.min(ax, bx) - 0.02, 1.5, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, 1.56, Math.max(az, bz) + 0.02, 0x1a1a1a);
      B.box('black', I, Math.min(ax, bx) - 0.02, 0.25, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, 0.31, Math.max(az, bz) + 0.02, 0x1a1a1a);
      W.addWall(ax, az, bx, bz, 0, 1.8, { thick: 0.05, see: true });
    };
    bars(cx0, cz0, cx1, cz0); bars(cx1, cz0, cx1, cz1); bars(cx0, cz1, cx1, cz1); bars(cx0, cz0, cx0, 74); bars(cx0, 78, cx0, cz1);
    for (const z of [73.6, 78.4]) { B.box('stone', I, cx0 - 0.4, 0, z - 0.4, cx0 + 0.4, 2.4, z + 0.4, 0x8a8a84); W.addBox(cx0 - 0.4, 0, z - 0.4, cx0 + 0.4, 2.4, z + 0.4); }
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.5), new THREE.MeshStandardMaterial({ map: signTex('HADDONFIELD MEMORIAL', { bg: '#1a1a1a', fg: '#c8c0a8', font: 'bold 74px Georgia, serif' }), roughness: 0.6, side: THREE.DoubleSide }));
    gs.position.set(cx0, 2.75, 76); gs.rotation.y = -Math.PI / 2; scene.add(gs);
    B.box('black', I, cx0 - 0.05, 2.45, 73.6, cx0 + 0.05, 2.5, 78.4, 0x1a1a1a);
    quadXZ('concrete', -80, 75, cx0, 77, 0.03, 0x8a8678);
    quadXZ('concrete', cx0, 75.2, cx1 - 6, 76.8, 0.02, 0x7a7670);
    // rows of headstones: slabs, crosses, obelisks, markers
    const stone = (x, z, kind, tint) => {
      const ry = (rnd() - 0.5) * 0.12, lean = (rnd() - 0.5) * 0.08, m = new THREE.Matrix4().compose(new V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, lean * 0.5)), new V(1, 1, 1));
      if (kind === 0) { B.geom('stone', new THREE.BoxGeometry(0.7, 0.75, 0.16).translate(0, 0.375, 0), m, tint); B.geom('stone', new THREE.CylinderGeometry(0.35, 0.35, 0.16, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.75, 0), m, tint); }
      else if (kind === 1) { B.geom('stone', new THREE.BoxGeometry(0.14, 1.2, 0.14).translate(0, 0.6, 0), m, tint); B.geom('stone', new THREE.BoxGeometry(0.62, 0.14, 0.14).translate(0, 0.88, 0), m, tint); }
      else if (kind === 2) { B.geom('stone', new THREE.BoxGeometry(0.42, 0.3, 0.42).translate(0, 0.15, 0), m, tint); B.geom('stone', new THREE.CylinderGeometry(0.07, 0.17, 1.7, 4).rotateY(Math.PI / 4).translate(0, 1.15, 0), m, tint); }
      else B.geom('stone', new THREE.BoxGeometry(0.6, 0.12, 0.35).translate(0, 0.06, 0), m, tint);
      if (kind !== 3) W.addBox(x - 0.36, 0, z - 0.12, x + 0.36, kind === 2 ? 2 : 0.9, z + 0.12);
    };
    for (let z = cz0 + 4; z < cz1 - 3; z += 3.4) for (let x = cx0 + 4; x < cx1 - 3; x += 2.6) {
      if (Math.abs(z - 76) < 2.5) continue;                              // the main path
      if (Math.abs(x - -40) < 1.5 && Math.abs(z - 82.6) < 2) continue;    // Judith's plot
      if (rnd() < 0.18) continue;
      const k = rnd(), g = 0.75 + rnd() * 0.3; stone(x + (rnd() - 0.5) * 0.5, z, k < 0.6 ? 0 : k < 0.75 ? 1 : k < 0.85 ? 2 : 3, new THREE.Color(g, g * 0.98, g * 0.93).getHex());
    }
    // Judith Myers' stone, loose in the ground, can be lifted
    const jt = canvasTex(256, 300, (g, w, h) => { g.fillStyle = '#8a8880'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${40 + Math.random() * 60},${40 + Math.random() * 50},0.15)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = '#3a3a36'; g.textAlign = 'center'; g.font = 'bold 26px Georgia, serif'; g.fillText('JUDITH', w / 2, 120); g.fillText('MARGARET', w / 2, 152); g.fillText('MYERS', w / 2, 184); g.font = '22px Georgia, serif'; g.fillText('1947 - 1963', w / 2, 226); });
    const jg = new THREE.BoxGeometry(0.62, 0.8, 0.14).translate(0, 0.4, 0);
    const jmats = [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ color: 0x9a988e, roughness: 0.95, map: i === 4 ? jt : T.concrete.map }));
    const judith = mesh(jg, jmats, -40, 0, 82.6, Math.PI); town.items.headstone = { mesh: judith, pos: judith.position.clone(), label: "Judith's headstone", heavy: true };
    // the mausoleum and the groundskeeper's shed
    B.box({ def: 'stone' }, I, -28, 0, 90, -20, 4.2, 97, 0xa8a49a); W.addBox(-28, 0, 90, -20, 4.2, 97); foot(-28.5, 89.5, -19.5, 97.5);
    B.geom('stone', new THREE.CylinderGeometry(0.01, 6.2, 1.4, 4, 1).rotateY(Math.PI / 4).scale(0.74, 1, 0.62), K.place(-24, 4.9, 93.5), 0x9a968c);
    for (const x of [-27, -25, -23, -21]) B.geom('stone', new THREE.CylinderGeometry(0.22, 0.25, 3.8, 12), K.place(x, 1.9, 89.6), 0xb8b4aa);
    B.box('black', I, -25, 0, 89.95, -23, 2.6, 90.0, 0x14100c);
    B.box({ def: 'siding', py: 'shingle' }, I, -70, 0, 92, -65, 2.8, 97, 0x6a6a5a); W.addBox(-70, 0, 92, -65, 2.8, 97); foot(-70.5, 91.5, -64.5, 97.5);
    { const L = { x: -64.8, y: 2.4, z: 94, color: 0xffc888, intensity: 5, range: 8, see: 0.6, on: true, outdoor: true }; W.lights.push(L); }
    for (const [x, z] of [[-60, 60], [-30, 64], [-52, 88], [-18, 70], [-66, 82], [-36, 96]]) K.tree(x, z);
    town.mission.cemeteryGate = new V(cx0 - 2, 0, 76); town.mission.judith = judith.position.clone();
    town.mission.wagon = new V(-86.6, 0, 70); town.mission.cemeteryStart = new V(-86, 0, 54);
    town.mission.keeperRoute = [new V(-66, 0, 76), new V(-22, 0, 76), new V(-22, 0, 60), new V(-60, 0, 60), new V(-60, 0, 94), new V(-44, 0, 88), new V(-30, 0, 76)];
    town.cars.push({ x: -86.6, z: 70, yaw: 0, color: 0x6a5a48, owner: 'wagon' });
  }
  // patrol loop on Main Street for the first chapter
  town.mission.patrol = [new V(-75, 0, -126.5), new V(-10, 0, -126.5), new V(-10, 0, -113.5), new V(-75, 0, -113.5), new V(-40, 0, -126.5), new V(-30, 0, -131), new V(-36, 0, -126.5)];
  town.mission.mainStart = new V(-84, 0, -140);
}
