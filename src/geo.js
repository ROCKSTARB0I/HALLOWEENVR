// Static scenery batcher. Everything that never moves is appended into one
// buffer per material, so a whole street of houses is a few dozen draw calls.
// UVs are planar in world metres divided by the material's tile size.
import * as THREE from '../vendor/three.module.js';

const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();

class Batch {
  constructor(mat, opts) { this.mat = mat; this.p = []; this.n = []; this.uv = []; this.c = []; this.opts = opts; }
}

export class Builder {
  constructor() { this.batches = new Map(); }
  batch(key) { const b = this.batches.get(key); if (!b) throw new Error('no material ' + key); return b; }
  material(key, mat, { tile = 1, shadow = true, receive = true } = {}) {
    this.batches.set(key, new Batch(mat, { tile, shadow, receive }));
  }
  // one triangle-pair quad, corners counter-clockwise seen from the front
  quad(key, m, a, b, c, d, col = 0xffffff, uvs = null) {
    const B = this.batch(key), tile = B.opts.tile;
    const pts = [a, b, c, d].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const e1 = pts[1].clone().sub(pts[0]), e2 = pts[3].clone().sub(pts[0]);
    const nrm = e1.clone().cross(e2).normalize();
    // planar uv in the quad's own plane, in metres
    if (!uvs) {
      const ax = e1.clone().normalize(), ay = nrm.clone().cross(ax);
      uvs = pts.map((p) => { const r = p.clone(); return [r.dot(ax) / tile, r.dot(ay) / tile]; });
    }
    const wp = pts.map((p) => p.clone().applyMatrix4(m));
    nm.getNormalMatrix(m); const wn = nrm.clone().applyMatrix3(nm).normalize();
    const color = new THREE.Color(col);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      B.p.push(wp[i].x, wp[i].y, wp[i].z); B.n.push(wn.x, wn.y, wn.z);
      B.uv.push(uvs[i][0], uvs[i][1]); B.c.push(color.r, color.g, color.b);
    }
  }
  tri(key, m, a, b, c, col = 0xffffff) {
    const B = this.batch(key), tile = B.opts.tile;
    const pts = [a, b, c].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const e1 = pts[1].clone().sub(pts[0]), e2 = pts[2].clone().sub(pts[0]);
    const nrm = e1.clone().cross(e2).normalize(), ax = e1.clone().normalize(), ay = nrm.clone().cross(ax);
    nm.getNormalMatrix(m); const wn = nrm.clone().applyMatrix3(nm).normalize();
    const color = new THREE.Color(col);
    for (const p of pts) {
      const w = p.clone().applyMatrix4(m);
      B.p.push(w.x, w.y, w.z); B.n.push(wn.x, wn.y, wn.z); B.uv.push(p.dot(ax) / tile, p.dot(ay) / tile); B.c.push(color.r, color.g, color.b);
    }
  }
  // axis-aligned box in local space; mats may be a key or {px,nx,py,ny,pz,nz,def}
  box(mats, m, x0, y0, z0, x1, y1, z1, col = 0xffffff, skip = '') {
    const k = (f) => typeof mats === 'string' ? mats : (mats[f] || mats.def);
    const c = (f) => typeof col === 'number' ? col : (col[f] ?? col.def);
    if (!skip.includes('pz')) this.quad(k('pz'), m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c('pz'));
    if (!skip.includes('nz')) this.quad(k('nz'), m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], c('nz'));
    if (!skip.includes('px')) this.quad(k('px'), m, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], c('px'));
    if (!skip.includes('nx')) this.quad(k('nx'), m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c('nx'));
    if (!skip.includes('py')) this.quad(k('py'), m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c('py'));
    if (!skip.includes('ny')) this.quad(k('ny'), m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c('ny'));
  }
  // append an arbitrary geometry (indexed or not) under a transform
  geom(key, geo, m, col = 0xffffff) {
    const B = this.batch(key), g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color;
    nm.getNormalMatrix(m); const color = new THREE.Color(col);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); B.p.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); B.n.push(n.x, n.y, n.z);
      if (U) B.uv.push(U.getX(i), U.getY(i)); else B.uv.push(v.x / B.opts.tile, v.z / B.opts.tile);
      if (C) B.c.push(C.getX(i) * color.r, C.getY(i) * color.g, C.getZ(i) * color.b); else B.c.push(color.r, color.g, color.b);
    }
  }
  build(scene) {
    const out = [];
    for (const [key, B] of this.batches) {
      if (!B.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
      g.computeBoundingSphere();
      B.mat.vertexColors = true;
      const mesh = new THREE.Mesh(g, B.mat);
      mesh.castShadow = B.opts.shadow; mesh.receiveShadow = B.opts.receive; mesh.name = key;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      scene.add(mesh); out.push(mesh);
      B.p = B.n = B.uv = B.c = null;
    }
    return out;
  }
}

export const M4 = () => new THREE.Matrix4();
export function place(x, y, z, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
}
