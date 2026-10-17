// HALLOWEENVR level: one block of Lampkin Lane, Haddonfield, Illinois,
// October 31 1978. Two rows of houses face each other across the street:
// the abandoned Myers house, the Wallace and Doyle houses opposite one
// another, Mrs. Elrod next door, and dark neighbours filling out the block.
// Lived-in houses have full two-storey interiors with doors, stairs and
// furniture; the rest are solid shells.
import * as THREE from '../vendor/three.module.js';
import { Builder, place } from './geo.js?v=3';
import { T, rnd, srand } from './tex.js?v=3';

const V = THREE.Vector3;
const G = 0.3, U = 3.3, TOP = 6.0;          // ground floor, upstairs floor, ceiling
export const HOUSE_W = 10, HOUSE_D = 12;

export function buildTown(scene, W, opts = {}) {
  srand(1978);
  const B = new Builder();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  B.material('grass', std({ map: T.grass.map, normalMap: T.grass.normalMap, roughness: 1 }), { tile: 3, shadow: false });
  B.material('asphalt', std({ map: T.asphalt.map, normalMap: T.asphalt.normalMap, roughnessMap: T.asphalt.roughnessMap }), { tile: 4, shadow: false });
  B.material('concrete', std({ map: T.concrete.map, normalMap: T.concrete.normalMap }), { tile: 1.5, shadow: false });
  B.material('siding', std({ map: T.siding.map, normalMap: T.siding.normalMap, roughness: 0.8 }), { tile: 2 });
  B.material('shingle', std({ map: T.shingle.map, normalMap: T.shingle.normalMap, roughness: 0.95 }), { tile: 2 });
  B.material('brick', std({ map: T.brick.map, normalMap: T.brick.normalMap }), { tile: 1.6 });
  B.material('trim', std({ roughness: 0.55, color: 0xffffff }), { tile: 1 });
  B.material('paper', std({ map: T.paper.map, normalMap: T.paper.normalMap, roughness: 0.9 }), { tile: 1.2 });
  B.material('plaster', std({ map: T.plaster.map, normalMap: T.plaster.normalMap }), { tile: 2 });
  B.material('wood', std({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.5 }), { tile: 2 });
  B.material('carpet', std({ map: T.carpet.map, normalMap: T.carpet.normalMap, roughness: 1 }), { tile: 1 });
  B.material('tile', std({ map: T.tile.map, normalMap: T.tile.normalMap, roughness: 0.4 }), { tile: 1.2 });
  B.material('dark', std({ map: T.darkwood.map, normalMap: T.darkwood.normalMap, roughness: 0.55 }), { tile: 1 });
  B.material('fabric', std({ map: T.cloth.map, normalMap: T.cloth.normalMap, roughness: 1 }), { tile: 0.4 });
  B.material('metal', std({ map: T.metal.map, roughness: 0.4, metalness: 0.8 }), { tile: 1 });
  B.material('paint', std({ roughness: 0.32, metalness: 0.35 }), { tile: 1 });
  B.material('bark', std({ map: T.bark.map, normalMap: T.bark.normalMap }), { tile: 1 });
  B.material('hedge', std({ map: T.hedge.map, normalMap: T.hedge.normalMap, roughness: 0.9 }), { tile: 1.5 });
  B.material('black', std({ color: 0x0a0a0a, roughness: 0.9 }), { tile: 1 });
  B.material('glow', new THREE.MeshBasicMaterial({ color: 0xffffff }), { tile: 1, shadow: false, receive: false });
  B.material('glass', new THREE.MeshStandardMaterial({ color: 0x9aa8b0, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.22, depthWrite: false }), { tile: 1, shadow: false, receive: false });
  B.material('lit', new THREE.MeshBasicMaterial({ color: 0xffffff }), { tile: 1, shadow: false, receive: false });

  const I = new THREE.Matrix4();
  const town = { root: scene, houses: {}, doors: [], nav: { nodes: [], edges: [] }, spots: {}, tvs: [], flicker: [], cars: [], phones: [], pumpkins: [] };
  const nodeId = (n) => { n.id = town.nav.nodes.length; town.nav.nodes.push(n); return n; };
  const edge = (a, b) => town.nav.edges.push([a.id, b.id]);
  const light = (o) => { const e = { on: true, flicker: 0, see: 0.6, range: 7, intensity: 6, color: 0xffd8a8, outdoor: false, ...o }; W.lights.push(e); return e; };

  // --------------------------------------------------------- ground & street
  const X0 = -78, X1 = 78, Z0 = -46, Z1 = 46;
  B.quad('grass', I, [X0, 0, Z1], [X1, 0, Z1], [X1, 0, Z0], [X0, 0, Z0]);
  B.quad('asphalt', I, [X0, 0.012, 4], [X1, 0.012, 4], [X1, 0.012, -4], [X0, 0.012, -4]);
  for (const sg of [-1, 1]) {
    B.box({ def: 'concrete' }, I, X0, 0, sg > 0 ? 4 : -4.18, X1, 0.12, sg > 0 ? 4.18 : -4, 0xbbbbbb);       // curb
    B.quad('concrete', I, ...(sg > 0 ? [[X0, 0.03, 7.6], [X1, 0.03, 7.6], [X1, 0.03, 6.1], [X0, 0.03, 6.1]] : [[X0, 0.03, -6.1], [X1, 0.03, -6.1], [X1, 0.03, -7.6], [X0, 0.03, -7.6]]));
  }
  // painted centre line, faded
  for (let x = X0; x < X1; x += 6) B.quad('trim', I, [x, 0.016, 0.06], [x + 3, 0.016, 0.06], [x + 3, 0.016, -0.06], [x, 0.016, -0.06], 0x8a8060);
  // the block ends in dark woods: invisible walls so Michael stays on the block
  W.addWall(X0 + 4, Z0 + 2, X0 + 4, Z1 - 2, -1, 5, { low: true }); W.addWall(X1 - 4, Z0 + 2, X1 - 4, Z1 - 2, -1, 5, { low: true });
  W.addWall(X0 + 4, Z0 + 4, X1 - 4, Z0 + 4, -1, 5, { low: true }); W.addWall(X0 + 4, Z1 - 4, X1 - 4, Z1 - 4, -1, 5, { low: true });
  town.bounds = { x0: X0 + 4, x1: X1 - 4, z0: Z0 + 4, z1: Z1 - 4 };
  town.escapes = [new V(X0 + 6, 0, 0), new V(X1 - 6, 0, 0)];

  // ------------------------------------------------------------- houses
  // lots: north side faces +z (rotated 180), south faces -z
  const LOTS = [
    { name: 'shellNW', x: -50, side: 'n', shell: true, color: 0x8d9a8c, lit: 0.4 },
    { name: 'myers', x: -24, side: 'n', color: 0xb8b2a0, trim: 0x9a9384, boarded: true, label: 'The Myers house' },
    { name: 'shellN', x: 0, side: 'n', shell: true, color: 0xc9b98a, lit: 0.6 },
    { name: 'wallace', x: 24, side: 'n', color: 0xd8d2c0, trim: 0x6a4a32, label: 'The Wallace house', paper: 0xd9c9a0 },
    { name: 'shellNE', x: 50, side: 'n', shell: true, color: 0x9a8070, lit: 0.2 },
    { name: 'shellSW', x: -50, side: 's', shell: true, color: 0xb0a890, lit: 0.3 },
    { name: 'elrod', x: -24, side: 's', color: 0x8ea0b0, trim: 0xf0f0f0, label: "Mrs. Elrod's", paper: 0xc8d0c0 },
    { name: 'shellS', x: 0, side: 's', shell: true, color: 0xd0c4b0, lit: 0.5 },
    { name: 'doyle', x: 24, side: 's', color: 0xe6e0d0, trim: 0x3e5a3a, label: 'The Doyle house', paper: 0xe0d0b0 },
    { name: 'shellSE', x: 50, side: 's', shell: true, color: 0x7a8a7a, lit: 0.0 },
  ];
  for (const L of LOTS) {
    const zf = L.side === 'n' ? -14 : 14, rot = L.side === 'n' ? Math.PI : 0;
    const m = place(L.x, 0, zf, rot);
    const H = { ...L, m, rot, zf, rooms: {}, doors: {}, nodes: {}, lights: {}, front: L.side === 'n' ? 1 : -1 };
    town.houses[L.name] = H;
    // local->world helpers
    H.w = (x, y, z) => new V(x, y, z).applyMatrix4(m);
    H.wbox = (x0, y0, z0, x1, y1, z1) => { const a = H.w(x0, y0, z0), b = H.w(x1, y1, z1); return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)]; };
    if (L.shell) shellHouse(B, W, H, town, light); else fullHouse(B, W, H, town, light, nodeId, edge);
    yard(B, W, H, town, light);
  }

  // ---------------------------------------------------------- streetlights
  for (const [x, sg] of [[-62, -1], [-36, 1], [-12, -1], [12, 1], [36, -1], [62, 1]]) {
    const z = sg * 4.9;
    B.box('metal', I, x - 0.08, 0, z - 0.08, x + 0.08, 6.6, z + 0.08, 0x3a3a38);
    B.box('metal', I, x - 0.05, 6.45, sg > 0 ? z - 2.2 : z, x + 0.05, 6.55, sg > 0 ? z : z + 2.2, 0x3a3a38);
    const lz = z - sg * 2.2;
    B.box('metal', I, x - 0.22, 6.3, lz - 0.32, x + 0.22, 6.5, lz + 0.32, 0x2a2a28);
    B.box('glow', I, x - 0.18, 6.27, lz - 0.28, x + 0.18, 6.3, lz + 0.28, 0xffe3b0);
    W.addWall(x - 0.1, z, x + 0.1, z, 0, 6, { thick: 0.16, low: true });
    light({ x, y: 6.1, z: lz, color: 0xffc98a, intensity: 120, range: 22, see: 0.75, outdoor: true, spot: true });
  }
  // street signs at the corner: LAMPKIN LN / ORANGE GROVE
  town.sign = { x: -70, z: 6.5 };

  // ---------------------------------------------------------- trees
  const treeSpots = [];
  for (const L of LOTS) { const sgn = L.side === 'n' ? -1 : 1; treeSpots.push([L.x - 7.5 + rnd() * 2, sgn * (9 + rnd() * 2)], [L.x + 6 + rnd() * 2, sgn * (31 + rnd() * 3)]); if (rnd() > 0.4) treeSpots.push([L.x + 9.5, sgn * 5.2]); }
  const leafCards = [];
  for (const [x, z] of treeSpots) tree(B, W, x, z, leafCards);
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaves.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const crown = new THREE.InstancedMesh(leafGeo, leafMat, leafCards.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V(), uvOff = new Float32Array(leafCards.length * 2);
  leafCards.forEach((c, i) => { q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6)); sc.setScalar(c.s); mm.compose(c.p, q, sc); crown.setMatrixAt(i, mm); });
  crown.castShadow = true; crown.receiveShadow = true; scene.add(crown);
  // fallen leaves across the lawns and gutters
  const N = opts.low ? 1800 : 3600;
  const fallen = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.leaves.map, alphaTest: 0.5, roughness: 0.9 }), N);
  let k = 0;
  while (k < N) {
    const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0);
    if (W.zoneAt(x, 0.5, z)) continue;
    const gutter = Math.abs(Math.abs(z) - 3.8) < 0.4;
    if (Math.abs(z) < 4 && !gutter && rnd() > 0.15) continue;
    mm.compose(new V(x, 0.03 + rnd() * 0.01, z), q.setFromEuler(e.set(rnd() * 0.3, rnd() * 6.28, rnd() * 0.3)), sc.setScalar(0.7 + rnd() * 0.8));
    fallen.setMatrixAt(k++, mm);
  }
  fallen.receiveShadow = true; scene.add(fallen);

  const meshes = B.build(scene);
  town.meshes = meshes;
  return town;
}

// ------------------------------------------------------------------ helpers
function wallRun(B, W, H, axis, c, a0, a1, y0, y1, t, openings, mats, colors) {
  // openings: {a,b,lo,hi,kind}
  const ops = openings.slice().sort((p, q) => p.a - q.a);
  const pieces = [];
  let cur = a0;
  for (const o of ops) { if (o.a > cur) pieces.push([cur, o.a, 0, y1 - y0]); if (o.lo > 0) pieces.push([o.a, o.b, 0, o.lo, true]); if (o.hi < y1 - y0) pieces.push([o.a, o.b, o.hi, y1 - y0]); cur = o.b; }
  if (cur < a1) pieces.push([cur, a1, 0, y1 - y0]);
  for (const [a, b, lo, hi] of pieces) {
    if (axis === 'x') B.box(mats, H.m, a, y0 + lo, c - t / 2, b, y0 + hi, c + t / 2, colors);
    else B.box(mats, H.m, c - t / 2, y0 + lo, a, c + t / 2, y0 + hi, b, colors);
    const p = axis === 'x' ? [H.w(a, 0, c), H.w(b, 0, c)] : [H.w(c, 0, a), H.w(c, 0, b)];
    W.addWall(p[0].x, p[0].z, p[1].x, p[1].z, y0 + lo, y0 + hi, { thick: t, low: hi - lo < 1.2 && lo === 0 });
  }
  for (const o of ops) {
    if (o.kind !== 'window') continue;
    const p = axis === 'x' ? [H.w(o.a, 0, c), H.w(o.b, 0, c)] : [H.w(c, 0, o.a), H.w(c, 0, o.b)];
    W.addWall(p[0].x, p[0].z, p[1].x, p[1].z, y0 + o.lo, y0 + o.hi, { thick: 0.05, see: true });
    // frame, sill, mullions, glass
    const f = 0.06, tc = 0xf2efe6;
    const bx = (x0, yy0, x1, yy1, d0, d1, m = 'trim', col = tc) => axis === 'x' ? B.box(m, H.m, x0, yy0, c + d0, x1, yy1, c + d1, col) : B.box(m, H.m, c + d0, yy0, x0, c + d1, yy1, x1, col);
    const Y0 = y0 + o.lo, Y1 = y0 + o.hi;
    bx(o.a - f, Y0 - f, o.b + f, Y0, -t / 2 - 0.04, t / 2 + 0.04);
    bx(o.a - f, Y1, o.b + f, Y1 + f, -t / 2 - 0.02, t / 2 + 0.02);
    bx(o.a - f, Y0, o.a, Y1, -t / 2 - 0.02, t / 2 + 0.02); bx(o.b, Y0, o.b + f, Y1, -t / 2 - 0.02, t / 2 + 0.02);
    if (o.boarded) {
      for (let i = 0; i < 4; i++) { const yy = Y0 + 0.15 + i * (Y1 - Y0 - 0.3) / 3; const tilt = (rnd() - 0.5) * 0.1; bx(o.a - 0.1, yy - 0.08 + tilt, o.b + 0.1, yy + 0.08 - tilt, -t / 2 - 0.08, -t / 2 - 0.05, 'dark', 0x9a8a78); }
      bx(o.a, Y0, o.b, Y1, -0.01, 0.01, 'black', 0x050505);
      continue;
    }
    const mid = (Y0 + Y1) / 2; bx(o.a, mid - 0.02, o.b, mid + 0.02, -0.03, 0.03);
    bx((o.a + o.b) / 2 - 0.02, Y0, (o.a + o.b) / 2 + 0.02, Y1, -0.03, 0.03);
    bx(o.a, Y0, o.b, Y1, -0.005, 0.005, 'glass', 0xffffff);
  }
}

function makeDoor(scene, W, H, axis, c, a, b, y0, openSide, o = {}) {
  // hinge at (a, c) in local; leaf runs toward b; openSide: +1/-1 along the wall normal (local z for axis x, local x for axis z)
  const hingeL = axis === 'x' ? H.w(a, 0, c) : H.w(c, 0, a), tipL = axis === 'x' ? H.w(b, 0, c) : H.w(c, 0, b);
  const cx = tipL.x - hingeL.x, cz = tipL.z - hingeL.z, w = Math.hypot(cx, cz);
  const nrm = axis === 'x' ? H.w(a, 0, c + openSide).sub(hingeL) : H.w(c + openSide, 0, a).sub(hingeL);
  const perp = new V(-cz / w, 0, cx / w), swing = perp.dot(nrm) > 0 ? 1 : -1;
  const kind = o.kind || 'door';
  const d = W.addDoor({ hx: hingeL.x, hz: hingeL.z, cx: cx / w, cz: cz / w, w, y0, y1: y0 + 2.1, swing, house: H.name, kind, locked: !!o.locked, max: o.max || 1.75 });
  d.baseRot = Math.atan2(-cz / w, cx / w);
  // leaf mesh: panelled door with knob, or slatted closet door
  const g = new THREE.Group(); g.position.set(hingeL.x, y0, hingeL.z); g.rotation.y = d.baseRot;
  const leafMat = new THREE.MeshStandardMaterial({ map: T.darkwood.map, normalMap: T.darkwood.normalMap, color: o.color || (kind === 'closet' ? 0xe8e2d4 : 0xb08060), roughness: 0.55 });
  const leaf = new THREE.Group();
  if (kind === 'closet') {
    for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.035, 0.012), leafMat); s.position.set(w / 2, 0.1 + i * 0.075, 0); s.rotation.x = 0.6; leaf.add(s); }
    for (const x of [0.03, w - 0.03]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.06, 0.035), leafMat); s.position.set(x, 1.03, 0); leaf.add(s); }
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, 2.06, 0.045), leafMat); slab.position.set(w / 2, 1.03, 0); slab.castShadow = true; slab.receiveShadow = true; leaf.add(slab);
    for (const [px, py, sx, sy] of [[0.25, 1.55, 0.3, 0.7], [0.66, 1.55, 0.3, 0.7], [0.25, 0.55, 0.3, 0.8], [0.66, 0.55, 0.3, 0.8]]) for (const zz of [-0.025, 0.025]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sx * w / 0.9, sy, 0.01), leafMat); p.position.set(px * w / 0.9, py, zz); leaf.add(p); }
    const knobM = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.25 });
    for (const zz of [-0.05, 0.05]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), knobM); k.position.set(w - 0.08, 0.95, zz); leaf.add(k); }
    if (o.window) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x302820 })); gl.position.set(w / 2, 1.7, 0.026); leaf.add(gl); }
  }
  g.add(leaf); scene.add(g); d.pivot = g; d.leaf = leaf; d.update(0);
  return d;
}

// ------------------------------------------------------------ full house
function fullHouse(B, W, H, town, light, nodeId, edge) {
  const scene = town.scene || (town.scene = null);
  const sid = H.color, paperCol = H.paper || 0xd6ccb0, trim = H.trim || 0xf0f0f0;
  const ext = { def: 'trim', nz: 'siding', pz: 'paper' }; // for walls along x at z=0 the outside is -z
  const t = 0.15, ti = 0.1;
  const winG = (a, b) => ({ a, b, lo: 0.9, hi: 2.2, kind: 'window', boarded: H.boarded });
  const door = (a, b) => ({ a, b, lo: 0, hi: 2.12, kind: 'door' });
  const arch = (a, b) => ({ a, b, lo: 0, hi: 2.3, kind: 'arch' });
  const cols = (out, inn) => ({ def: trim, nz: out, pz: inn, nx: out, px: inn });
  // exterior walls, ground then upper
  for (const [y0, y1, front, back, left, right] of [
    [G, U, [winG(-3.8, -1.2), door(1, 2)], [winG(-3.5, -1.5), winG(0.6, 2.0), door(2.5, 3.4)], [winG(2, 4), winG(8.5, 10)], [winG(8.5, 10.5)]],
    [U, TOP, [winG(-3.5, -1.5), winG(0.8, 2.6)], [winG(-3.5, -1.5), winG(1.5, 3.5)], [winG(2, 4), { a: 6.6, b: 7.4, lo: 1.4, hi: 2.2, kind: 'window', boarded: H.boarded }, winG(9, 11)], [winG(9, 11)]],
  ]) {
    wallRun(B, W, H, 'x', 0, -5, 5, y0, y1, t, front, { def: 'trim', nz: 'siding', pz: 'paper' }, { def: trim, nz: sid, pz: paperCol });
    wallRun(B, W, H, 'x', 12, -5, 5, y0, y1, t, back, { def: 'trim', pz: 'siding', nz: 'paper' }, { def: trim, pz: sid, nz: paperCol });
    wallRun(B, W, H, 'z', -5, -t / 2, 12 + t / 2, y0, y1, t, left, { def: 'trim', nx: 'siding', px: 'paper' }, { def: trim, nx: sid, px: paperCol });
    wallRun(B, W, H, 'z', 5, -t / 2, 12 + t / 2, y0, y1, t, right, { def: 'trim', px: 'siding', nx: 'paper' }, { def: trim, px: sid, nx: paperCol });
  }
  // foundation, floors, ceilings
  B.box('brick', H.m, -5.1, 0, -0.1, 5.1, G, 12.1, 0x8a7a70);
  W.addFloor(...flat(H.wbox(-5, 0, 0, 5, 0, 12)), G);
  const floorMat = (x0, z0, x1, z1, y, mat, c = 0xffffff) => B.quad(mat, H.m, [x0, y + 0.002, z1], [x1, y + 0.002, z1], [x1, y + 0.002, z0], [x0, y + 0.002, z0], c);
  floorMat(-5, 0, 0, 7, G, 'carpet', H.boarded ? 0x4a4038 : 0x8a6a3a); floorMat(0, 0, 5, 7, G, 'wood'); floorMat(0, 7, 5, 12, G, 'tile'); floorMat(-5, 7, 0, 12, G, 'wood');
  // upstairs slab with the stair hole (x 3.6..5, z 2..6.5)
  for (const [x0, z0, x1, z1] of [[-5, 0, 3.6, 12], [3.6, 0, 5, 2], [3.6, 6.5, 5, 12]]) {
    B.box({ def: 'plaster', py: 'wood' }, H.m, x0, U - 0.3, z0, x1, U, z1, { def: 0xe8e4dc, py: 0xffffff });
    W.addFloor(...flat(H.wbox(x0, 0, z0, x1, 0, z1)), U);
  }
  floorMat(-5, 0, 0, 6, U, 'carpet', H.boarded ? 0x3e3a34 : 0x6a7a8a); floorMat(-5, 8, 5, 12, U, 'carpet', H.boarded ? 0x3e3a34 : 0x7a5a5a); floorMat(0, 0, 3.6, 4, U, 'carpet', 0x8a8a70);
  B.box({ def: 'plaster' }, H.m, -5, TOP, 0, 5, TOP + 0.15, 12, 0xe8e4dc);
  // stairs: visible steps, a ramp for walking
  const r0 = H.w(4.3, 0, 2), r1 = H.w(4.3, 0, 6.5);
  W.addRamp(...flat2(H.wbox(3.6, 0, 2, 5, 0, 6.5)), 'z', r0.z, r1.z, G, U);
  for (let i = 0; i < 15; i++) { const z = 2 + i * 0.3; B.box({ def: 'wood', nx: 'trim', px: 'trim' }, H.m, 3.62, G, z, 4.98, G + (i + 1) * 0.2, z + 0.3, { def: 0xffffff, nx: 0xe8e4dc, px: 0xe8e4dc }); }
  // interior walls
  const iw = (axis, c, a0, a1, y0, y1, ops = []) => wallRun(B, W, H, axis, c, a0, a1, y0, y1, ti, ops, 'paper', paperCol);
  iw('z', 0, 0, 7, G, U, [arch(2, 5)]); iw('x', 7, -5, 0, G, U, [arch(-3.5, -1.5)]); iw('x', 7, 0, 5, G, U, [door(1, 1.9)]);
  iw('z', 0, 7, 12, G, U, [arch(8.5, 10)]); iw('z', 3.6, 3, 6.5, G, U);
  iw('z', 0, 0, 6, U, TOP, [door(4.5, 5.4)]); iw('x', 6, -5, 0, U, TOP); iw('z', 0, 6, 8, U, TOP, [door(6.6, 7.4)]);
  iw('x', 8, -5, 5, U, TOP, [door(1.5, 2.4)]); iw('x', 4, 0, 3.6, U, TOP, [door(1, 1.9)]); iw('z', 3.6, 0, 2, U, TOP, [door(0.4, 1.4)]);
  iw('z', 3.6, 2, 4, U, TOP); iw('x', 2, 3.6, 5, U, TOP);
  // railing along the stair hole
  B.box('dark', H.m, 3.57, U, 4, 3.63, U + 0.95, 6.5, 0x6a4a30);
  for (let z = 4; z < 6.5; z += 0.25) B.box('dark', H.m, 3.58, U, z, 3.62, U + 0.95, z + 0.03, 0x6a4a30);
  { const a = H.w(3.6, 0, 4), b = H.w(3.6, 0, 6.5); W.addWall(a.x, a.z, b.x, b.z, U, U + 1, { thick: 0.08, low: true }); }
  // doors
  const sc = { add: (o) => town.root.add(o) };
  const D = H.doors;
  D.front = makeDoor(sc, W, H, 'x', 0, 1, 2, G, 1, { locked: H.name === 'elrod', window: true, color: H.trim });
  D.back = makeDoor(sc, W, H, 'x', 12, 3.4, 2.5, G, -1, { color: 0xd8d0c0 });
  D.kitchen = makeDoor(sc, W, H, 'x', 7, 1, 1.9, G, 1);
  D.bed1 = makeDoor(sc, W, H, 'z', 0, 4.5, 5.4, U, -1);
  D.bath = makeDoor(sc, W, H, 'z', 0, 7.4, 6.6, U, -1);
  D.bed3 = makeDoor(sc, W, H, 'x', 8, 2.4, 1.5, U, 1);
  D.bed2 = makeDoor(sc, W, H, 'x', 4, 1.9, 1, U, -1);
  D.closet = makeDoor(sc, W, H, 'z', 3.6, 1.4, 0.4, U, -1, { kind: 'closet', max: 1.5 });
  for (const k in D) town.doors.push(D[k]);
  if (H.boarded) { D.front.angle = 0; D.back.angle = 0.25; D.back.target = 0.25; }
  // rooms, zones, lights
  const R = H.rooms;
  const room = (name, x0, z0, x1, z1, fy, lx, lz, on, col = 0xffd2a0) => {
    const [a, , c, b, , d] = H.wbox(x0, 0, z0, x1, 0, z1);
    const zone = { x0: a, z0: c, x1: b, z1: d, y0: fy, y1: fy + 2.9, indoor: true, house: H.name, room: name };
    W.addZone(zone); R[name] = zone;
    const p = H.w(lx, fy + 2.35, lz);
    const L = { x: p.x, y: p.y, z: p.z, color: col, intensity: 9, range: 7.5, see: 0.85, on: on && !H.boarded, zone };
    W.lights.push(L); H.lights[name] = L; zone.light = L;
    // fixture
    B.box('glow', H.m, lx - 0.18, fy + 2.62, lz - 0.18, lx + 0.18, fy + 2.68, lz + 0.18, on && !H.boarded ? 0xfff0d0 : 0x555048);
    return zone;
  };
  const lit = H.lit || {};
  room('living', -5, 0, 0, 7, G, -2.5, 3.5, lit.living ?? true); room('hall', 0, 0, 5, 7, G, 1.8, 3, lit.hall ?? true);
  room('kitchen', 0, 7, 5, 12, G, 2.5, 9.5, lit.kitchen ?? true); room('dining', -5, 7, 0, 12, G, -2.5, 9.5, lit.dining ?? false);
  room('bed1', -5, 0, 0, 6, U, -2.5, 3, lit.bed1 ?? false); room('bed2', 0, 0, 3.6, 4, U, 1.8, 2, false); room('closet', 3.6, 0, 5, 2, U, 4.3, 1, false);
  room('hallU', 0, 4, 3.6, 8, U, 1.8, 6, lit.hallU ?? false); room('bath', -5, 6, 0, 8, U, -2.5, 7, false); room('bed3', -5, 8, 5, 12, U, 0, 10, lit.bed3 ?? false);
  room('stairs', 3.6, 2, 5, 6.5, G, 4.3, 4, false);
  R.stairs.y1 = U + 2.9;
  // porch
  B.box({ def: 'wood', ny: 'trim' }, H.m, -1.2, 0, -2.6, 3.8, G, 0, 0x8a7a68);
  W.addFloor(...flat(H.wbox(-1.2, 0, -2.6, 3.8, 0, 0)), G);
  B.box('concrete', H.m, 0.6, 0, -3.2, 2.4, 0.15, -2.6, 0xaaaaaa);
  W.addRamp(...flat2(H.wbox(0.6, 0, -3.3, 2.4, 0, -2.6)), 'z', H.w(0, 0, -3.3).z, H.w(0, 0, -2.6).z, 0, G);
  B.box('trim', H.m, -1.2, 2.85, -2.7, 3.8, 3.0, 0, trim);
  for (const x of [-1.1, 3.7]) { B.box('trim', H.m, x - 0.07, G, -2.6, x + 0.07, 2.85, -2.46, 0xf2efe6); const p = H.w(x, 0, -2.53); W.addWall(p.x - 0.07, p.z, p.x + 0.07, p.z, 0, 3, { thick: 0.14 }); }
  B.quad('shingle', H.m, [-1.4, 3.35, 0], [4.0, 3.35, 0], [4.0, 3.0, -2.9], [-1.4, 3.0, -2.9], 0x6a6560);
  { const p = H.w(1.5, G + 2.3, -0.3); const pl = { x: p.x, y: p.y, z: p.z, color: 0xffd9a0, intensity: 5, range: 7, see: 0.6, on: !H.boarded && H.porch !== false, outdoor: true }; W.lights.push(pl); H.lights.porch = pl;
    B.box('glow', H.m, 2.25, G + 2.2, -0.12, 2.4, G + 2.42, -0.02, pl.on ? 0xffe8c0 : 0x333030); }
  // roof
  roof(B, W, H, sid, trim);
  // furniture
  furnish(B, W, H, town, light);
  // navigation graph for this house
  const N = H.nodes, n = (name, x, z, fy, extra = {}) => { const p = H.w(x, 0, z); return (N[name] = nodeId({ x: p.x, y: fy, z: p.z, house: H.name, room: extra.room ?? name, name, ...extra })); };
  n('porch', 1.5, -3.8, 0, { room: null, outside: true }); n('frontDoor', 1.5, 0, G, { door: D.front }); n('hallF', 1.8, 3.4, G, { room: 'hall' });
  n('living', -2.5, 3.5, G); n('livingArch', 0, 3.5, G, { room: 'hall' }); n('diningArch', -2.5, 7, G, { room: 'dining' }); n('dining', -2.5, 9.6, G);
  n('kitchenDoor', 1.45, 7, G, { door: D.kitchen, room: 'kitchen' }); n('kitchen', 2.5, 9.5, G); n('kitchenArch', 0, 9.25, G, { room: 'kitchen' });
  n('backDoor', 2.95, 12, G, { door: D.back, room: 'kitchen' }); n('back', 2.95, 13.6, 0, { room: null, outside: true });
  n('stairB', 4.3, 1.3, G, { room: 'hall' }); n('stairT', 4.3, 7.2, U, { room: 'hallU' }); n('hallU', 1.8, 6.2, U);
  n('bed1Door', 0, 4.95, U, { door: D.bed1, room: 'bed1' }); n('bed1', -2.5, 3, U); n('bathDoor', 0, 7, U, { door: D.bath, room: 'bath' }); n('bath', -2.2, 7, U);
  n('bed3Door', 1.95, 8, U, { door: D.bed3, room: 'bed3' }); n('bed3', 0.5, 9.4, U); n('bed2Door', 1.45, 4, U, { door: D.bed2, room: 'bed2' }); n('bed2', 2, 2.4, U);
  n('closetDoor', 3.6, 0.9, U, { door: D.closet, room: 'closet' }); n('closet', 4.35, 0.9, U, { hide: true });
  for (const [a, b] of [['porch', 'frontDoor'], ['frontDoor', 'hallF'], ['hallF', 'livingArch'], ['livingArch', 'living'], ['living', 'diningArch'], ['diningArch', 'dining'],
    ['hallF', 'kitchenDoor'], ['kitchenDoor', 'kitchen'], ['dining', 'kitchenArch'], ['kitchenArch', 'kitchen'], ['kitchen', 'backDoor'], ['backDoor', 'back'],
    ['hallF', 'stairB'], ['stairB', 'stairT'], ['stairT', 'hallU'], ['hallU', 'bed1Door'], ['bed1Door', 'bed1'], ['hallU', 'bathDoor'], ['bathDoor', 'bath'],
    ['hallU', 'bed3Door'], ['bed3Door', 'bed3'], ['hallU', 'bed2Door'], ['bed2Door', 'bed2'], ['bed2', 'closetDoor'], ['closetDoor', 'closet']]) edge(N[a], N[b]);
}
const flat = (b) => [b[0], b[2], b[3], b[5]];
const flat2 = (b) => [b[0], b[2], b[3], b[5]];

function roof(B, W, H, sid, trim) {
  const e = 0.55, y0 = TOP + 0.15, yr = 8.7;
  B.quad('trim', H.m, [-5 - e, y0 - 0.25, -e], [5 + e, y0 - 0.25, -e], [5 + e, yr, 6], [-5 - e, yr, 6], 0x2a2420);
  B.quad('trim', H.m, [5 + e, y0 - 0.25, 12 + e], [-5 - e, y0 - 0.25, 12 + e], [-5 - e, yr, 6], [5 + e, yr, 6], 0x2a2420);
  B.quad('shingle', H.m, [-5 - e, yr, 6], [5 + e, yr, 6], [5 + e, y0 - 0.25, -e], [-5 - e, y0 - 0.25, -e], 0x77706a);
  B.quad('shingle', H.m, [-5 - e, y0 - 0.25, 12 + e], [5 + e, y0 - 0.25, 12 + e], [5 + e, yr, 6], [-5 - e, yr, 6], 0x77706a);
  for (const x of [-5, 5]) {
    const s = x < 0 ? -1 : 1;
    if (s < 0) B.tri('siding', H.m, [x - 0.08, TOP, 0], [x - 0.08, TOP, 12], [x - 0.08, yr - 0.1, 6], sid);
    else B.tri('siding', H.m, [x + 0.08, TOP, 12], [x + 0.08, TOP, 0], [x + 0.08, yr - 0.1, 6], sid);
  }
  B.box('brick', H.m, -5.7, 0, 5.2, -5.05, 9.6, 6.6, 0x9a7a6a);
  B.box('trim', H.m, -5.2, TOP - 0.3, -0.2, 5.2, TOP + 0.15, 12.2, { def: trim, py: 0x2a2420 }, 'py');
  B.box('trim', H.m, -5.15, G, -0.12, -4.95, TOP, 0.05, trim); B.box('trim', H.m, 4.95, G, -0.12, 5.15, TOP, 0.05, trim);
}

function furnish(B, W, H, town, light) {
  const box = (mat, x0, y0, z0, x1, y1, z1, col, solid = true) => { B.box(mat, H.m, x0, y0, z0, x1, y1, z1, col); if (solid) W.addBox(...H.wbox(x0, y0, z0, x1, y1, z1)); };
  const old = H.boarded;
  const sofa = old ? 0x3a342a : (H.name === 'doyle' ? 0x6a5a3a : 0x5a3a2a);
  const S = town.spots[H.name] = {};
  const at = (x, y, z, yaw = 0) => { const p = H.w(x, y, z); return { x: p.x, y: p.y, z: p.z, yaw: yaw + H.rot }; };
  // living: couch facing the TV on the front wall
  if (!old || true) {
    box('fabric', -4.2, G, 4.6, -1.4, G + 0.45, 5.45, sofa); box('fabric', -4.2, G + 0.45, 5.2, -1.4, G + 0.9, 5.5, sofa);
    box('fabric', -4.45, G, 4.6, -4.2, G + 0.65, 5.5, sofa); box('fabric', -1.4, G, 4.6, -1.15, G + 0.65, 5.5, sofa);
    box('dark', -3.4, G, 2.8, -2.2, G + 0.42, 3.7, 0x8a6a4a);
    box('dark', -3.3, G, 0.12, -2.1, G + 0.75, 0.62, 0x5a3a22);
    B.box('black', H.m, -3.2, G + 0.75, 0.15, -2.2, G + 1.35, 0.6, 0x111111);
    S.couch = at(-2.8, G, 4.9, Math.PI); S.tvFront = at(-2.7, G, 2.2, Math.PI);
    if (!old) {
      const sp = H.w(-2.7, G + 1.05, 0.61);
      const tvLight = { x: sp.x, y: sp.y, z: sp.z, color: 0x9fb6ff, intensity: 3, range: 6, see: 0.4, on: true, flicker: 1, zone: H.rooms.living, tv: true };
      W.lights.push(tvLight); town.tvs.push({ light: tvLight, house: H.name, m: H.m, pos: sp });
    }
    box('dark', -4.8, G, 0.2, -4.3, G + 0.6, 0.7, 0x6a4a2a); // end table + lamp
    B.box('trim', H.m, -4.62, G + 0.6, 0.38, -4.48, G + 1.1, 0.52, 0xd0c0a0); B.box('glow', H.m, -4.75, G + 1.1, 0.25, -4.35, G + 1.35, 0.65, old ? 0x403830 : 0xffe0b0);
  }
  // hall: phone table at the foot of the stairs
  box('dark', 0.15, G, 0.4, 0.6, G + 0.8, 1.3, 0x5a3a22);
  B.box('black', H.m, 0.25, G + 0.8, 0.7, 0.5, G + 0.9, 1.0, old ? 0x222222 : 0x2a2222);
  S.phone = at(0.9, G, 0.85, -Math.PI / 2); S.phonePos = H.w(0.37, G + 0.86, 0.85);
  if (!old) town.phones.push({ house: H.name, pos: S.phonePos, spot: S.phone });
  // kitchen: counters, sink, fridge, table
  box('trim', 4.35, G, 7.15, 4.95, G + 0.9, 11.85, 0xe8dcc0); B.box('trim', H.m, 4.3, G + 0.9, 7.1, 4.97, G + 0.94, 11.9, 0xb89a6a);
  box('trim', 0.55, G, 11.25, 4.35, G + 0.9, 11.85, 0xe8dcc0); B.box('trim', H.m, 0.5, G + 0.9, 11.2, 4.35, G + 0.94, 11.9, 0xb89a6a);
  box('paint', 0.1, G, 11.1, 0.5, G + 1.75, 11.88, old ? 0x8a8678 : 0xd8c890);
  box('dark', 1.9, G, 9.0, 3.1, G + 0.75, 10.0, 0x8a6a4a);
  for (const [x, z] of [[1.6, 9.5], [3.4, 9.5]]) box('dark', x - 0.2, G, z - 0.2, x + 0.2, G + 0.45, z + 0.2, 0x7a5a3a, false);
  S.fridge = at(0.85, G, 11.3, 0); S.sink = at(4.0, G, 9.5, Math.PI / 2); S.kitchenTable = at(1.6, G, 9.5, Math.PI / 2);
  // dining / laundry
  box('dark', -3.6, G, 8.6, -1.6, G + 0.76, 9.8, 0x6a4a2a);
  box('trim', -4.9, G, 10.7, -4.2, G + 0.92, 11.4, 0xf0f0e8); box('trim', -4.9, G, 11.42, -4.2, G + 0.92, 11.9, 0xf0f0e8);
  S.laundry = at(-3.8, G, 11.1, -Math.PI / 2); S.dining = at(-2.6, G, 10.3, Math.PI);
  // bedrooms
  box('fabric', -4.95, U, 3.5, -3.3, U + 0.55, 5.6, old ? 0x5a5040 : 0xc0b0d0); box('dark', -4.98, U, 3.45, -4.88, U + 1.1, 5.65, 0x4a3020);
  box('dark', -1.2, U, 0.1, -0.15, U + 1.1, 0.55, 0x5a3a22);
  box('fabric', 0.15, U, 0.15, 1.7, U + 0.55, 2.2, 0x8090a0);
  box('fabric', -1.1, U, 10.0, 1.1, U + 0.55, 11.95, old ? 0x504838 : 0xd8c8c0); box('dark', -1.15, U, 11.8, 1.15, U + 1.2, 11.95, 0x4a3020);
  box('dark', 3.2, U, 11.3, 4.9, U + 0.9, 11.9, 0x5a3a22);
  S.bed1 = at(-4.1, U + 0.55, 4.5, Math.PI / 2); S.bed3 = at(0, U + 0.55, 10.8, Math.PI); S.bed3Side = at(1.6, U, 10.5, -Math.PI / 2);
  // bath
  box('trim', -4.95, U, 6.1, -3.4, U + 0.55, 7.9, 0xf0f0f0); box('trim', -0.9, U, 7.4, -0.4, U + 0.45, 7.9, 0xf0f0f0); box('trim', -2.4, U, 7.55, -1.6, U + 0.85, 7.95, 0xf0f0f0);
  // closet clothes
  for (let i = 0; i < 6; i++) B.box('fabric', H.m, 3.75 + i * 0.2, U + 0.8, 0.2, 3.85 + i * 0.2, U + 1.9, 0.6, [0x6a4a4a, 0x3a4a6a, 0xa09070, 0x2a2a2a, 0x8a6a5a, 0x5a6a4a][i]);
  S.closet = at(4.35, U, 0.9, Math.PI / 2);
  S.porch = at(1.5, 0, -3.8, Math.PI); S.back = at(2.95, 0, 13.6, 0);
  S.window = at(-2.5, G, 0.6, Math.PI);
}

function shellHouse(B, W, H, town) {
  const sid = H.color, trim = 0xeeeae0;
  B.box({ def: 'siding', ny: 'trim' }, H.m, -5, 0.3, 0, 5, TOP, 12, sid);
  B.box('brick', H.m, -5.1, 0, -0.1, 5.1, 0.3, 12.1, 0x8a7a70);
  W.addWall(...[H.w(-5.1, 0, -0.05), H.w(5.1, 0, -0.05)].flatMap((p) => [p.x, p.z]), 0, TOP, { thick: 0.2 });
  W.addWall(...[H.w(-5.1, 0, 12.05), H.w(5.1, 0, 12.05)].flatMap((p) => [p.x, p.z]), 0, TOP, { thick: 0.2 });
  W.addWall(...[H.w(-5.05, 0, 0), H.w(-5.05, 0, 12)].flatMap((p) => [p.x, p.z]), 0, TOP, { thick: 0.2 });
  W.addWall(...[H.w(5.05, 0, 0), H.w(5.05, 0, 12)].flatMap((p) => [p.x, p.z]), 0, TOP, { thick: 0.2 });
  W.addBox(...H.wbox(-5, 0, 0, 5, TOP, 12), { walk: false });
  // windows: dark or lit, with curtains glowing through
  const win = (x0, y0, x1, y1, z, lit, out = -1) => {
    B.box('trim', H.m, x0 - 0.07, y0 - 0.07, z + out * 0.06, x1 + 0.07, y1 + 0.07, z + out * 0.03, trim);
    const c = lit ? (rnd() > 0.5 ? 0xffc070 : 0xe8a050) : 0x0a0c10;
    B.quad(lit ? 'lit' : 'glass', H.m, ...(out < 0 ? [[x1, y0, z - 0.07], [x0, y0, z - 0.07], [x0, y1, z - 0.07], [x1, y1, z - 0.07]] : [[x0, y0, z + 0.07], [x1, y0, z + 0.07], [x1, y1, z + 0.07], [x0, y1, z + 0.07]]), lit ? c : 0x101418);
    if (lit) { const p = H.w((x0 + x1) / 2, (y0 + y1) / 2, z + out * 0.5); W.lights.push({ x: p.x, y: p.y, z: p.z, color: c, intensity: 1.5, range: 5, see: 0.3, on: true, outdoor: true }); }
  };
  for (const [x0, x1] of [[-3.8, -1.2], [1.2, 3.8]]) { win(x0, 1.2, x1, 2.5, 0, rnd() < H.lit); win(x0, 4.1, x1, 5.3, 0, rnd() < H.lit * 0.6); }
  win(-3.5, 1.2, -1.5, 2.5, 12, rnd() < H.lit, 1);
  // front door, porch, steps
  B.box('dark', H.m, 1, 0.3, -0.04, 2, 2.4, 0.0, 0x5a3a28);
  B.box({ def: 'wood' }, H.m, -1.2, 0, -2.6, 3.8, 0.3, 0, 0x8a7a68);
  W.addFloor(...flat(H.wbox(-1.2, 0, -2.6, 3.8, 0, 0)), 0.3);
  B.box('trim', H.m, -1.2, 2.85, -2.7, 3.8, 3.0, 0, trim);
  for (const x of [-1.1, 3.7]) B.box('trim', H.m, x - 0.07, 0.3, -2.6, x + 0.07, 2.85, -2.46, 0xf2efe6);
  B.quad('shingle', H.m, [-1.4, 3.35, 0], [4.0, 3.35, 0], [4.0, 3.0, -2.9], [-1.4, 3.0, -2.9], 0x6a6560);
  if (H.lit > 0.25) { const p = H.w(1.5, 2.6, -0.3); W.lights.push({ x: p.x, y: p.y, z: p.z, color: 0xffd9a0, intensity: 4, range: 6, see: 0.5, on: true, outdoor: true }); B.box('glow', H.m, 2.25, 2.5, -0.12, 2.4, 2.72, -0.02, 0xffe8c0); }
  roof(B, W, H, sid, trim);
}

function yard(B, W, H, town, light) {
  // walk to the porch, driveway, mailbox, hedges, back fence
  const m = H.m;
  B.quad('concrete', m, [1.0, 0.025, -3.2], [2.0, 0.025, -3.2], [2.0, 0.025, -14 + 6.1], [1.0, 0.025, -14 + 6.1]);
  B.quad('concrete', m, [6.4, 0.02, 10], [9.2, 0.02, 10], [9.2, 0.02, -14 + 4.2], [6.4, 0.02, -14 + 4.2]);
  B.box('metal', m, 5.2, 0, -6.0, 5.28, 1.0, -5.92, 0x333333); B.box('paint', m, 5.05, 1.0, -6.25, 5.43, 1.22, -5.7, H.boarded ? 0x5a4a3a : 0x2a3a5a);
  // hedge along part of the front lot line, with a gap
  if (!H.shell || rnd() > 0.5) {
    for (const [x0, x1] of [[-10.5, -6], [-4.5, -0.5]]) { B.box('hedge', m, x0, 0, -6.2, x1, 1.05, -5.4, 0xffffff); const b = H.wbox(x0, 0, -6.2, x1, 1.05, -5.4); W.addBox(...b); }
  }
  // back fence (pickets) with a gate gap
  for (let x = -11; x < 11; x += 0.16) { if (x > 2 && x < 3.4) continue; B.box('trim', m, x, 0, 23.9, x + 0.09, 1.25 - ((x * 7) % 1) * 0, 23.96, 0xe6e2d6); }
  B.box('trim', m, -11, 0.85, 23.84, 11, 0.95, 23.9, 0xe6e2d6);
  for (const [a, b] of [[-11, 2], [3.4, 11]]) { const p = H.w(a, 0, 23.93), q = H.w(b, 0, 23.93); W.addWall(p.x, p.z, q.x, q.z, 0, 1.25, { thick: 0.08, low: true }); }
  // trash cans; jack-o'-lanterns on lived-in porches
  B.box('metal', m, 9.4, 0, 9.5, 9.95, 0.85, 10.05, 0x6a6a68); W.addBox(...H.wbox(9.4, 0, 9.5, 9.95, 0.85, 10.05));
  if (!H.boarded && (!H.shell || H.lit > 0.3)) {
    const y = H.shell ? 0.3 : G, p = H.w(0.2, y, -2.2);
    town.pumpkins.push({ p, house: H.name });
    const L = { x: p.x, y: p.y + 0.15, z: p.z, color: 0xff8a2a, intensity: 1.2, range: 4, see: 0.25, on: true, flicker: 2, outdoor: true }; W.lights.push(L);
  }
  // Annie's car in the Wallace drive; parked cars elsewhere
  if (H.name === 'wallace' || H.name === 'shellSW' || H.name === 'shellE' || H.name === 'elrod' || H.name === 'shellNE') {
    const c = H.w(7.8, 0, -3.5);
    town.cars.push({ x: c.x, z: c.z, yaw: H.rot, color: H.name === 'wallace' ? 0x5a1c16 : [0x2a3a4a, 0x6a6a50, 0x3a2a20][town.cars.length % 3], owner: H.name, drive: true });
  }
}

function tree(B, W, x, z, cards) {
  const I = new THREE.Matrix4();
  const h = 7 + rnd() * 4, r0 = 0.22 + rnd() * 0.12;
  const seg = (a, b, ra, rb) => {
    const g = new THREE.CylinderGeometry(rb, ra, a.distanceTo(b), 7, 1, true);
    const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a).normalize();
    const m = new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), dir), new V(1, 1, 1));
    B.geom('bark', g, m, 0xb0a090);
  };
  const branch = (p, dir, len, r, depth) => {
    const q = p.clone().addScaledVector(dir, len);
    seg(p, q, r, r * 0.68);
    if (depth >= 4 || r < 0.025) {
      for (let i = 0; i < (depth > 3 ? 7 : 4); i++) cards.push({ p: q.clone().add(new V((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.0, (rnd() - 0.5) * 1.6)), s: 0.55 + rnd() * 0.5 });
      return;
    }
    const n = depth === 0 ? 4 : 2 + (rnd() > 0.5);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new V((rnd() - 0.5) * 1.3, 0.25 + rnd() * 0.5, (rnd() - 0.5) * 1.3)).normalize();
      branch(q, d, len * (0.62 + rnd() * 0.15), r * 0.62, depth + 1);
    }
  };
  branch(new V(x, 0, z), new V(0, 1, 0), h * 0.42, r0, 0);
  W.addWall(x - r0, z, x + r0, z, 0, 3, { thick: r0 * 2 });
  W.addBox(x - r0, 0, z - r0, x + r0, 3, z + r0, { walk: false });
}
