// HALLOWEENVR cutscenes. A shot is a camera position and a look target (either
// may move), a length, and optional hooks. On desktop the camera glides between
// shots inside letterbox bars; in VR the head stays yours: each shot is a still
// viewpoint turned to face you, with a quick fade on every cut.
import * as THREE from '../vendor/three.module.js';

const V = THREE.Vector3;
const ease = (t) => t * t * (3 - 2 * t);
const val = (x, k) => (typeof x === 'function' ? x(k) : x);

export class Cine {
  constructor({ camera, dolly, shape, isVR, fadeVR }) {
    Object.assign(this, { camera, dolly, shape, isVR, fadeVR });
    this.active = false; this.shots = []; this.i = 0; this.t = 0;
    this.bars = [0, 1].map((k) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:0;right:0;${k ? 'bottom' : 'top'}:0;height:0;background:#000;z-index:5;transition:height .6s ease;pointer-events:none`; document.body.appendChild(d); return d; });
    this.title = document.createElement('div');
    this.title.style.cssText = 'position:fixed;left:6vw;bottom:15vh;z-index:6;pointer-events:none;opacity:0;transition:opacity 1.2s;font-family:Cinzel,serif;color:#f0801a;text-shadow:0 2px 8px #000';
    document.body.appendChild(this.title);
  }
  // shots: [{ from, at, dur, fov, hold, enter(), tick(k), exit() }]; hold = Michael's body {pos, yaw, pose}
  play(shots, done, { title = null, sub = '' } = {}) {
    this.stop(false);
    this.shots = shots; this.i = -1; this.done = done; this.active = true;
    this.saved = { dp: this.dolly.position.clone(), dr: this.dolly.rotation.y, cp: this.camera.position.clone(), cq: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.shape.headHide(false); this.shape.silhouette(true);
    if (!this.isVR()) this.bars.forEach((b) => b.style.height = '9vh');
    if (title) { this.title.innerHTML = `<div style="font-size:clamp(22px,3.4vw,44px);letter-spacing:.12em">${title}</div><div style="font-family:'Courier Prime',monospace;color:#cfc6b8;font-size:13px;letter-spacing:.22em;margin-top:6px;text-transform:uppercase">${sub}</div>`; this.title.style.opacity = 1; setTimeout(() => this.title.style.opacity = 0, Math.min(5200, shots.reduce((a, s) => a + s.dur, 0) * 1000 - 1200)); }
    this.next();
  }
  next() {
    const prev = this.shots[this.i]; prev?.exit?.();
    this.i++; this.t = 0;
    const s = this.shots[this.i];
    if (!s) return this.stop(true);
    s.enter?.();
    this.shape.cineHold = s.hold ? (typeof s.hold === 'function' ? s.hold : () => s.hold) : (this.shape.cineHold || null);
    if (this.isVR()) { this.fadeVR?.(0.35); this.placeVR(s); }
  }
  placeVR(s) {
    const from = val(s.from, 0), at = val(s.at, 0), D = this.dolly, cam = this.camera;
    D.updateMatrixWorld(true);
    // turn the world so the target is where you're already looking, then put your head at `from`
    const hl = cam.position.clone(), hq = cam.quaternion.clone(), f = new V(0, 0, -1).applyQuaternion(hq); f.y = 0; f.normalize();
    const want = at.clone().sub(from); want.y = 0; want.normalize();
    const yaw = Math.atan2(-want.x, -want.z) - Math.atan2(-f.x, -f.z);
    D.rotation.set(0, yaw, 0); D.updateMatrixWorld(true);
    const head = hl.clone().applyMatrix4(D.matrixWorld);
    D.position.add(from.clone().sub(head));
  }
  update(dt) {
    if (!this.active) return;
    const s = this.shots[this.i]; if (!s) return;
    this.t += dt; const k = Math.min(1, this.t / s.dur); this.k = k;
    s.tick?.(k, dt);
    if (!this.isVR()) {
      const e = s.ease === false ? k : ease(k), from = val(s.from, e), at = val(s.at, e);
      this.dolly.position.copy(from); this.dolly.rotation.set(0, 0, 0); this.camera.position.set(0, 0, 0);
      this.camera.up.set(0, 1, 0); this.camera.lookAt(at);
      if (s.roll) this.camera.rotateZ(val(s.roll, e));
      const fov = s.fov || 55; if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    }
    if (this.t >= s.dur) this.next();
  }
  stop(finished) {
    if (!this.active) return;
    this.shots[this.i]?.exit?.();
    this.active = false; this.shape.cineHold = null; this.shape.headHide(true); this.shape.silhouette(false); this.title.style.opacity = 0;
    this.bars.forEach((b) => b.style.height = '0');
    if (this.saved) {
      this.dolly.position.copy(this.saved.dp); this.dolly.rotation.y = this.saved.dr;
      this.camera.position.copy(this.saved.cp); this.camera.quaternion.copy(this.saved.cq); this.camera.fov = this.saved.fov; this.camera.updateProjectionMatrix();
    }
    if (this.isVR()) this.fadeVR?.(0.35);
    const d = this.done; this.done = null; if (finished && d) d();
  }
  skip() { if (this.active) this.stop(true); }
}

// helpers for writing shots
export const behind = (pos, yaw, back = 2.6, up = 1.95, side = 0.7) => { const f = new V(Math.sin(yaw), 0, Math.cos(yaw)), r = new V(f.z, 0, -f.x); return pos.clone().addScaledVector(f, -back).addScaledVector(r, side).setY(pos.y + up); };
export const lerpV = (a, b) => (k) => a.clone().lerp(b, k);
