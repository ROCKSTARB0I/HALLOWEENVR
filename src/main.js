// HALLOWEENVR bootstrap: renderer, night, the light pool, input (Quest and
// desktop), and the frame loop that ties the town, the people, the physics,
// the blood and the sound together.
import * as THREE from '../vendor/three.module.js';
import { buildTextures, T } from './tex.js?v=4';
import { World } from './world.js?v=4';
import { Physics } from './kinetic.js?v=4';
import { buildTown } from './town.js?v=4';
import { initFleshMaterials } from './flesh.js?v=4';
import { Shape } from './shape.js?v=4';
import { Night } from './mind.js?v=4';
import { Crimson } from './crimson.js?v=4';
import { Sound } from './sound.js?v=4';

const V = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const S = { exposure: 1.0, height: 0.12, grip: 'icepick', mask: true };
try { Object.assign(S, JSON.parse(localStorage.getItem('halloweenvr') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('halloweenvr', JSON.stringify(S)); } catch (e) {} };

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUEST ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35 * S.exposure;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x0a0e16, 0.034);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 400);
const dolly = new THREE.Group(); dolly.add(camera); scene.add(dolly);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// --------------------------------------------------------------- the night
function sky() {
  const g = new THREE.SphereGeometry(300, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { moon: { value: new V(-0.42, 0.55, 0.72).normalize() }, t: { value: 0 } },
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vd; uniform vec3 moon; uniform float t;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ vec3 d = normalize(vd); float up = max(d.y, 0.0);
        vec3 c = mix(vec3(0.035,0.045,0.07), vec3(0.008,0.01,0.02), pow(up, 0.5));
        float md = dot(d, moon); c += vec3(0.5,0.55,0.65) * pow(max(md,0.0), 60.0) * 0.25 + vec3(0.18,0.2,0.26) * pow(max(md,0.0), 6.0) * 0.12;
        float disc = smoothstep(0.9993, 0.9996, md); float maria = n(d*180.0) * 0.25 + n(d*60.0)*0.2;
        c = mix(c, vec3(0.92,0.9,0.82) * (1.0 - maria), disc);
        float st = step(0.9985, h(floor(d * 420.0))) * up * (0.4 + 0.6 * h(floor(d*420.0)+3.0)); c += vec3(st) * 0.6;
        float cl = n(d * vec3(3.0, 8.0, 3.0) + vec3(t*0.004, 0.0, t*0.002)) * 0.6 + n(d * 9.0 + vec3(t*0.01,0,0)) * 0.4;
        cl = smoothstep(0.45, 0.8, cl) * smoothstep(0.0, 0.25, up);
        c = mix(c, vec3(0.06,0.065,0.08) + vec3(0.25,0.27,0.3) * pow(max(md,0.0), 8.0) * 0.6, cl * 0.85);
        gl_FragColor = vec4(c, 1.0); }` });
  const s = new THREE.Mesh(g, m); s.frustumCulled = false; s.renderOrder = -1; scene.add(s); return m;
}
const skyMat = sky();
const moon = new THREE.DirectionalLight(0x9db3e0, 0.55);
moon.castShadow = true; moon.shadow.mapSize.setScalar(QUEST ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);
scene.add(new THREE.HemisphereLight(0x2a3a58, 0x0c0906, 0.42));

// a fixed pool of real lights handed to the nearest lamps (no shader recompiles)
class LightPool {
  constructor(n) { this.L = []; for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); this.L.push({ l, e: null, w: 0 }); } this.t = 0; }
  update(dt, cam, time) {
    const W = world;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.25;
      const ranked = W.lights.filter((e) => e.on).map((e) => ({ e, s: e.intensity / (cam.distanceToSquared(_v.set(e.x, e.y, e.z)) + 9) * (e.zone && e.zone === W.zoneAt(cam.x, cam.y - 1.4, cam.z) ? 6 : 1) })).sort((a, b) => b.s - a.s).slice(0, this.L.length).map((r) => r.e);
      this.want = new Set(ranked);
      for (const s of this.L) if (s.e && !this.want.has(s.e)) s.drop = true;
      for (const e of ranked) if (!this.L.some((s) => s.e === e)) { const free = this.L.find((s) => !s.e); if (free) { free.e = e; free.w = 0; free.drop = false; } }
    }
    for (const s of this.L) {
      if (!s.e) { s.l.intensity = 0; continue; }
      if (s.drop || !s.e.on) { s.w -= dt * 3; if (s.w <= 0) { s.e = null; s.w = 0; s.drop = false; s.l.intensity = 0; continue; } } else s.w = Math.min(1, s.w + dt * 3);
      const e = s.e; s.l.position.set(e.x, e.y, e.z); s.l.color.setHex(e.color); s.l.distance = e.range * 1.6;
      let f = 1;
      if (e.flicker === 1) f = 0.55 + 0.45 * Math.abs(Math.sin(time * 7.3) * Math.sin(time * 2.9 + Math.sin(time * 13)));
      if (e.flicker === 2) f = 0.7 + 0.3 * Math.sin(time * 23 + e.x) * Math.sin(time * 9.7 + e.z);
      if (e.flicker === 3) f = Math.random() < 0.08 ? 0.2 : 1;
      e.f = f; s.l.intensity = e.intensity * f * s.w;
    }
  }
}
const _v = new V();

// ----------------------------------------------------------------- input
const keys = new Set(); let mouseL = false, mouseR = false, clicked = false, locked = false, dragging = false;
const input = { move: { x: 0, y: 0 }, snap: 0, stab: false, grab: false, use: false, letGo: false, retake: false, noclip: false, fly: 0, gripL: false, gripR: false, hands: null };
let yaw = Math.PI, pitch = 0, tilt = 0, noclip = false, paused = false, started = false, inVR = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (!started) return;
  if (e.code === 'KeyE') input._use = true;
  if (e.code === 'KeyF') input._letGo = true;
  if (e.code === 'KeyN') { noclip = !noclip; caption(noclip ? 'Free camera (N to return)' : '', 1.5); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', (e) => {
  if (!started || inVR) return;
  if (!locked) { canvas.requestPointerLock?.(); dragging = true; }
  if (e.button === 0) { mouseL = true; clicked = true; } if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; dragging = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
addEventListener('mousemove', (e) => {
  if (!started || inVR || paused) return;
  if (!locked && !dragging) return;
  yaw -= e.movementX * 0.0022; pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.0022));
});

function readInput(dt) {
  input.snap = 0; input.stab = false; input.use = !!input._use; input.letGo = !!input._letGo; input._use = input._letGo = false; input.retake = input.use;
  if (inVR) {
    const s = renderer.xr.getSession(); input.hands = { l: null, r: null }; input.move.x = input.move.y = 0;
    let gl = false, gr = false;
    for (const src of s.inputSources) {
      const gp = src.gamepad; if (!gp) continue;
      const hand = src.handedness === 'left' ? 'l' : 'r';
      const pose = renderer.xr.getFrame()?.getPose(src.gripSpace, renderer.xr.getReferenceSpace());
      if (pose) {
        const p = pose.transform.position, o = pose.transform.orientation;
        const m = new THREE.Matrix4().compose(new V(p.x, p.y, p.z), new THREE.Quaternion(o.x, o.y, o.z, o.w), new V(1, 1, 1)).premultiply(dolly.matrixWorld);
        const pos = new V(), q = new THREE.Quaternion(); m.decompose(pos, q, new V());
        input.hands[hand] = { pos, quat: q };
      }
      const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0], gp.axes[1]];
      const b = (i) => !!gp.buttons[i]?.pressed;
      if (hand === 'l') { input.move.x = Math.abs(ax[0]) > 0.15 ? ax[0] : 0; input.move.y = Math.abs(ax[1]) > 0.15 ? -ax[1] : 0; gl = b(1); if (b(4) && !xrPrev.x) input.use = true; xrPrev.x = b(4); }
      else {
        if (Math.abs(ax[0]) > 0.7) { if (!xrPrev.turn) { input.snap = -Math.sign(ax[0]) * Math.PI / 6; xrPrev.turn = true; } } else xrPrev.turn = false;
        gr = b(1);
        if (b(4) && !xrPrev.a) input.use = true; xrPrev.a = b(4);
        if (b(5) && !xrPrev.b) togglePause(); xrPrev.b = b(5);
      }
    }
    input.gripL = gl; if (gr && !xrPrev.gr) { input.letGo = true; input.gripR = true; } else input.gripR = false; xrPrev.gr = gr;
    input.noclip = false;
    return;
  }
  input.move.x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  input.move.y = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  if (keys.has('ArrowLeft')) yaw += dt * 2; if (keys.has('ArrowRight')) yaw -= dt * 2;
  if (keys.has('ArrowUp')) pitch = Math.min(1.45, pitch + dt * 1.5); if (keys.has('ArrowDown')) pitch = Math.max(-1.45, pitch - dt * 1.5);
  input.stab = clicked; clicked = false; input.grab = mouseR || keys.has('KeyG');
  tilt += ((keys.has('KeyQ') ? 0.42 : 0) - tilt) * Math.min(1, dt * 5);
  input.noclip = noclip; input.fly = (keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') ? 1 : 0);
}
const xrPrev = {};

// ------------------------------------------------------------------ UI
let capT = 0;
function caption(text, secs = 3) { const c = $('caption'); c.textContent = text; c.hidden = !text; capT = secs; if (vrCaption) vrCaption.show(text, secs); }
function togglePause() {
  if (!started) return;
  paused = !paused;
  let p = $('pause');
  if (!p) {
    p = document.createElement('div'); p.id = 'pause';
    p.innerHTML = `<h2>PAUSED</h2>
      <div class="row">Brightness <button data-a="exp-">−</button><span id="pExp"></span><button data-a="exp+">+</button></div>
      <div class="row">VR height <button data-a="h-">−</button><span id="pH"></span><button data-a="h+">+</button></div>
      <div class="row">Knife grip <button data-a="grip" id="pGrip"></button></div>
      <div class="row"><button data-a="resume">Resume</button><button data-a="restart">Restart night</button></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', (e) => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'resume') togglePause();
      if (a === 'restart') location.reload();
      if (a === 'exp-') S.exposure = Math.max(0.4, S.exposure - 0.1); if (a === 'exp+') S.exposure = Math.min(2.5, S.exposure + 0.1);
      if (a === 'h-') S.height = Math.max(-0.4, S.height - 0.05); if (a === 'h+') S.height = Math.min(0.6, S.height + 0.05);
      if (a === 'grip') { S.grip = S.grip === 'icepick' ? 'forward' : 'icepick'; shape.setGrip(S.grip); }
      save(); paintPause();
    });
  }
  p.hidden = !paused; paintPause();
  if (paused) document.exitPointerLock?.();
  if (vrMenu) vrMenu.visible = paused && inVR;
}
function paintPause() {
  if (!$('pExp')) return;
  $('pExp').textContent = S.exposure.toFixed(1); $('pH').textContent = (S.height >= 0 ? '+' : '') + S.height.toFixed(2) + ' m'; $('pGrip').textContent = S.grip === 'icepick' ? 'Overhand (ice pick)' : 'Forward';
  renderer.toneMappingExposure = 1.35 * S.exposure; if (shape) shape.heightOffset = S.height;
}

// floating text panel for VR (captions and the pause card)
function textPanel(w, h) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  m.renderOrder = 999; m.visible = false;
  m.draw = (lines, size = 46, color = '#f2ead8') => {
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    g.font = `${size}px "Courier Prime", monospace`; g.textAlign = 'center'; g.fillStyle = color; g.shadowColor = '#000'; g.shadowBlur = 12;
    lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.3 + size * 0.35));
    tex.needsUpdate = true;
  };
  return m;
}
let vrCaption = null, vrMenu = null;

// objective guide: a line of text, an arrow low in front of you, a marker over the target
function makeGuide() {
  const orange = 0xf0801a;
  const sh = new THREE.Shape(); sh.moveTo(0, 0.09); sh.lineTo(0.06, -0.02); sh.lineTo(0.022, -0.005); sh.lineTo(0.022, -0.07); sh.lineTo(-0.022, -0.07); sh.lineTo(-0.022, -0.005); sh.lineTo(-0.06, -0.02); sh.lineTo(0, 0.09);
  const ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2);          // lies flat, tip toward -z
  const arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: orange, transparent: true, opacity: 0.75, depthTest: false, fog: false, side: THREE.DoubleSide }));
  arrow.renderOrder = 998; scene.add(arrow);
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(Math.PI / 4); g.strokeStyle = '#f0801a'; g.lineWidth = 6; g.strokeRect(-14, -14, 28, 28); g.fillStyle = 'rgba(240,128,26,0.35)'; g.fillRect(-14, -14, 28, 28);
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, fog: false }));
  marker.renderOrder = 998; scene.add(marker);
  const el = document.createElement('div'); el.id = 'objective';
  el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);color:#f0b070;font-size:14px;letter-spacing:0.08em;text-shadow:0 1px 3px #000;pointer-events:none;text-align:center;max-width:70vw';
  document.body.appendChild(el);
  const panel = textPanel(0.9, 0.12); camera.add(panel); panel.position.set(0, -0.36, -0.95);
  const G = { arrow, marker, el, panel, obj: null, t: 0, on: true, last: '' };
  G.update = (dt) => {
    G.t -= dt;
    if (G.t <= 0) { G.t = 0.3; G.obj = !started || night.over ? null : night.objective(); }
    const o = G.obj, show = G.on && started && !paused && !!o;
    // just the arrow: no marker, no objective text
    arrow.visible = show; marker.visible = false; el.hidden = true; panel.visible = false;
    if (!show) return;
    const cp = camera.getWorldPosition(new V()), f = camera.getWorldDirection(new V()); f.y = 0; f.normalize();
    const d = (o.next || o.point).clone().sub(cp); d.y = 0; const dist = o.dist ?? d.length();
    arrow.position.copy(cp).addScaledVector(f, 0.75).add(new V(0, inVR ? -0.55 : -0.45, 0));
    arrow.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
    arrow.visible = dist > 2.5 && d.length() > 0.3;
    const top = o.who && o.inside ? o.who.head(new V()).add(new V(0, 0.35, 0)) : o.point.clone().add(new V(0, 2.4, 0));
    marker.position.copy(top); marker.scale.setScalar(Math.max(0.25, cp.distanceTo(top) * 0.035) * (1 + Math.sin(time * 4) * 0.08));
    const txt = `${o.text} · ${Math.round(dist)} m${o.down ? ' · downstairs' : o.up ? ' · upstairs' : ''}`;
    if (txt !== G.last) { G.last = txt; el.textContent = txt; if (inVR) panel.draw([txt.length > 52 ? txt.slice(0, 50) + '…' : txt], 40, '#f0b070'); }
  };
  return G;
}
let guide = null;
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && guide) { guide.on = !guide.on; caption(guide.on ? 'Objective guide on (H)' : 'Objective guide off (H)', 1.5); } });

// ------------------------------------------------------------------ boot
let world, phys, town, shape, night, crimson, sound, pool;
async function boot() {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  $('loading').textContent = 'Painting the houses…'; await tick();
  buildTextures(QUEST); initFleshMaterials();
  $('loading').textContent = 'Building Lampkin Lane…'; await tick();
  world = new World(); phys = new Physics(world);
  town = buildTown(scene, world, { low: QUEST });
  pool = new LightPool(QUEST ? 6 : 9);
  crimson = new Crimson(scene, world);
  sound = new Sound(world);
  shape = new Shape(scene, world, phys, camera, dolly, crimson);
  shape.setGrip(S.grip); shape.heightOffset = S.height;
  $('loading').textContent = 'Waking the neighbours…'; await tick();
  night = new Night({ scene, world, phys, town, shape, crimson, sound, caption, camera });
  vrCaption = textPanel(1.2, 0.3); camera.add(vrCaption); vrCaption.position.set(0, -0.28, -1.1);
  vrCaption.show = (t, s) => { vrCaption.visible = !!t && inVR; vrCaption.draw(wrap(t, 40)); vrCaption.t = s; };
  vrMenu = textPanel(1.0, 0.6); camera.add(vrMenu); vrMenu.position.set(0, 0, -1.2); vrMenu.draw(['PAUSED', '', 'B: resume', 'Hold both grips + A: restart'], 54, '#f0801a');
  guide = makeGuide();
  $('loading').textContent = '';
  $('playDesktop').disabled = false;
  renderer.setAnimationLoop(frame);
}
function wrap(t, n) { const out = []; let line = ''; for (const w of (t || '').split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; }

function spawn() {
  // Michael starts outside on the lawn across the street from the Myers house
  camera.position.set(0, inVR ? 0 : 1.8, 0); camera.rotation.set(0, 0, 0);
  dolly.position.set(-27, 0, 10); shape.floorY = 0; yaw = 0; shape.yaw = yaw; shape.bodyYaw = Math.PI;
  dolly.rotation.set(0, 0, 0);
}
function start() {
  spawn();
  $('screen').hidden = true; $('hud').hidden = false; started = true;
  sound.start(); night.start();
  canvas.focus();
}
$('playDesktop').disabled = true;
$('playDesktop').onclick = () => { start(); canvas.requestPointerLock?.(); };
$('howBtn').onclick = () => { $('how').hidden = !$('how').hidden; };
(async () => {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) { $('enterVR').disabled = true; $('vrNote').textContent = 'VR needs the Quest browser (WebXR). Desktop play works here.'; return; }
  $('enterVR').onclick = async () => {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    renderer.xr.setSession(session); inVR = true; start();
    session.addEventListener('end', () => { inVR = false; });
  };
})();

// ------------------------------------------------------------------ frame
const clock = new THREE.Clock(); let time = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  if (started && !paused) {
    readInput(dt);
    if (!inVR) { shape.yaw = yaw; shape.pitch = pitch; shape.tilt = tilt; }
    shape.move(dt, input, inVR);
    shape.hands(dt, input, inVR, time);
    night.update(dt, time, input, inVR);
    phys.step(dt);
    shape.pose(dt, time, inVR);
    night.after(dt, time);
    for (const d of world.doors) d.update(dt);
    crimson.update(dt);
    guide.update(dt);
    sound.update(dt, camera, time);
  } else if (started && inVR) { readInput(dt); }
  if (guide && (!started || paused)) guide.update(dt);
  const cp = camera.getWorldPosition(_v.clone());
  if (pool) pool.update(dt, cp, time);
  moon.position.set(cp.x - 30, cp.y + 45, cp.z + 40); moon.target.position.set(cp.x, 0, cp.z);
  skyMat.uniforms.t.value = time;
  if (capT > 0) { capT -= dt; if (capT <= 0) { $('caption').hidden = true; if (vrCaption) vrCaption.visible = false; } }
  if (!started) { camera.position.set(0, 0, 0); dolly.position.set(-24 + Math.sin(time * 0.05) * 6, 3.0, 9); camera.lookAt(-24, 3, -18); }
  renderer.render(scene, camera);
}
boot().catch((e) => { $('loading').textContent = 'Failed to load: ' + e.message; console.error(e); });
window.H = { get world() { return world; }, get shape() { return shape; }, get night() { return night; }, get town() { return town; }, get phys() { return phys; }, scene, camera, dolly, S, renderer, look(y, p = 0) { yaw = y; pitch = p; } };
