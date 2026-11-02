// HALLOWEENVR desktop film look: HDR scene -> bright pass -> two-level blur
// bloom -> ACES, cold-shadow / warm-light grade, vignette, grain, and a red
// edge when the Shape is at full strength. VR skips this (Quest frame budget).
import * as THREE from '../vendor/three.module.js';

const QUAD_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.main = new THREE.WebGLRenderTarget(4, 4, { ...opts, samples: 4 });
    const mk = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.a = mk(); this.b = mk(); this.c = mk(); this.d = mk();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.bright = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, th: { value: 1.1 } }, vertexShader: QUAD_V, depthTest: false,
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tex; uniform float th; vec3 safe(vec3 c){ return (c.r == c.r && c.g == c.g && c.b == c.b) ? clamp(c, 0.0, 60.0) : vec3(0.0); } void main(){ vec3 c = safe(texture2D(tex, vUv).rgb); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th * 2.2, l), 1.0); }' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_V, depthTest: false,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
        void main(){ vec3 s = texture2D(tex, vUv).rgb * 0.227;
          s += (texture2D(tex, vUv + dir * 1.385).rgb + texture2D(tex, vUv - dir * 1.385).rgb) * 0.316;
          s += (texture2D(tex, vUv + dir * 3.231).rgb + texture2D(tex, vUv - dir * 3.231).rgb) * 0.070;
          gl_FragColor = vec4(s, 1.0); }` });
    this.comp = new THREE.ShaderMaterial({ vertexShader: QUAD_V, depthTest: false,
      uniforms: { tex: { value: null }, b1: { value: null }, b2: { value: null }, exposure: { value: 1.35 }, time: { value: 0 }, rage: { value: 0 }, hurt: { value: 0 }, aspect: { value: 1 } },
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex, b1, b2; uniform float exposure, time, rage, hurt, aspect;
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        vec3 safe(vec3 c){ return (c.r == c.r && c.g == c.g && c.b == c.b) ? clamp(c, 0.0, 60.0) : vec3(0.0); }
        void main(){
          vec3 c = safe(texture2D(tex, vUv).rgb) + safe(texture2D(b1, vUv).rgb) * 0.55 + safe(texture2D(b2, vUv).rgb) * 0.45;
          c = aces(c * exposure * 1.9);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, c * vec3(0.86, 0.97, 1.12), (1.0 - smoothstep(0.0, 0.35, l)) * 0.55);     // cold shadows
          c = mix(c, c * vec3(1.08, 1.0, 0.88), smoothstep(0.35, 0.9, l) * 0.35);              // warm lights
          vec2 q = (vUv - 0.5) * vec2(aspect, 1.0); float r = length(q);
          c *= mix(1.0, smoothstep(0.95, 0.28, r), 0.6);                                       // vignette
          c = mix(c, vec3(c.r * 1.25 + 0.03, c.g * 0.55, c.b * 0.5), rage * smoothstep(0.3, 0.85, r));
          c = mix(c, vec3(0.35, 0.0, 0.0), hurt * smoothstep(0.2, 0.9, r));
          c += (h(gl_FragCoord.xy + fract(time * 7.0) * 113.0) - 0.5) * 0.016;                          // grain
          gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)), 1.0); }` });
    this.w = 0; this.h = 0;
  }
  size() {
    const s = this.r.getDrawingBufferSize(new THREE.Vector2()), w = s.x, h = s.y;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.main.setSize(w, h); this.a.setSize(w >> 2, h >> 2); this.b.setSize(w >> 2, h >> 2); this.c.setSize(w >> 3, h >> 3); this.d.setSize(w >> 3, h >> 3);
    this.comp.uniforms.aspect.value = w / h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera, { time = 0, exposure = 1.35, rage = 0, hurt = 0 } = {}) {
    this.size();
    const r = this.r, tm = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.main); r.render(scene, camera);
    this.bright.uniforms.tex.value = this.main.texture; this.pass(this.bright, this.a);
    const blur = (src, dst, w, h, dx, dy) => { this.blur.uniforms.tex.value = src.texture; this.blur.uniforms.dir.value.set(dx / w, dy / h); this.pass(this.blur, dst); };
    blur(this.a, this.b, this.a.width, this.a.height, 1, 0); blur(this.b, this.a, this.a.width, this.a.height, 0, 1);
    blur(this.a, this.c, this.c.width, this.c.height, 1, 0); blur(this.c, this.d, this.c.width, this.c.height, 0, 1);
    blur(this.d, this.c, this.c.width, this.c.height, 2, 0); blur(this.c, this.d, this.c.width, this.c.height, 0, 2);
    const u = this.comp.uniforms; u.tex.value = this.main.texture; u.b1.value = this.a.texture; u.b2.value = this.d.texture; u.time.value = time; u.exposure.value = exposure; u.rage.value = rage; u.hurt.value = hurt;
    this.pass(this.comp, null);
    r.toneMapping = tm;
  }
}
