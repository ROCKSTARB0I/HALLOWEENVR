// HALLOWEENVR blood. Droplets are ballistic (gravity, drag), stretched along
// their velocity, and when they land they leave a splat on whatever they hit:
// floor, wall, furniture. Wounds pump in pulses, pools spread under the dead,
// and anything wet drips.
import * as THREE from '../vendor/three.module.js';
import { T } from './tex.js?v=1';

const V = THREE.Vector3;
const MAXD = 900, MAXS = 420;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V(), _v = new V(), Y = new V(0, 1, 0), Z = new V(0, 0, 1);

export class Crimson {
  constructor(scene, world) {
    this.W = world;
    const dg = new THREE.SphereGeometry(1, 6, 4);
    this.drops = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x5a0505, roughness: 0.15, metalness: 0.1 }), MAXD);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.drops.count = 0; this.drops.frustumCulled = false; scene.add(this.drops);
    this.D = [];
    const sg = new THREE.PlaneGeometry(1, 1);
    // four splat shapes live in one atlas; pick a quadrant per splat with uv offsets baked into 4 geometries
    this.splatGeos = [0, 1, 2, 3].map((q) => { const g = sg.clone(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + (q % 2) * 0.5, uv.getY(i) * 0.5 + (q < 2 ? 0.5 : 0)); return g; });
    this.splatMat = new THREE.MeshStandardMaterial({ map: T.splat.map, normalMap: T.splat.normalMap, color: 0x6a0808, roughness: 0.12, metalness: 0.05, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.dryMat = this.splatMat.clone(); this.dryMat.color.setHex(0x3a0404); this.dryMat.roughness = 0.5;
    this.splats = []; this.group = new THREE.Group(); scene.add(this.group);
    this.pools = []; this.sources = [];
  }
  // a burst of droplets from p along dir
  spray(p, dir, n = 20, speed = 3, spread = 0.5, size = 1) {
    for (let i = 0; i < n; i++) {
      if (this.D.length >= MAXD) this.D.shift();
      const d = dir.clone().normalize().add(new V((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
      this.D.push({ p: p.clone(), v: d.multiplyScalar(speed * (0.4 + Math.random() * 0.8)), r: (0.003 + Math.random() * 0.006) * size, life: 4 });
    }
  }
  // a wound that keeps pumping: arterial (pulses), venous (welling, running)
  source(getPos, getDir, kind = 'vein', life = 20) { const s = { getPos, getDir, kind, life, t: 0, alive: true }; this.sources.push(s); return s; }
  splat(p, n, size) {
    const m = new THREE.Mesh(this.splatGeos[(Math.random() * 4) | 0], this.splatMat);
    m.position.copy(p).addScaledVector(n, 0.004);
    m.quaternion.setFromUnitVectors(Z, n); m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.set(size * (0.8 + Math.random() * 0.5), size * (0.8 + Math.random() * 0.5), 1);
    if (Math.abs(n.y) < 0.5) m.scale.y *= 1.4;   // runs on walls
    m.renderOrder = 2; this.group.add(m); this.splats.push({ m, age: 0 });
    if (this.splats.length > MAXS) { const o = this.splats.shift(); this.group.remove(o.m); }
    return m;
  }
  pool(p, max = 0.7, rate = 0.03) {
    const fy = this.W.floorAt(p.x, p.z, p.y + 0.3, 0.6);
    const m = new THREE.Mesh(this.splatGeos[(Math.random() * 4) | 0], this.splatMat);
    m.position.set(p.x, fy + 0.006 + this.pools.length * 0.0004, p.z); m.quaternion.setFromUnitVectors(Z, Y); m.rotateZ(Math.random() * 6);
    m.scale.set(0.05, 0.05, 1); m.renderOrder = 1; this.group.add(m);
    this.pools.push({ m, max, rate });
  }
  update(dt) {
    const W = this.W;
    // live wounds
    for (const s of this.sources) {
      if (!s.alive) continue; s.t += dt; s.life -= dt; if (s.life <= 0) { s.alive = false; continue; }
      const p = s.getPos(), d = s.getDir();
      if (s.kind === 'artery') { const beat = (s.t * 1.3) % 1; if (beat < 0.25) this.spray(p, d, 3, 2.6 * Math.min(1, s.life / 6) + 0.4, 0.15, 1.2); }
      else if (Math.random() < dt * 9) this.spray(p, d.clone().multiplyScalar(0.2).add(new V(0, -1, 0)), 1, 0.2, 0.3, 1.1);
    }
    for (const q of this.pools) { const s = q.m.scale.x; if (s < q.max) { q.m.scale.x = q.m.scale.y = s + q.rate * dt * (1.2 - s / q.max); } }
    // droplets
    const D = this.D; let n = 0;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i]; d.life -= dt;
      d.v.y -= 9.81 * dt; d.v.multiplyScalar(1 - 0.4 * dt);
      const np = _v.copy(d.p).addScaledVector(d.v, dt);
      const fy = W.floorAt(np.x, np.z, d.p.y + 0.05, 0.1);
      let hit = null;
      if (np.y <= fy) hit = { p: new V(np.x, fy, np.z), n: Y.clone() };
      else if (Math.random() < 0.5) { const s = W.surfaceNear(np, d.r + 0.02); if (s) hit = { p: new V(s.x, np.y, s.z), n: new V(s.nx, s.ny, s.nz) }; }
      if (hit || d.life <= 0) { if (hit) this.splat(hit.p, hit.n, 0.025 + d.r * 7 + Math.min(0.08, d.v.length() * 0.006)); D.splice(i, 1); continue; }
      d.p.copy(np);
    }
    for (const d of D) {
      const sp = d.v.length(); _q.setFromUnitVectors(Y, _s.copy(d.v).divideScalar(sp || 1));
      _m.compose(d.p, _q, _s.set(d.r, d.r * (1 + Math.min(4, sp * 0.4)), d.r)); this.drops.setMatrixAt(n++, _m);
    }
    this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true;
  }
}
