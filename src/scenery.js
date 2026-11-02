// HALLOWEENVR set dressing and atmosphere: carved jack-o'-lanterns, leafy
// hedges, telephone poles and sagging wires, yard decorations, hydrants and
// the corner street sign; light shafts and pools under the streetlights,
// drifting dust, falling leaves, and wind in the trees.
import * as THREE from '../vendor/three.module.js';
import { Builder, place } from './geo.js?v=5';
import { T, rnd, srand, vnoise, fbm } from './tex.js?v=5';

const V = THREE.Vector3;
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

export function dressTown(scene, W, town, { low = false } = {}) {
  srand(31031978);
  const B = new Builder();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  B.material('pole', std({ map: T.darkwood.map, normalMap: T.darkwood.normalMap, roughness: 0.9 }), { tile: 1 });
  B.material('wire', std({ color: 0x111111, roughness: 0.6 }), { tile: 1, shadow: false });
  B.material('stone', std({ map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.95 }), { tile: 0.8 });
  B.material('paint', std({ roughness: 0.4, metalness: 0.3 }), { tile: 1 });
  B.material('cloth', std({ map: T.cloth.map, normalMap: T.cloth.normalMap, roughness: 1 }), { tile: 0.5 });
  const hayMap = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a7238'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const x = Math.random() * w, y = Math.random() * h, l = 6 + Math.random() * 18, a = (Math.random() - 0.5) * 0.6; g.strokeStyle = `hsl(${42 + Math.random() * 10},${40 + Math.random() * 25}%,${28 + Math.random() * 30}%)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }); hayMap.wrapS = hayMap.wrapT = THREE.RepeatWrapping;
  B.material('hay', std({ map: hayMap, roughness: 1 }), { tile: 0.6 });
  const out = { update: () => {} };
  const updaters = [];

  // ------------------------------------------------------- jack-o'-lanterns
  // ribbed, squat pumpkins with carved faces that glow from the candle inside
  const face = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;        // the sphere's +Z faces u = 0.25
    g.fillStyle = '#fff';
    const tri = (pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
    tri([cx - 46, cy - 30, cx - 16, cy - 30, cx - 30, cy - 58]); tri([cx + 16, cy - 30, cx + 46, cy - 30, cx + 30, cy - 58]);
    tri([cx - 7, cy - 8, cx + 7, cy - 8, cx, cy - 22]);
    g.beginPath(); g.moveTo(cx - 58, cy + 10);
    for (let i = 0; i <= 8; i++) { const x = cx - 58 + i * 14.5; g.lineTo(x, cy + 10 + (i % 2 ? 12 : 0)); }
    g.quadraticCurveTo(cx, cy + 62, cx - 58, cy + 10); g.fill();
  });
  const pumpGeo = new THREE.SphereGeometry(0.19, 32, 20);
  { const P = pumpGeo.attributes.position, v = new V();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const lon = Math.atan2(v.z, v.x), r = 1 - 0.07 * Math.pow(Math.abs(Math.sin(lon * 5)), 0.6); v.x *= r; v.z *= r; v.y *= 0.78; if (v.y > 0.12) v.y -= (v.y - 0.12) * 0.6; P.setXYZ(i, v.x, v.y, v.z); }
    pumpGeo.computeVertexNormals(); }
  const rind = canvasTex(256, 128, (g, w, h) => { const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#a8480e'); grd.addColorStop(0.5, '#d8691a'); grd.addColorStop(1, '#8a3a0c'); g.fillStyle = grd; g.fillRect(0, 0, w, h); for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(80,30,5,0.25)'; g.fillRect(i * w / 10 - 2, 0, 4, h); } });
  const pumpMat = new THREE.MeshStandardMaterial({ map: rind, roughness: 0.55, emissive: 0xffa040, emissiveMap: face, emissiveIntensity: 2.2 });
  const plainMat = new THREE.MeshStandardMaterial({ map: rind, roughness: 0.6 });
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.026, 0.08, 6).translate(0, 0.17, 0); const stemMat = std({ color: 0x4a4a22 });
  const pumpkin = (p, yaw, carved = true, s = 1) => {
    const m = new THREE.Mesh(pumpGeo, carved ? pumpMat : plainMat); m.position.set(p.x, p.y + 0.15 * s, p.z); m.rotation.y = yaw + (rnd() - 0.5) * 0.4; m.scale.setScalar(s); m.castShadow = true; scene.add(m);
    const st = new THREE.Mesh(stemGeo, stemMat); m.add(st); st.rotation.z = (rnd() - 0.5) * 0.4;
  };
  for (const pk of town.pumpkins) { pumpkin(pk.p, pk.yaw ?? 0); const side = new V(Math.cos(pk.yaw), 0, -Math.sin(pk.yaw)); pumpkin(pk.p.clone().addScaledVector(side, 0.45), pk.yaw, false, 0.8); }

  // ------------------------------------------------------------- hedges
  // overlapping lumpy masses with leaf cards on the skin so the edge is soft, not a box
  const hedgeMat = std({ map: T.hedge.map, normalMap: T.hedge.normalMap, roughness: 0.9, color: 0xe0ecd0 });
  B.material('hedge', hedgeMat, { tile: 1 });
  const leafTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) { const x = 10 + Math.random() * 108, y = 10 + Math.random() * 108, a = Math.random() * 6.28; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `hsl(${88 + Math.random() * 30},${28 + Math.random() * 22}%,${24 + Math.random() * 16}%)`; g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, 6.28); g.fill(); g.restore(); }
  });
  const hedgeCards = [];
  for (const b of town.hedges) {
    const [x0, , z0, x1, y1, z1] = b, alongX = x1 - x0 > z1 - z0, len = alongX ? x1 - x0 : z1 - z0, depth = alongX ? z1 - z0 : x1 - x0;
    const n = Math.max(2, Math.ceil(len / 0.55));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, r = depth * 0.62 + rnd() * 0.08, h = y1 * (0.82 + rnd() * 0.12);
      const cx = alongX ? x0 + t * len : (x0 + x1) / 2, cz = alongX ? (z0 + z1) / 2 : z0 + t * len;
      const g = new THREE.IcosahedronGeometry(1, 2), P = g.attributes.position, v = new V();
      for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k); const d = 1 + (vnoise(v.x * 2.3 + i * 7, v.y * 2.3 + v.z * 1.7, 64, 5) - 0.5) * 0.35; P.setXYZ(k, v.x * d, v.y * d, v.z * d); }
      g.computeVertexNormals();
      const m = new THREE.Matrix4().compose(new V(cx, h * 0.55, cz), new THREE.Quaternion(), new V(alongX ? 0.42 : r, h * 0.55, alongX ? r : 0.42));
      B.geom('hedge', g, m, 0xffffff);
      for (let k = 0; k < (low ? 14 : 30); k++) { const a = rnd() * 6.28, e = rnd() * 1.4 - 0.2; hedgeCards.push(new V(cx + Math.cos(a) * Math.cos(e) * (alongX ? 0.4 : r), h * 0.55 + Math.sin(e) * h * 0.55, cz + Math.sin(a) * Math.cos(e) * (alongX ? r : 0.4))); }
    }
  }
  if (hedgeCards.length) {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }), hedgeCards.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    hedgeCards.forEach((p, i) => { mm.compose(p, q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6)), new V(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.6)); im.setMatrixAt(i, mm); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }

  // ------------------------------------------- telephone poles and wires
  const poles = [];
  for (const x of [-66, -40, -14, 12, 38, 64]) {
    const z = -8.3;
    B.geom('pole', new THREE.CylinderGeometry(0.11, 0.15, 9.2, 10), place(x, 4.6, z), 0x8a7a68);
    B.box('pole', new THREE.Matrix4(), x - 0.95, 8.3, z - 0.06, x + 0.95, 8.42, z + 0.06, 0x7a6a58);
    B.box('pole', new THREE.Matrix4(), x - 0.6, 7.6, z - 0.05, x + 0.6, 7.7, z + 0.05, 0x7a6a58);
    for (const dx of [-0.85, 0, 0.85]) B.geom('paint', new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), place(x + dx, 8.5, z), 0x6a8a7a);
    B.geom('paint', new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12), place(x + 0.35, 7.1, z + 0.22), 0x6a6a64);   // transformer
    W.addWall(x - 0.14, z, x + 0.14, z, 0, 8, { thick: 0.28, low: true });
    poles.push({ x, z });
  }
  const sag = (a, b, drop, seg = 14) => { const pts = []; for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(new V().lerpVectors(a, b, t).add(new V(0, -Math.sin(t * Math.PI) * drop, 0))); } return new THREE.CatmullRomCurve3(pts); };
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (const [dx, y] of [[-0.85, 8.56], [0, 8.56], [0.85, 8.56], [-0.55, 7.76], [0.55, 7.76]]) B.geom('wire', new THREE.TubeGeometry(sag(new V(a.x + dx, y, a.z), new V(b.x + dx, y, b.z), 0.7 + rnd() * 0.25), 18, 0.009, 4, false), new THREE.Matrix4());
  }
  // service drops to every house on the north side, and across the street to the south
  for (const h of Object.values(town.houses)) {
    const pole = poles.reduce((p, q) => Math.abs(q.x - h.x) < Math.abs(p.x - h.x) ? q : p);
    const eave = h.w(3.5, 6.0, 0.4);
    B.geom('wire', new THREE.TubeGeometry(sag(new V(pole.x + 0.55, 7.7, pole.z), eave, 0.5), 14, 0.008, 4, false), new THREE.Matrix4());
  }

  // ------------------------------------------- yard decorations, hydrants
  const lawn = (house, lx, lz) => town.houses[house].w(lx, 0, lz);
  const hay = (p, ry) => { B.geom('hay', new THREE.BoxGeometry(1.0, 0.45, 0.5, 2, 1, 1), place(p.x, 0.225, p.z, ry), 0xffffff); W.addBox(p.x - 0.5, 0, p.z - 0.5, p.x + 0.5, 0.45, p.z + 0.5, { walk: false }); };
  for (const [house, lx, lz] of [['doyle', -6, -3.5], ['shellS', 4, -4], ['wallace', -7, -3]]) {
    const p = lawn(house, lx, lz), ry = town.houses[house].rot;
    hay(p, ry); hay(p.clone().add(new V(0.3, 0, 0.55)), ry + 0.3);
    pumpkin(p.clone().add(new V(0, 0.45, 0)), ry + Math.PI, false, 0.9);
  }
  // a scarecrow on the Doyle lawn: post, crossbar, stuffed flannel, burlap head, hat
  { const p = lawn('doyle', -3, -4.2), ry = town.houses.doyle.rot + Math.PI;
    B.geom('pole', new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), place(p.x, 1.05, p.z), 0x6a5a48);
    B.geom('pole', new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6).rotateZ(Math.PI / 2), place(p.x, 1.5, p.z, ry), 0x6a5a48);
    B.geom('cloth', new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10), place(p.x, 1.25, p.z, ry), 0x7a2a22);
    B.geom('cloth', new THREE.CylinderGeometry(0.07, 0.09, 1.05, 8).rotateZ(Math.PI / 2), place(p.x, 1.5, p.z, ry), 0x6a2420);
    B.geom('cloth', new THREE.CylinderGeometry(0.1, 0.14, 0.62, 8), place(p.x, 0.7, p.z, ry), 0x3a4a6a);
    B.geom('hay', new THREE.SphereGeometry(0.16, 14, 10), place(p.x, 1.74, p.z), 0xc8a070);
    B.geom('cloth', new THREE.ConeGeometry(0.17, 0.3, 12), place(p.x, 1.98, p.z), 0x3a2e20);
    B.geom('cloth', new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), place(p.x, 1.86, p.z), 0x3a2e20);
    W.addWall(p.x - 0.1, p.z, p.x + 0.1, p.z, 0, 1.8, { thick: 0.2, low: true }); }
  // cardboard tombstones on the Wallace lawn
  for (let i = 0; i < 4; i++) {
    const p = lawn('wallace', -9 + i * 1.3, -2.5 - (i % 2) * 0.6), ry = town.houses.wallace.rot + (rnd() - 0.5) * 0.4;
    const g = new THREE.BoxGeometry(0.5, 0.55, 0.06); g.translate(0, 0.275, 0);
    B.geom('stone', g, place(p.x, 0, p.z, ry), 0x9a9890);
    B.geom('stone', new THREE.CylinderGeometry(0.25, 0.25, 0.06, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.55, 0), place(p.x, 0, p.z, ry), 0x9a9890);
  }
  // hydrants at the curb
  for (const [x, z] of [[-30, 5.2], [18, -5.2], [46, 5.2]]) {
    B.geom('paint', new THREE.CylinderGeometry(0.11, 0.13, 0.62, 12), place(x, 0.31, z), 0xb01c14);
    B.geom('paint', new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), place(x, 0.62, z), 0xb01c14);
    B.geom('paint', new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2), place(x, 0.45, z), 0xb01c14);
    W.addWall(x - 0.13, z, x + 0.13, z, 0, 0.7, { thick: 0.26, low: true });
  }
  // the corner sign: LAMPKIN LN / ORANGE GROVE AVE
  { const s = town.sign || { x: -70, z: 6.5 };
    B.geom('paint', new THREE.CylinderGeometry(0.035, 0.035, 2.9, 8), place(s.x, 1.45, s.z), 0x5a5a58);
    const blade = (text) => canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1e5a34'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e8d8'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#eeeee0'; g.font = 'bold 54px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
    for (const [text, y, ry] of [['LAMPKIN LN', 2.95, 0], ['ORANGE GROVE AVE', 2.78, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.17, 0.02), new THREE.MeshStandardMaterial({ map: blade(text), roughness: 0.5, metalness: 0.2 }));
      m.position.set(s.x, y, s.z); m.rotation.y = ry; m.castShadow = true; scene.add(m);
    }
    W.addWall(s.x - 0.05, s.z, s.x + 0.05, s.z, 0, 2.9, { thick: 0.1, low: true }); }

  B.build(scene);

  // ------------------------------------- light shafts and pools (work in VR too)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(0xffb870) }, strength: { value: low ? 0.11 : 0.14 }, time: { value: 0 } },
    vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW; uniform vec3 color; uniform float strength; uniform float time;
      void main(){ float edge = abs(dot(normalize(vN), normalize(vV))); float d = length(vV);
        float dust = 0.75 + 0.25 * sin(vW.y * 2.7 + time * 0.6 + vW.x * 1.3) * sin(vW.z * 1.9 - time * 0.4);
        float a = pow(edge, 2.0) * pow(vH, 1.6) * strength * dust * exp(-d * 0.028) * smoothstep(0.6, 3.0, d);
        gl_FragColor = vec4(color * a, 1.0); }` });
  const poolTex = canvasTex(128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, 'rgba(255,200,140,1)'); grd.addColorStop(0.5, 'rgba(255,180,110,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, w, h); });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.16, fog: true, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const e of W.lights) {
    if (e.spot) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 3.4, 6.1, 28, 1, true), shaftMat); cone.position.set(e.x, e.y - 3.05, e.z); cone.renderOrder = 5; scene.add(cone);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32).rotateX(-Math.PI / 2), poolMat); pool.position.set(e.x, 0.03, e.z); pool.renderOrder = 4; scene.add(pool);
    } else if (e.outdoor && e.intensity >= 4 && e.on) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.3, 2.2, 20, 1, true), shaftMat); cone.position.set(e.x, e.y - 1.1, e.z); cone.renderOrder = 5; cone.scale.set(1, 1, 1); scene.add(cone);
    }
  }
  updaters.push((dt, t) => { shaftMat.uniforms.time.value = t; });

  // ----------------------------------------------------- drifting dust
  const DN = low ? 220 : 500, dust = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dust[i * 3] = (rnd() - 0.5) * 24; dust[i * 3 + 1] = rnd() * 6; dust[i * 3 + 2] = (rnd() - 0.5) * 24; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xa8a090, size: 0.022, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; scene.add(motes);
  updaters.push((dt, t, cam) => {
    for (let i = 0; i < DN; i++) {
      let x = dust[i * 3] + Math.sin(t * 0.3 + i) * dt * 0.08 + dt * 0.05, y = dust[i * 3 + 1] + Math.sin(t * 0.5 + i * 1.7) * dt * 0.05, z = dust[i * 3 + 2] + Math.cos(t * 0.27 + i) * dt * 0.08;
      if (x - cam.x > 12) x -= 24; if (x - cam.x < -12) x += 24; if (z - cam.z > 12) z -= 24; if (z - cam.z < -12) z += 24; if (y < 0) y += 6; if (y > 6) y -= 6;
      dust[i * 3] = x; dust[i * 3 + 1] = y; dust[i * 3 + 2] = z;
    }
    dg.attributes.position.needsUpdate = true;
  });

  // ------------------------------------------------------- falling leaves
  const LN = low ? 40 : 90, leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ map: T.leaves.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }), LN);
  const L = []; for (let i = 0; i < LN; i++) L.push({ p: new V((rnd() - 0.5) * 36, rnd() * 9, (rnd() - 0.5) * 36), ph: rnd() * 6, sp: 0.4 + rnd() * 0.5, spin: new V(rnd(), rnd(), rnd()) });
  leaves.frustumCulled = false; scene.add(leaves);
  const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), le = new THREE.Euler(), one = new V(1, 1, 1);
  updaters.push((dt, t, cam) => {
    for (let i = 0; i < LN; i++) {
      const f = L[i]; f.p.y -= f.sp * dt; f.p.x += Math.sin(t * 1.3 + f.ph) * dt * 0.5 + dt * 0.35; f.p.z += Math.cos(t * 0.9 + f.ph) * dt * 0.3;
      if (f.p.y < 0.05 || Math.abs(f.p.x - cam.x) > 18 || Math.abs(f.p.z - cam.z) > 18) f.p.set(cam.x + (rnd() - 0.5) * 34, 6 + rnd() * 4, cam.z + (rnd() - 0.5) * 34);
      lm.compose(f.p, lq.setFromEuler(le.set(t * f.spin.x * 3 + f.ph, t * f.spin.y * 2, t * f.spin.z * 4)), one); leaves.setMatrixAt(i, lm);
    }
    leaves.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------------- wind in the trees
  if (town.crown) {
    const mat = town.crown.material, wind = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3]);
          float gust = 0.6 + 0.4 * sin(uWind * 0.21 + ip.x * 0.05);
          transformed.x += (sin(uWind * 1.4 + ip.x * 0.37 + ip.z * 0.21) * 0.11 + sin(uWind * 3.3 + ip.y * 1.7) * 0.04) * gust;
          transformed.z += sin(uWind * 1.1 + ip.z * 0.29) * 0.07 * gust;
        #endif`);
    };
    mat.needsUpdate = true;
    updaters.push((dt, t) => { wind.value = t; });
  }

  out.update = (dt, t, cam) => { for (const u of updaters) u(dt, t, cam); };
  return out;
}
