/* Ekaya 3D venue view: builds a three.js scene from the 2D plan. Loads three.js on first use.
   Three moods (day, golden hour, night), orbit / top / walk-in cameras, tap a piece to focus,
   and a picture export for WhatsApp. Chairs, plates and bulbs are instanced so big lawns stay smooth on phones. */
(() => {
'use strict';
const {$, $$, esc, icon} = E;
let loading = null, cur = null;
function loadThree(){
  if(window.THREE && THREE.OrbitControls) return Promise.resolve();
  if(loading) return loading;
  const add = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  loading = add('/assets/vendor/three.min.js').then(() => add('/assets/vendor/OrbitControls.js')).catch(e => { loading = null; throw e; });
  return loading;
}

/* sky top, horizon and below-horizon colours are sRGB; light colours are three.js hex */
const MOODS = {
  day:{sky:[0x5f97cf, 0xe8e1d4, 0xc9bca6], ex:0.62, fog:0xe8e1d4, surround:0xa99d86, hemi:[0xfff1dc, 0x7a6a52, 0.42], sun:[0xfff0d8, 2.05, 46, -38], env:0.75, exposure:0.92, glow:0.35, lamps:false, stars:false},
  dusk:{sky:[0x31305e, 0xf3a26a, 0x8a5a4a], ex:0.42, fog:0xd99a72, surround:0x7c6152, hemi:[0xffcfa0, 0x3c2a2c, 0.5], sun:[0xffa45c, 1.7, 9, -62], env:0.7, exposure:1.08, glow:0.8, lamps:true, stars:false},
  night:{sky:[0x070a1c, 0x3b2946, 0x0c0a10], ex:0.45, fog:0x0c0a15, surround:0x0d0b11, hemi:[0x58525e, 0x1c120a, 0.26], sun:[0xaebcff, 0.18, 38, 30], env:0.16, exposure:1.2, glow:1, lamps:true, stars:true}
};
const isMobile = () => matchMedia('(max-width: 759px)').matches || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);

function build(canvas, plan, ev, opts){
  const T = THREE, W = plan.w, H = plan.h, span = Math.max(W, H), CX = W / 2, CZ = H / 2, mobile = isMobile();
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.1, span * 20);
  const controls = new T.OrbitControls(camera, canvas);
  controls.target.set(CX, 0.4, CZ); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.06; controls.minDistance = 1.6; controls.maxDistance = span * 2.8;
  controls.screenSpacePanning = false; controls.rotateSpeed = 0.7;
  // upright phones look down the long side of the venue so it fills the narrow screen
  const portrait = () => camera.aspect < 0.9;
  const homeDir = () => (portrait() ? (W >= H ? new T.Vector3(0.72, 0.62, 0.32) : new T.Vector3(0.32, 0.62, 0.72)) : new T.Vector3(0.42, 0.6, 0.68)).normalize();
  const corners = [0, W].flatMap(x => [0, H].flatMap(z => [0, 2.6].map(y => new T.Vector3(x, y, z))));
  const fitDist = (dir, target, margin=0.88) => { const cam = camera.clone(); let lo = 1, hi = span * 6;
    for(let i = 0; i < 22; i++){ const mid = (lo + hi) / 2; cam.position.copy(target).addScaledVector(dir, mid); cam.lookAt(target); cam.updateMatrixWorld(); const ok = corners.every(c => { const p = c.clone().project(cam); return Math.abs(p.x) <= margin && Math.abs(p.y) <= margin && p.z < 1; }); if(ok) hi = mid; else lo = mid; }
    return hi; };
  const homeDist = () => fitDist(homeDir(), new T.Vector3(CX, 0.4, CZ));
  const homePos = () => new T.Vector3(CX, 0.4, CZ).addScaledVector(homeDir(), homeDist());

  /* ---------- materials ---------- */
  const mats = {}, M = (key, o) => mats[key] || (mats[key] = new T.MeshStandardMaterial(o));
  const cloth = M('cloth', {color:0xf7f1e7, roughness:0.86});
  const gold = M('gold', {color:0xd4ab55, roughness:0.28, metalness:0.92});
  const cushion = M('cushion', {color:0xf2eadb, roughness:0.92});
  const wood = M('wood', {color:0x6e4630, roughness:0.62});
  const darkwood = M('darkwood', {color:0x2b1d18, roughness:0.5});
  const dark = M('dark', {color:0x1e1719, roughness:0.55});
  const steel = M('steel', {color:0xd9dcdf, roughness:0.18, metalness:0.95});
  const maroon = M('maroon', {color:0x6a1b29, roughness:0.78});
  const cream = M('cream', {color:0xefe5d3, roughness:0.82});
  const leaf = M('leaf', {color:0x3c6a39, roughness:0.88});
  const leaf2 = M('leaf2', {color:0x4f7f45, roughness:0.88});
  const rose = M('rose', {color:0xe8809f, roughness:0.75});
  const marigold = M('marigold', {color:0xf39a2c, roughness:0.75});
  const ivoryF = M('ivoryF', {color:0xfff6e6, roughness:0.75});
  const stone = M('stone', {color:0x5a534d, roughness:0.95});
  const felt = M('felt', {color:0x1f5a43, roughness:0.96});
  const glass = new T.MeshStandardMaterial({color:0xffffff, roughness:0.05, metalness:0, transparent:true, opacity:0.28});
  const glowM = c => mats['g' + c] || (mats['g' + c] = new T.MeshStandardMaterial({color:c, emissive:c, emissiveIntensity:1.8, roughness:0.4}));
  const geo = {}, G = (k, f) => geo[k] || (geo[k] = f());
  const Mx = (x=0, y=0, z=0, rx=0, ry=0, rz=0, s=[1, 1, 1]) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(...s));
  /* merge simple parts into one geometry so an instanced mesh can draw hundreds in one call */
  function merge(parts){
    const P = [], N = [];
    parts.forEach(([g, m]) => { const c = g.index ? g.toNonIndexed() : g.clone(); c.applyMatrix4(m); P.push(c.attributes.position.array); N.push(c.attributes.normal.array); c.dispose(); });
    const len = P.reduce((a, x) => a + x.length, 0), pa = new Float32Array(len), na = new Float32Array(len); let o = 0;
    P.forEach((x, i) => { pa.set(x, o); na.set(N[i], o); o += x.length; });
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pa, 3)); out.setAttribute('normal', new T.BufferAttribute(na, 3)); return out;
  }
  const BX = (w, h, d) => new T.BoxGeometry(w, h, d), CY = (rt, rb, h, s=8) => new T.CylinderGeometry(rt, rb, h, s);
  // a gold chiavari chair, back towards local +z
  const chairFrame = merge([
    ...[[-0.17, -0.16], [0.17, -0.16]].map(([x, z]) => [CY(0.014, 0.012, 0.45, 6), Mx(x, 0.225, z)]),
    ...[[-0.17, 0.18], [0.17, 0.18]].map(([x, z]) => [CY(0.014, 0.012, 0.93, 6), Mx(x, 0.465, z, -0.05)]),
    [BX(0.38, 0.035, 0.36), Mx(0, 0.45, 0)],
    [BX(0.36, 0.05, 0.03), Mx(0, 0.9, 0.2)],
    [BX(0.36, 0.025, 0.025), Mx(0, 0.62, 0.19)],
    ...[-0.1, -0.035, 0.035, 0.1].map(x => [CY(0.008, 0.008, 0.28, 5), Mx(x, 0.76, 0.195)])
  ]);
  const chairPad = merge([[BX(0.36, 0.05, 0.34), Mx(0, 0.49, -0.01)]]);
  const plateGeo = merge([[CY(0.155, 0.15, 0.012, 22), Mx(0, 0.006, 0)], [CY(0.11, 0.1, 0.014, 18), Mx(0, 0.013, 0)]]);
  const bulbGeo = new T.SphereGeometry(0.03, 8, 6);

  /* ---------- glow, lights, instances ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.7)'); g.addColorStop(0.45, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  let glows, lightsWanted, flames, chairs, plates, bulbs, labels, items, bursts;
  const reset = () => { glows = new Map(); lightsWanted = []; flames = []; chairs = []; plates = []; bulbs = []; labels = []; items = []; bursts = []; };
  const v3 = new T.Vector3();
  // glows collect world positions per colour and become one additive point cloud each
  const glow = (g, color, size, x=0, y=0, z=0, night=true) => { (glows.get(color + '|' + size + '|' + (night ? 1 : 0)) || glows.set(color + '|' + size + '|' + (night ? 1 : 0), []).get(color + '|' + size + '|' + (night ? 1 : 0))).push({g, p:new T.Vector3(x, y, z)}); };
  const lamp = (g, color, intensity, dist, x=0, y=0, z=0, pri=1) => lightsWanted.push({g, color, intensity, dist, p:new T.Vector3(x, y, z), pri});
  const mesh = (g, m, x=0, y=0, z=0, cast=true) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };
  const box = (w, h, d, m, x=0, y=0, z=0) => mesh(G(`b${w}|${h}|${d}`, () => BX(w, h, d)), m, x, y + h / 2, z);
  const cyl = (rt, rb, h, m, x=0, y=0, z=0, seg=24) => mesh(G(`c${rt}|${rb}|${h}|${seg}`, () => CY(rt, rb, h, seg)), m, x, y + h / 2, z);
  const sph = (r, m, x=0, y=0, z=0, seg=14) => mesh(G(`s${r}|${seg}`, () => new T.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0))), m, x, y, z);
  const texCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const chair = (g, x, z, rotY) => chairs.push({g, m:Mx(x, 0, z, 0, rotY)});
  const plate = (g, x, y, z) => plates.push({g, m:Mx(x, y, z)});

  function centrepiece(g, x=0, z=0, top=0.765){
    g.add(cyl(0.05, 0.075, 0.2, gold, x, top, z, 12));
    const fl = [rose, marigold, ivoryF][Math.random() * 3 | 0];
    g.add(sph(0.1, fl, x, top + 0.27, z, 10)); g.add(sph(0.07, leaf2, x + 0.07, top + 0.22, z + 0.03, 8)); g.add(sph(0.065, fl, x - 0.07, top + 0.24, z - 0.04, 8));
    g.add(cyl(0.035, 0.035, 0.09, glass, x + 0.18, top, z + 0.05, 10)); g.add(sph(0.018, glowM(0xffc56b), x + 0.18, top + 0.06, z + 0.05, 6));
    glow(g, 0xffb24d, 0.55, x + 0.18, top + 0.07, z + 0.05);
  }
  function roundTable(g, it, n){
    const r = Math.max(0.3, (Math.min(it.w, it.d) - 1.1) / 2);
    g.add(cyl(r + 0.02, r + 0.02, 0.025, cloth, 0, 0.74, 0, 48));
    const drape = mesh(G(`dr${r}`, () => new T.CylinderGeometry(r + 0.02, r + 0.09, 0.74, 48, 1, true)), cloth, 0, 0.37, 0); g.add(drape);
    for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; chair(g, Math.sin(a) * (r + 0.34), Math.cos(a) * (r + 0.34), a); plate(g, Math.sin(a) * (r - 0.17), 0.766, Math.cos(a) * (r - 0.17)); }
    centrepiece(g);
  }
  const B = {
    round6(g, it){ roundTable(g, it, 6); }, round8(g, it){ roundTable(g, it, 8); }, round10(g, it){ roundTable(g, it, 10); },
    long(g, it){ const w = it.w; g.add(box(w + 0.06, 0.74, 0.86, cloth)); g.add(box(w + 0.07, 0.005, 0.32, maroon, 0, 0.742, 0)); const n = Math.max(1, Math.floor(w / 0.6));
      for(let i = 0; i < n; i++){ const x = -w / 2 + (i + 0.5) * w / n; chair(g, x, -0.68, Math.PI); chair(g, x, 0.68, 0); plate(g, x, 0.746, -0.25); plate(g, x, 0.746, 0.25); }
      const k = Math.max(1, Math.round(w / 1.8)); for(let i = 0; i < k; i++) centrepiece(g, -w / 2 + (i + 0.5) * w / k, 0, 0.745); },
    cards(g){ g.add(box(0.92, 0.7, 0.92, darkwood)); g.add(box(0.96, 0.04, 0.96, wood, 0, 0.7, 0)); g.add(box(0.8, 0.012, 0.8, felt, 0, 0.74, 0)); chair(g, 0, -0.68, Math.PI); chair(g, 0, 0.68, 0); chair(g, 0.68, 0, Math.PI / 2); chair(g, -0.68, 0, -Math.PI / 2);
      [[0.12, 0.1, 0xb32d3a], [-0.15, -0.08, 0x1d4fa0], [0.05, -0.2, 0xf2efe6]].forEach(([x, z, c], i) => g.add(cyl(0.03, 0.03, 0.04 + i * 0.01, M('chip' + i, {color:c, roughness:0.5}), x, 0.752, z, 12))); },
    cocktail(g){ g.add(cyl(0.34, 0.34, 0.02, cloth, 0, 1.06, 0, 32)); g.add(mesh(G('ckd', () => new T.CylinderGeometry(0.34, 0.26, 1.06, 32, 1, true)), cloth, 0, 0.53, 0)); g.add(cyl(0.04, 0.04, 0.12, glass, 0, 1.08, 0, 10)); g.add(sph(0.02, glowM(0xffc56b), 0, 1.15, 0, 6)); glow(g, 0xffb24d, 0.6, 0, 1.16, 0); },
    lounge(g, it){ const w = it.w, d = it.d, sofa = M('sofa', {color:0xe3d3b7, roughness:0.95}), pil = M('pil', {color:0x7a2232, roughness:0.85});
      g.add(box(w - 0.1, 0.4, 0.7, sofa, 0, 0, -d / 2 + 0.4)); g.add(box(w - 0.1, 0.42, 0.16, sofa, 0, 0.38, -d / 2 + 0.12)); g.add(box(0.7, 0.4, d - 0.8, sofa, -w / 2 + 0.4, 0, 0.35)); g.add(box(0.7, 0.4, d - 0.8, sofa, w / 2 - 0.4, 0, 0.35));
      [-w / 4, w / 4].forEach(x => { const p = box(0.36, 0.3, 0.1, pil, x, 0.42, -d / 2 + 0.26); p.rotation.x = -0.25; g.add(p); });
      g.add(box(w * 0.34, 0.36, d * 0.3, darkwood, 0, 0, 0.25)); g.add(box(w * 0.34 + 0.04, 0.03, d * 0.3 + 0.04, gold, 0, 0.36, 0.25)); centrepiece(g, 0, 0.25, 0.39); },
    baithak(g, it){ g.add(box(it.w - 0.1, 0.16, it.d - 0.1, cloth)); g.add(box(it.w - 0.4, 0.005, it.d - 0.4, maroon, 0, 0.16, 0)); const bol = M('bolster', {color:0x8c1c3f, roughness:0.8}), gl = M('bolgold', {color:0xc9963f, roughness:0.6});
      const n = Math.max(1, Math.floor((it.w - 0.4) / 0.7)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + 0.2 + (i + 0.5) * (it.w - 0.4) / n; [-1, 1].forEach(s => { const b = mesh(G('bol', () => CY(0.12, 0.12, 0.52, 16)), i % 2 ? gl : bol, x, 0.28, s * (it.d / 2 - 0.24)); b.rotation.z = Math.PI / 2; g.add(b); }); }
      const ny = Math.max(1, Math.floor((it.d - 0.4) / 0.7)); for(let j = 0; j < ny; j++){ const z = -it.d / 2 + 0.2 + (j + 0.5) * (it.d - 0.4) / ny; [-1, 1].forEach(s => { const b = mesh(G('bol', () => CY(0.12, 0.12, 0.52, 16)), j % 2 ? bol : gl, s * (it.w / 2 - 0.24), 0.28, z); b.rotation.x = Math.PI / 2; g.add(b); }); }
      g.add(cyl(0.3, 0.3, 0.06, gold, 0, 0.16, 0, 24)); for(let i = 0; i < 5; i++){ const a = i / 5 * Math.PI * 2; g.add(cyl(0.035, 0.03, 0.03, M('clay', {color:0xb5653a, roughness:0.9}), Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18, 8)); glow(g, 0xff9a40, 0.4, Math.cos(a) * 0.18, 0.28, Math.sin(a) * 0.18); } },
    rows(g, it){ const nx = Math.max(1, Math.floor(it.w / 0.55)), ny = Math.max(1, Math.floor(it.d / 0.95)); for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++) chair(g, -it.w / 2 + (i + 0.5) * it.w / nx, -it.d / 2 + (j + 0.5) * it.d / ny, Math.PI); },
    buffet(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); g.add(box(it.w + 0.01, 0.1, it.d + 0.01, gold, 0, 0.62, 0)); g.add(box(it.w + 0.01, 0.03, it.d + 0.01, maroon, 0, 0.02, 0)); const n = Math.max(1, Math.floor(it.w / 0.75));
      for(let i = 0; i < n; i++){ const x = -it.w / 2 + (i + 0.5) * it.w / n; g.add(box(0.52, 0.03, 0.36, steel, x, 0.8, 0)); [-0.2, 0.2].forEach(dx => g.add(cyl(0.008, 0.008, 0.1, steel, x + dx, 0.8, 0.14, 4))); const lid = mesh(G('lid', () => new T.SphereGeometry(0.22, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), steel, x, 0.86, 0); lid.scale.set(1.15, 0.55, 0.8); g.add(lid); g.add(sph(0.025, gold, x, 0.99, 0, 8)); glow(g, 0xff8a3a, 0.35, x, 0.82, 0.12); } },
    bar(g, it){ g.add(box(it.w, 1.06, 0.62, darkwood, 0, 0, -0.08)); g.add(box(it.w + 0.1, 0.05, 0.74, gold, 0, 1.06, -0.08)); g.add(box(it.w - 0.1, 0.02, 0.02, glowM(0xffbf66), 0, 0.12, 0.24)); g.add(box(it.w, 1.7, 0.32, wood, 0, 0, it.d / 2 - 0.18));
      const cols = [0x2f6b4f, 0x8a2a2a, 0xd8b067, 0x3a4a7a, 0xe8e2d0]; for(let i = 0; i < Math.floor((it.w - 0.2) / 0.16); i++) g.add(cyl(0.032, 0.032, 0.26 + (i % 3) * 0.04, M('bt' + i % 5, {color:cols[i % 5], roughness:0.15, metalness:0.1, transparent:true, opacity:0.88}), -it.w / 2 + 0.18 + i * 0.16, 1.7, it.d / 2 - 0.2, 8));
      g.add(box(it.w, 0.03, 0.34, gold, 0, 1.68, it.d / 2 - 0.18)); const n = Math.max(1, Math.floor(it.w / 0.65)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + (i + 0.5) * it.w / n; g.add(cyl(0.18, 0.16, 0.06, maroon, x, 0.74, -it.d / 2 + 0.2, 18)); g.add(cyl(0.022, 0.022, 0.74, gold, x, 0, -it.d / 2 + 0.2, 6)); g.add(cyl(0.16, 0.16, 0.015, gold, x, 0, -it.d / 2 + 0.2, 18)); }
      glow(g, 0xffb35a, 0.5, -it.w / 3, 1.2, -0.1); glow(g, 0xffb35a, 0.5, it.w / 3, 1.2, -0.1); },
    live(g, it){ g.add(box(it.w, 0.86, it.d, cream)); g.add(box(it.w + 0.02, 0.04, it.d + 0.02, steel, 0, 0.86, 0)); g.add(cyl(0.3, 0.3, 0.03, dark, -it.w / 4, 0.9, 0, 24)); g.add(cyl(0.11, 0.02, 0.18, glowM(0xff7a33), -it.w / 4, 0.92, 0, 10)); glow(g, 0xff8a3a, 1.1, -it.w / 4, 1.0, 0); g.add(box(0.6, 0.12, 0.45, steel, it.w / 4, 0.9, 0)); lamp(g, 0xff9a50, 1.1, 5, -it.w / 4, 1.3, 0, 2); },
    dessert(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); g.add(box(it.w + 0.01, 0.06, it.d + 0.01, M('pinkband', {color:0xe9a7b9, roughness:0.8}), 0, 0.7, 0));
      [[-it.w / 4, 0.22, 3, 0xf6d3dc], [0.05, 0.16, 2, 0xfff1d6], [it.w / 4, 0.2, 2, 0xd8b7e6]].forEach(([x, r, n, c], k) => { g.add(cyl(0.02, 0.05, 0.12, gold, x, 0.8, 0, 10)); g.add(cyl(r + 0.03, r + 0.03, 0.01, gold, x, 0.92, 0, 24)); for(let i = 0; i < n; i++) g.add(cyl(r - i * 0.06, r - i * 0.06, 0.12, M('cake' + k, {color:c, roughness:0.7}), x, 0.93 + i * 0.12, 0, 24)); }); },
    tea(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); [-0.42, 0.02].forEach(x => { g.add(cyl(0.15, 0.17, 0.4, steel, x, 0.8, 0)); g.add(cyl(0.02, 0.02, 0.06, steel, x, 1.2, 0, 6)); }); for(let i = 0; i < 6; i++) g.add(cyl(0.035, 0.03, 0.08, ivoryF, 0.38 + (i % 2) * 0.09, 0.8, -0.18 + (i >> 1) * 0.12, 10)); },
    stage(g, it){ g.add(box(it.w, 0.6, it.d, maroon)); g.add(box(it.w + 0.03, 0.06, it.d + 0.03, gold, 0, 0.6, 0)); g.add(box(1.4, 0.2, 0.32, maroon, 0, 0, it.d / 2 + 0.2)); g.add(box(1.4, 0.4, 0.32, maroon, 0, 0, it.d / 2 + 0.02));
      g.add(box(it.w, 3.2, 0.12, M('backdrop', {color:0xf7ebdf, roughness:0.9}), 0, 0.6, -it.d / 2 + 0.06)); g.add(box(it.w + 0.1, 0.12, 0.16, gold, 0, 3.8, -it.d / 2 + 0.06));
      const n = Math.round(it.w * 2.4); for(let i = 0; i < n; i++){ const x = -it.w / 2 + 0.15 + i * (it.w - 0.3) / Math.max(1, n - 1); for(let k = 0; k < 3; k++) g.add(sph(0.09, (i + k) % 3 ? rose : marigold, x, 3.62 - k * 0.18 - 0.22 * Math.sin(i / Math.max(1, n - 1) * Math.PI), -it.d / 2 + 0.16, 8)); }
      [-it.w / 2 + 0.3, it.w / 2 - 0.3].forEach(x => { g.add(cyl(0.05, 0.08, 1.7, gold, x, 0.6, -it.d / 2 + 0.5, 10)); g.add(sph(0.1, glowM(0xffd08a), x, 2.4, -it.d / 2 + 0.5, 10)); glow(g, 0xffc070, 1.4, x, 2.4, -it.d / 2 + 0.5); });
      g.add(box(1.2, 0.9, 0.5, M('sofaW', {color:0xf1e4cc, roughness:0.9}), 0, 0.6, -it.d / 4)); lamp(g, 0xffcf8a, 1.6, 9, 0, 3, 0, 3); },
    dj(g, it){ g.add(box(it.w, 1.0, it.d, dark)); g.add(box(it.w - 0.1, 0.06, 0.02, glowM(0x9a72ff), 0, 0.72, -it.d / 2 - 0.01)); [-0.5, 0.5].forEach(x => g.add(cyl(0.22, 0.22, 0.03, steel, x, 1.0, 0))); g.add(box(0.4, 0.04, 0.3, dark, 0, 1.0, 0));
      [-1, 1].forEach(s => { g.add(box(0.36, 1.6, 0.36, dark, s * (it.w / 2 + 0.3), 0, -it.d / 2 + 0.2)); g.add(cyl(0.12, 0.12, 0.02, steel, s * (it.w / 2 + 0.3), 1.1, -it.d / 2 + 0.38, 16).rotateX(Math.PI / 2)); }); glow(g, 0x9a72ff, 1.2, 0, 0.8, -it.d / 2 - 0.1); lamp(g, 0x9a72ff, 1.2, 6, 0, 1.6, -it.d / 2 - 0.4, 1); },
    dance(g, it){ const t = texCanvas(512, 512, (x, w, h) => { const n = 8; for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){ x.fillStyle = (i + j) % 2 ? '#15111a' : '#f5efe4'; x.fillRect(i * w / n, j * h / n, w / n, h / n); } }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(it.w / 8, it.d / 8);
      g.add(box(it.w, 0.04, it.d, new T.MeshStandardMaterial({map:t, roughness:0.08, metalness:0.25}))); g.add(box(it.w + 0.05, 0.045, 0.04, gold, 0, 0, -it.d / 2)); g.add(box(it.w + 0.05, 0.045, 0.04, gold, 0, 0, it.d / 2)); },
    photobooth(g, it){ g.add(box(it.w, 2.4, 0.08, M('pbd', {color:0xf3cfd9, roughness:0.85}), 0, 0, -it.d / 2 + 0.1)); for(let i = 0; i < 26; i++) g.add(sph(0.09, i % 3 ? rose : ivoryF, -it.w / 2 + 0.15 + (i % 13) * (it.w - 0.3) / 12, 0.5 + Math.floor(i / 13) * 1.5 + (i % 4) * 0.14, -it.d / 2 + 0.16, 8));
      g.add(mesh(new T.TorusGeometry(0.3, 0.025, 8, 32), glowM(0xffffff), 0, 1.5, it.d / 2 - 0.4)); g.add(cyl(0.02, 0.02, 1.2, dark, 0, 0, it.d / 2 - 0.4, 6)); glow(g, 0xfff2e0, 1.0, 0, 1.5, it.d / 2 - 0.4); },
    mandap(g, it){ const x = it.w / 2 - 0.3, z = it.d / 2 - 0.3; g.add(box(it.w, 0.3, it.d, cream)); g.add(box(it.w + 0.02, 0.05, it.d + 0.02, gold, 0, 0.3, 0));
      [[-x, -z], [x, -z], [x, z], [-x, z]].forEach(([a, b]) => { g.add(cyl(0.13, 0.17, 2.8, gold, a, 0.3, b, 16)); g.add(sph(0.24, marigold, a, 3.2, b, 12)); for(let k = 0; k < 9; k++) g.add(sph(0.07, k % 2 ? marigold : ivoryF, a + 0.15, 0.6 + k * 0.28, b, 6)); });
      const roof = mesh(new T.ConeGeometry(Math.max(it.w, it.d) * 0.74, 1.1, 4, 1, true), M('mroof', {color:0xf6e1c3, roughness:0.9, side:T.DoubleSide}), 0, 3.75, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      const drape = M('drape', {color:0xfff4e4, roughness:0.9, transparent:true, opacity:0.55, side:T.DoubleSide}); [[-x, 0, Math.PI / 2], [x, 0, Math.PI / 2]].forEach(([a, b, r]) => { const p = mesh(new T.PlaneGeometry(it.d - 0.6, 2.7), drape, a, 1.7, b, false); p.rotation.y = r; g.add(p); });
      g.add(box(0.62, 0.32, 0.62, M('havan', {color:0x7a4a2a}), 0, 0.3, 0)); g.add(sph(0.12, glowM(0xff7a33), 0, 0.78, 0, 10)); glow(g, 0xff8a3a, 1.4, 0, 0.82, 0); lamp(g, 0xff8a3a, 1.8, 7, 0, 1.0, 0, 4); },
    arch(g, it){ const r = Math.max(0.6, it.w / 2 - 0.2), vine = M('archv', {color:0x4d7340, roughness:0.9}); g.add(mesh(new T.TorusGeometry(r, 0.09, 10, 40, Math.PI), vine, 0, 2.0, 0));
      for(let i = 0; i <= 22; i++){ const a = i / 22 * Math.PI; g.add(sph(0.11, i % 3 ? rose : ivoryF, Math.cos(a) * r, 2.0 + Math.sin(a) * r, 0.03 * (i % 2 ? 1 : -1), 8)); if(i % 2) g.add(sph(0.08, leaf, Math.cos(a) * (r + 0.08), 2.0 + Math.sin(a) * (r + 0.08), -0.06, 6)); }
      [-r, r].forEach(x => { g.add(cyl(0.09, 0.09, 2.0, vine, x, 0, 0, 10)); for(let k = 0; k < 6; k++) g.add(sph(0.09, k % 2 ? rose : leaf2, x + (k % 2 ? 0.06 : -0.06), 0.3 + k * 0.3, 0.04, 6)); }); },
    rangoli(g, it){ const t = texCanvas(1024, 1024, (x, w) => { const c = w / 2, ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill(); };
        ring(500, '#c9184a'); ring(470, '#f6e7c8'); ring(440, '#ff9f1c'); ring(390, '#2a9d8f'); ring(330, '#f6e7c8'); ring(300, '#e71d36');
        for(let i = 0; i < 16; i++){ x.save(); x.translate(c, c); x.rotate(i * Math.PI / 8); x.fillStyle = i % 2 ? '#ffbf00' : '#7b2cbf'; x.beginPath(); x.ellipse(0, -360, 34, 70, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
        for(let i = 0; i < 8; i++){ x.save(); x.translate(c, c); x.rotate(i * Math.PI / 4); x.fillStyle = '#ff8fab'; x.beginPath(); x.ellipse(0, -170, 56, 110, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff1e0'; x.beginPath(); x.ellipse(0, -170, 22, 60, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
        ring(90, '#ffbf00'); ring(50, '#e71d36'); ring(18, '#fff1e0'); });
      const m = new T.MeshStandardMaterial({map:t, transparent:true, roughness:0.95, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}); const c = mesh(new T.CircleGeometry(it.w / 2, 64), m, 0, 0.02, 0, false); c.rotation.x = -Math.PI / 2; g.add(c);
      for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; g.add(cyl(0.05, 0.035, 0.035, M('clay', {color:0xb5653a, roughness:0.9}), Math.cos(a) * it.w * 0.52, 0, Math.sin(a) * it.w * 0.52, 8)); flames.push(mesh(G('dflame', () => new T.ConeGeometry(0.018, 0.07, 8)), glowM(0xffb347), Math.cos(a) * it.w * 0.52, 0.08, Math.sin(a) * it.w * 0.52, false)); g.add(flames[flames.length - 1]); glow(g, 0xff9a40, 0.5, Math.cos(a) * it.w * 0.52, 0.1, Math.sin(a) * it.w * 0.52); } },
    standee(g, it){ const t = texCanvas(512, 640, (x, w, h) => { x.fillStyle = '#f7efe1'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b08a3e'; x.lineWidth = 10; x.strokeRect(24, 24, w - 48, h - 48); x.lineWidth = 3; x.strokeRect(44, 44, w - 88, h - 88); x.fillStyle = '#682127'; x.textAlign = 'center'; x.font = 'italic 500 66px Georgia, serif'; x.fillText('Welcome', w / 2, h * 0.42); x.font = '600 30px -apple-system, system-ui, sans-serif'; x.fillStyle = '#9c7637'; x.fillText(String(ev?.name || 'to the party').slice(0, 22).toUpperCase(), w / 2, h * 0.56); });
      const board = mesh(new T.PlaneGeometry(it.w, it.w * 1.25), new T.MeshStandardMaterial({map:t, roughness:0.8}), 0, 0.5 + it.w * 0.625, 0.03); g.add(board); g.add(box(it.w + 0.06, it.w * 1.25 + 0.06, 0.04, gold, 0, 0.5 - 0.03, 0)); [-it.w / 3, it.w / 3].forEach(x => g.add(cyl(0.015, 0.015, 1.1, gold, x, 0, -0.18, 6))); },
    gift(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); g.add(box(0.36, 0.3, 0.36, rose, -0.4, 0.8, 0)); g.add(box(0.28, 0.24, 0.28, marigold, 0.1, 0.8, -0.05)); g.add(box(0.24, 0.36, 0.24, M('giftb', {color:0x3a6fa8}), 0.5, 0.8, 0.06)); [[-0.4, 0.36], [0.1, 0.28], [0.5, 0.24]].forEach(([x, s]) => g.add(box(0.03, s + 0.02, s + 0.01, gold, x, 0.8, 0))); },
    plant(g, it){ const r = it.w / 2; g.add(cyl(0.24, 0.18, 0.46, M('pot', {color:0xa86b3c, roughness:0.75}), 0, 0, 0, 18)); g.add(cyl(0.25, 0.25, 0.04, M('potrim', {color:0x8d5530}), 0, 0.44, 0, 18));
      [[0, 0.95, 0, 0.55, leaf], [0.22, 1.25, 0.1, 0.42, leaf2], [-0.2, 1.3, -0.12, 0.38, leaf], [0.05, 1.55, -0.05, 0.3, leaf2]].forEach(([x, y, z, s, m]) => g.add(sph(r * s, m, x * r * 2, y, z * r * 2, 12))); },
    fairy(g, it, mood){ const w = it.w, n = Math.max(2, Math.round(w / 1.5)), h = 2.9, pts = []; for(let i = 0; i <= n * 10; i++){ const t = i / (n * 10), x = -w / 2 + t * w, seg = (t * n) % 1; pts.push(new T.Vector3(x, h - 0.5 * 4 * seg * (1 - seg), 0)); }
      g.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length, 0.007, 4), dark, 0, 0, 0, false));
      for(let i = 0; i < pts.length; i += 2){ const p = pts[i]; bulbs.push({g, m:Mx(p.x, p.y - 0.04, 0)}); glow(g, 0xffc766, 0.42, p.x, p.y - 0.04, 0); }
      [-w / 2, w / 2].forEach(x => g.add(cyl(0.03, 0.03, h, dark, x, 0, 0, 6))); },
    lantern(g){ g.add(cyl(0.04, 0.06, 2.4, dark, 0, 0, 0, 8)); g.add(cyl(0.12, 0.12, 0.03, dark, 0, 2.38, 0, 12)); g.add(sph(0.16, glowM(0xffd08a), 0, 2.56, 0, 14)); g.add(cyl(0.05, 0.12, 0.08, dark, 0, 2.7, 0, 12)); glow(g, 0xffb560, 2.2, 0, 2.56, 0); glow(g, 0xffd9a0, 0.7, 0, 2.56, 0, false); lamp(g, 0xffb46b, 1.6, 9, 0, 2.5, 0, 2); },
    uplight(g){ g.add(cyl(0.1, 0.1, 0.16, dark)); const beam = mesh(new T.ConeGeometry(0.6, 2.8, 20, 1, true), new T.MeshBasicMaterial({color:0xd889ff, transparent:true, opacity:0.12, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide}), 0, 1.55, 0, false); beam.rotation.x = Math.PI; beam.userData.beam = true; g.add(beam); glow(g, 0xd889ff, 0.9, 0, 0.2, 0); },
    diyas(g){ [[0, 0], [0.24, 0.1], [-0.24, 0.1], [0.12, -0.2], [-0.12, -0.2]].forEach(([x, z]) => { g.add(cyl(0.07, 0.05, 0.05, M('clay', {color:0xb5653a, roughness:0.9}), x, 0, z, 12)); const fl = mesh(G('dflame', () => new T.ConeGeometry(0.018, 0.07, 8)), glowM(0xffb347), x, 0.09, z, false); g.add(fl); flames.push(fl); glow(g, 0xff9a40, 0.6, x, 0.11, z); }); lamp(g, 0xff9a40, 1.2, 4, 0, 0.35, 0, 1); },
    bonfire(g, it, mood){ const ring = mesh(new T.TorusGeometry(0.56, 0.13, 8, 20), stone, 0, 0.08, 0); ring.rotation.x = Math.PI / 2; g.add(ring); [35, -35, 90].forEach(a => { const l = cyl(0.07, 0.07, 0.95, wood, 0, 0, 0, 8); l.rotation.z = Math.PI / 2; l.rotation.y = a * Math.PI / 180; l.position.y = 0.12; g.add(l); });
      [[0xff5a1f, 0.32, 0.9], [0xff9a2e, 0.22, 0.7], [0xffd36b, 0.12, 0.5]].forEach(([c, r, h]) => { const fl = mesh(new T.ConeGeometry(r, h, 12), new T.MeshBasicMaterial({color:c, transparent:true, opacity:0.85, blending:T.AdditiveBlending, depthWrite:false}), 0, 0.15 + h / 2, 0, false); g.add(fl); flames.push(fl); });
      glow(g, 0xff7a2e, 4.5, 0, 0.6, 0); glow(g, 0xff7a2e, 1.6, 0, 0.6, 0, false); lamp(g, 0xff8a3a, 4, 16, 0, 1.0, 0, 9); },
    fireworks(g, it, mood){ const m = new T.MeshBasicMaterial({color:0xff7a45, transparent:true, opacity:0.55, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}); [[it.w, 0.06, 0, -it.d / 2], [it.w, 0.06, 0, it.d / 2], [0.06, it.d, -it.w / 2, 0], [0.06, it.d, it.w / 2, 0]].forEach(([a, b, x, z]) => { const p = mesh(new T.PlaneGeometry(a, b), m, x, 0.03, z, false); p.rotation.x = -Math.PI / 2; g.add(p); });
      for(let i = 0; i < 6; i++) g.add(cyl(0.07, 0.07, 0.3, M('fw' + i % 3, {color:[0xc0392b, 0xf1c40f, 0x2e86c1][i % 3], roughness:0.6}), (i % 3 - 1) * 0.5, 0, (i < 3 ? -1 : 1) * 0.4, 10));
      if(mood !== 'day') bursts.push({g, w:it.w, d:it.d}); },
    tent(g, it){ const fab = M('tent', {color:0xfbf7f0, roughness:0.95, side:T.DoubleSide, transparent:true, opacity:0.88}); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => g.add(cyl(0.06, 0.06, 3.2, gold, a * it.w / 2, 0, b * it.d / 2, 8)));
      const roof = mesh(new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true), fab, 0, 3.2 + 0.9, 0, false); roof.rotation.y = Math.PI / 4; roof.scale.set(it.w, 1.8, it.d); g.add(roof);
      const val = M('valance', {color:0x8c1c3f, roughness:0.85, side:T.DoubleSide}); [[it.w, 0, -it.d / 2, 0], [it.w, 0, it.d / 2, 0], [it.d, -it.w / 2, 0, Math.PI / 2], [it.d, it.w / 2, 0, Math.PI / 2]].forEach(([l, x, z, r]) => { const p = mesh(new T.PlaneGeometry(l, 0.35), val, x, 3.05, z, false); p.rotation.y = r; g.add(p); }); },
    entry(g, it){ const w = it.w; [-1, 1].forEach(s => { g.add(box(0.34, 2.9, 0.34, cream, s * (w / 2 - 0.17), 0, 0)); g.add(box(0.4, 0.1, 0.4, gold, s * (w / 2 - 0.17), 2.9, 0)); g.add(cyl(0.16, 0.2, 0.5, M('urn', {color:0xb87333, roughness:0.4, metalness:0.6}), s * (w / 2 + 0.3), 0, 0.3, 14)); g.add(sph(0.22, leaf, s * (w / 2 + 0.3), 0.72, 0.3, 10)); });
      g.add(box(w, 0.3, 0.38, gold, 0, 2.95, 0)); const n = Math.round(w * 5); for(let i = 0; i < n; i++){ const t = i / Math.max(1, n - 1); for(let k = 0; k < 4; k++) g.add(sph(0.06, (i + k) % 2 ? marigold : ivoryF, -w / 2 + 0.1 + t * (w - 0.2), 2.85 - k * 0.11 - 0.35 * Math.sin(t * Math.PI), 0.22, 6)); }
      [-w / 2 + 0.17, w / 2 - 0.17].forEach(x => { glow(g, 0xffc070, 0.9, x, 2.6, 0.25); }); },
    exit(g, it){ g.add(box(0.2, 2.2, 0.2, cream, -it.w / 2 + 0.1, 0, 0)); g.add(box(0.2, 2.2, 0.2, cream, it.w / 2 - 0.1, 0, 0)); g.add(box(0.8, 0.25, 0.04, glowM(0x2fbf71), 0, 2.25, 0)); glow(g, 0x2fbf71, 0.9, 0, 2.37, 0); },
    washroom(g, it){ g.add(box(it.w, 2.5, it.d, cream)); g.add(box(it.w + 0.06, 0.08, it.d + 0.06, gold, 0, 2.5, 0)); [-it.w / 4, it.w / 4].forEach(x => g.add(box(0.8, 2.0, 0.04, wood, x, 0, it.d / 2 + 0.01))); },
    generator(g, it){ g.add(box(it.w, 1.2, it.d, M('gen', {color:0x5b6670, roughness:0.55, metalness:0.45}))); g.add(box(it.w * 0.6, 0.02, 0.3, dark, 0, 1.2, 0)); },
    speaker(g){ g.add(box(0.45, 1.5, 0.4, dark)); g.add(cyl(0.13, 0.13, 0.02, steel, 0, 1.0, 0.2, 16).rotateX(Math.PI / 2)); g.add(cyl(0.07, 0.07, 0.02, steel, 0, 1.35, 0.2, 16).rotateX(Math.PI / 2)); },
    screen(g, it, mood){ g.add(box(it.w + 0.12, 2.4, 0.14, dark, 0, 0.8, 0)); const t = texCanvas(768, 432, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3a0f1e'); gr.addColorStop(1, '#a3532f'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#f9e2b0'; x.textAlign = 'center'; x.font = 'italic 500 64px Georgia, serif'; x.fillText(String(ev?.name || 'Celebrate').slice(0, 24), w / 2, h * 0.55); x.font = '600 20px system-ui'; x.fillStyle = '#e9c98c'; x.fillText('EKĀYA EVENTS', w / 2, h * 0.72); });
      g.add(mesh(new T.PlaneGeometry(it.w, 2.2), new T.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, emissiveIntensity:mood === 'day' ? 0.5 : 1.1, roughness:0.4}), 0, 2.0, 0.075)); g.add(box(0.1, 0.8, 0.1, dark, -it.w / 3, 0, 0)); g.add(box(0.1, 0.8, 0.1, dark, it.w / 3, 0, 0)); },
    parking(g, it){ const m = new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.65, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}); const n = Math.max(1, Math.floor(it.w / 2.5)); for(let i = 1; i < n; i++){ const p = mesh(new T.PlaneGeometry(0.1, it.d * 0.55), m, -it.w / 2 + i * it.w / n, 0.03, -it.d / 2 + it.d * 0.275, false); p.rotation.x = -Math.PI / 2; g.add(p); }
      const asphalt = mesh(new T.PlaneGeometry(it.w, it.d), M('asph', {color:0x4a4a4e, roughness:0.95, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}), 0, 0.015, 0, false); asphalt.rotation.x = -Math.PI / 2; g.add(asphalt); },
    pillar(g){ g.add(box(0.5, 3.4, 0.5, cream)); g.add(box(0.62, 0.12, 0.62, gold, 0, 3.4, 0)); g.add(box(0.62, 0.12, 0.62, cream, 0, 0, 0)); },
    wall(g, it){ g.add(box(it.w, 2.4, it.d, cream)); g.add(box(it.w + 0.02, 0.06, it.d + 0.02, gold, 0, 2.4, 0)); },
    zone(g, it){ const p = mesh(new T.PlaneGeometry(it.w, it.d), new T.MeshBasicMaterial({color:0x4f8b76, transparent:true, opacity:0.16, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3}), 0, 0.03, 0, false); p.rotation.x = -Math.PI / 2; g.add(p); },
    label(){}
  };
  const FLAT = new Set(['fairy', 'zone', 'tent', 'parking', 'dance', 'rangoli', 'fireworks', 'label', 'uplight', 'diyas', 'lantern', 'entry', 'exit', 'standee', 'arch']);

  function groundTexture(kind){
    const draws = {
      lawn:(x, w, h) => { x.fillStyle = '#6c9a4f'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(140,190,100,.22)'; for(let i = 0; i < 8; i += 2) x.fillRect(i * w / 8, 0, w / 8, h); for(let i = 0; i < 9000; i++){ x.fillStyle = `rgba(${40 + Math.random() * 50},${90 + Math.random() * 70},${30 + Math.random() * 30},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 3.5); } },
      terrace:(x, w, h) => { const n = 8, s = w / n; for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){ const l = 80 + Math.random() * 5; x.fillStyle = `hsl(34,22%,${l}%)`; x.fillRect(i * s, j * s, s, s); } x.strokeStyle = 'rgba(90,70,50,.32)'; x.lineWidth = 3; for(let i = 0; i <= n; i++){ x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); } },
      marble:(x, w, h) => { x.fillStyle = '#f1ebe3'; x.fillRect(0, 0, w, h); for(let i = 0; i < 22; i++){ x.strokeStyle = `rgba(130,120,110,${0.08 + Math.random() * 0.18})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for(let k = 0; k < 8; k++){ px += (Math.random() - 0.3) * 110; py += (Math.random() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); } x.strokeStyle = 'rgba(120,100,80,.12)'; x.lineWidth = 2; for(let i = 0; i <= 2; i++){ x.beginPath(); x.moveTo(i * w / 2, 0); x.lineTo(i * w / 2, h); x.moveTo(0, i * h / 2); x.lineTo(w, i * h / 2); x.stroke(); } },
      wood:(x, w, h) => { for(let j = 0; j < 16; j++){ x.fillStyle = `hsl(27,${36 + Math.random() * 12}%,${38 + Math.random() * 9}%)`; x.fillRect(0, j * h / 16, w, h / 16 - 3); const off = Math.random() * w; x.fillStyle = 'rgba(40,20,10,.35)'; x.fillRect(off, j * h / 16, 3, h / 16); } },
      carpet:(x, w, h) => { x.fillStyle = '#6a2234'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(232,190,120,.38)'; x.lineWidth = 3; for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++){ const cx = (i + 0.5) * w / 8, cy = (j + 0.5) * h / 8, r = w / 22; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.stroke(); x.fillStyle = 'rgba(232,190,120,.25)'; x.beginPath(); x.arc(cx, cy, 4, 0, 7); x.fill(); } },
      sand:(x, w, h) => { x.fillStyle = '#d9c39a'; x.fillRect(0, 0, w, h); for(let i = 0; i < 6000; i++){ x.fillStyle = `rgba(120,90,50,${Math.random() * 0.22})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
      plain:(x, w, h) => { x.fillStyle = '#ebe5dc'; x.fillRect(0, 0, w, h); }
    };
    const t = texCanvas(1024, 1024, draws[kind] || draws.plain); t.wrapS = t.wrapT = T.RepeatWrapping;
    const rep = {lawn:8, terrace:4.8, marble:4, wood:4, carpet:9.6, sand:4, plain:10}[kind] || 10; t.repeat.set(W / rep, H / rep); return t;
  }
  function labelSprite(text, mood){
    const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 320; c.height = 112;
    const font = '650 46px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif'; x.font = font; const tw = Math.min(300, x.measureText(text).width + 44);
    const day = mood === 'day'; x.fillStyle = day ? 'rgba(255,250,242,.94)' : 'rgba(22,14,18,.82)';
    const r = 34, bx = (320 - tw) / 2, y0 = 22, y1 = 90; x.beginPath(); x.moveTo(bx + r, y0); x.arcTo(bx + tw, y0, bx + tw, y1, r); x.arcTo(bx + tw, y1, bx, y1, r); x.arcTo(bx, y1, bx, y0, r); x.arcTo(bx, y0, bx + tw, y0, r); x.fill();
    x.strokeStyle = day ? 'rgba(104,33,39,.25)' : 'rgba(235,207,152,.35)'; x.lineWidth = 2; x.stroke();
    x.font = font; x.fillStyle = day ? '#682127' : '#EBCF98'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 58);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    const s = new T.Sprite(new T.SpriteMaterial({map:t, depthTest:false, transparent:true, toneMapped:false, sizeAttenuation:false})); s.scale.set(0.062, 0.0217, 1); s.renderOrder = 10; return s;
  }

  /* ---------- sky, stars, environment ---------- */
  const skyMat = new T.ShaderMaterial({uniforms:{top:{value:new T.Color()}, hor:{value:new T.Color()}, bot:{value:new T.Color()}, ex:{value:0.5}},
    vertexShader:'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform float ex; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(h, ex)) : mix(hor, bot, pow(min(1.0, -h * 3.0), 0.6)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}',
    side:T.BackSide, depthWrite:false, fog:false});
  const sky = new T.Mesh(new T.SphereGeometry(span * 16, 32, 16), skyMat); sky.position.set(CX, 0, CZ); sky.renderOrder = -1; scene.add(sky);
  const stars = (() => { const n = 900, p = new Float32Array(n * 3); for(let i = 0; i < n; i++){ const u = Math.random(), v = Math.random() * 0.9 + 0.08, th = u * Math.PI * 2, r = span * 14; const y = Math.pow(v, 1.4); const q = Math.sqrt(1 - y * y); p.set([CX + Math.cos(th) * q * r, y * r, CZ + Math.sin(th) * q * r], i * 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); return new T.Points(g, new T.PointsMaterial({color:0xfff6e0, size:1.6, sizeAttenuation:false, transparent:true, opacity:0.85, fog:false, depthWrite:false})); })();
  scene.add(stars);
  const pmrem = new T.PMREMGenerator(renderer); let envRT = null;
  function makeEnv(mood){
    const es = new T.Scene(), m = skyMat.clone(); m.uniforms.top.value.copy(skyMat.uniforms.top.value); m.uniforms.hor.value.copy(skyMat.uniforms.hor.value); m.uniforms.bot.value.copy(skyMat.uniforms.bot.value); m.uniforms.ex.value = skyMat.uniforms.ex.value;
    es.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), m));
    const panel = (c, i, x, y, z) => { const p = new T.Mesh(new T.PlaneGeometry(14, 6), new T.MeshBasicMaterial({color:c, side:T.DoubleSide, toneMapped:false})); p.material.color.multiplyScalar(i); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p); };
    if(mood === 'day'){ panel(0xffffff, 1.6, 18, 30, -20); panel(0xfff3e0, 0.9, -30, 14, 10); }
    else if(mood === 'dusk'){ panel(0xffb27a, 1.4, -26, 6, -28); }
    else { panel(0xffc27a, 0.5, 0, 18, 0); }
    if(envRT) envRT.dispose(); envRT = pmrem.fromScene(es, 0.03); scene.environment = envRT.texture;
    es.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
  }

  /* ---------- the scene ---------- */
  let root = null, labelGroup = null, sun, hemi, fill, surround, slab, mood = opts.mood, glowObjs = [], lightObjs = [], inst = [], fw = [];
  const hitList = [];
  function populate(){
    if(root){ scene.remove(root); root.traverse(o => { if(o.geometry && !Object.values(geo).includes(o.geometry) && o.geometry !== chairFrame && o.geometry !== chairPad && o.geometry !== plateGeo && o.geometry !== bulbGeo) o.geometry.dispose(); if(o.material && o.material.map && !Object.values(mats).includes(o.material)) o.material.map.dispose(); }); }
    reset(); hitList.length = 0; fw = [];
    root = new T.Group(); labelGroup = new T.Group();
    // floor slab with the plan's ground on top, and a low parapet or hedge on the edge
    const ground = mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({map:groundTexture(plan.ground || 'plain'), roughness:plan.ground === 'marble' ? 0.35 : plan.ground === 'wood' ? 0.6 : 0.92, metalness:0}), CX, 0.001, CZ, false); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
    root.add(mesh(new T.BoxGeometry(W + 0.5, 0.22, H + 0.5), M('slab', {color:0xd8cbb7, roughness:0.85}), CX, -0.14, CZ, false));   // top sits 3 cm under the floor so the two never fight
    const lawn = plan.ground === 'lawn', sandy = plan.ground === 'sand';
    if(!sandy){ const em = lawn ? M('hedge', {color:0x2f5a2c, roughness:0.95}) : M('parapet', {color:0xeadfcd, roughness:0.8}), eh = lawn ? 0.55 : 0.42, et = lawn ? 0.4 : 0.16;
      const doors = (plan.items || []).filter(i => i.type === 'entry' || i.type === 'exit');
      const run = (len, place) => { const gaps = []; doors.forEach(d => { const g = place.gap(d); if(g) gaps.push(g); }); gaps.sort((a, b) => a[0] - b[0]); let s = 0; [...gaps, [len, len]].forEach(([a, b]) => { if(a - s > 0.05) place.seg(s, a); s = Math.max(s, b); }); };
      const seg = (x, z, w, d) => { const m = mesh(new T.BoxGeometry(w, eh, d), em, x, eh / 2, z); root.add(m); if(!lawn) root.add(mesh(new T.BoxGeometry(w + 0.03, 0.04, d + 0.03), gold, x, eh + 0.02, z, false)); };
      const near = (d, axis, v) => Math.abs((axis === 'z' ? d.y : d.x) - v) < 1.2;
      run(W, {gap:d => near(d, 'z', 0) ? [d.x - d.w / 2, d.x + d.w / 2] : null, seg:(a, b) => seg((a + b) / 2, -et / 2, b - a, et)});
      run(W, {gap:d => near(d, 'z', H) ? [d.x - d.w / 2, d.x + d.w / 2] : null, seg:(a, b) => seg((a + b) / 2, H + et / 2, b - a, et)});
      run(H, {gap:d => near(d, 'x', 0) ? [d.y - d.w / 2, d.y + d.w / 2] : null, seg:(a, b) => seg(-et / 2, (a + b) / 2, et, b - a)});
      run(H, {gap:d => near(d, 'x', W) ? [d.y - d.w / 2, d.y + d.w / 2] : null, seg:(a, b) => seg(W + et / 2, (a + b) / 2, et, b - a)}); }
    (plan.items || []).forEach(it => {
      const g = new T.Group(), fn = B[it.type]; if(!fn) return;
      fn(g, it, mood);
      g.position.set(it.x, 0, it.y); g.rotation.y = -(it.rot || 0) * Math.PI / 180; g.userData.item = it; root.add(g); items.push(g); hitList.push(g);
      if(!FLAT.has(it.type)){ const cs = mesh(G('cshadow', () => new T.PlaneGeometry(1, 1)), new T.MeshBasicMaterial({map:shadowTex, transparent:true, depthWrite:false, opacity:mood === 'day' ? 0.32 : 0.55, color:0x000000, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}), 0, 0.01, 0, false); cs.rotation.x = -Math.PI / 2; cs.scale.set(it.w * 1.25, it.d * 1.25, 1); cs.receiveShadow = false; g.add(cs); }
      const lbl = E.venue.labelOf(it); if(lbl){ const s = labelSprite(lbl, mood); const top = {stage:4.3, mandap:4.6, tent:5.2, entry:3.6, screen:3.6, fairy:3.3, lantern:3.1, photobooth:2.9, arch:3.1, label:1.2}[it.type] || 1.75; s.position.set(it.x, top, it.y); labelGroup.add(s); }
    });
    root.updateMatrixWorld(true);
    // instanced chairs, cushions, plates and bulbs
    inst = [];
    const instanced = (list, g, m, cast=true) => { if(!list.length) return null; const im = new T.InstancedMesh(g, m, list.length); const tmp = new T.Matrix4(); list.forEach((c, i) => { tmp.multiplyMatrices(c.g.matrixWorld, c.m); im.setMatrixAt(i, tmp); }); im.instanceMatrix.needsUpdate = true; im.castShadow = cast; im.receiveShadow = true; im.userData.owners = list.map(c => c.g); root.add(im); inst.push(im); hitList.push(im); return im; };
    instanced(chairs, chairFrame, gold); instanced(chairs, chairPad, cushion); instanced(plates, plateGeo, M('charger', {color:0xcaa25a, roughness:0.32, metalness:0.85}), false); instanced(bulbs, bulbGeo, glowM(0xffd27a), false);
    // glows: one additive point cloud per colour and size
    glowObjs = [];
    glows.forEach((list, key) => { const [c, size, nightOnly] = key.split('|'); const p = new Float32Array(list.length * 3); list.forEach((x, i) => { v3.copy(x.p).applyMatrix4(x.g.matrixWorld); p.set([v3.x, v3.y, v3.z], i * 3); });
      const geo2 = new T.BufferGeometry(); geo2.setAttribute('position', new T.BufferAttribute(p, 3));
      const pm = new T.Points(geo2, new T.PointsMaterial({map:glowTex, color:+c, size:+size, sizeAttenuation:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending, opacity:1})); pm.userData.nightOnly = nightOnly === '1'; pm.userData.base = +size; pm.renderOrder = 5; root.add(pm); glowObjs.push(pm); });
    // the most important lamps become real lights (phones get fewer)
    lightObjs = [];
    const cap = mobile ? 4 : 8, chosen = [];
    [...lightsWanted].sort((a, b) => b.pri - a.pri).forEach(l => { if(chosen.length >= cap) return; v3.copy(l.p).applyMatrix4(l.g.matrixWorld); if(chosen.some(c => c.w.distanceTo(v3) < 3.5)) return; chosen.push({...l, w:v3.clone()}); });
    chosen.forEach(l => { const pl = new T.PointLight(l.color, l.intensity * 0.8, l.dist, 2); pl.position.copy(l.w); pl.userData = {base:l.intensity * 0.8, flicker:l.pri >= 4}; root.add(pl); lightObjs.push(pl); });
    // fireworks
    bursts.forEach(b => { for(let k = 0; k < 3; k++){ const n = 140, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.BufferAttribute(pos, 3)); g2.setAttribute('color', new T.BufferAttribute(col, 3));
      const pts = new T.Points(g2, new T.PointsMaterial({size:0.45, map:glowTex, vertexColors:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending, sizeAttenuation:true})); pts.frustumCulled = false; root.add(pts);
      const o = new T.Vector3(); b.g.getWorldPosition(o); fw.push({pts, o, n, v:new Float32Array(n * 3), t:-k * 0.9 - Math.random(), life:2.4, w:b.w, d:b.d}); } });
    root.add(labelGroup); labelGroup.visible = opts.labels;
    scene.add(root);
  }
  function setMood(m){
    mood = m; const P = MOODS[m];
    const lin = h => new T.Color().setHex(h).convertSRGBToLinear();
    skyMat.uniforms.top.value.copy(lin(P.sky[0])); skyMat.uniforms.hor.value.copy(lin(P.sky[1])); skyMat.uniforms.bot.value.copy(lin(P.sky[2])); skyMat.uniforms.ex.value = P.ex;
    scene.fog = new T.Fog(lin(P.sky[1]), span * 2.2, span * 8);
    if(!hemi){ hemi = new T.HemisphereLight(); scene.add(hemi); sun = new T.DirectionalLight(); scene.add(sun); scene.add(sun.target); fill = new T.DirectionalLight(0xffc98a, 0); fill.position.set(CX + span * 0.35, 7, CZ + span * 0.45);   // warm string-light glow from a low angle, so table sides read warm at night fill.target.position.set(CX, 0, CZ); scene.add(fill); scene.add(fill.target);
      surround = mesh(new T.CircleGeometry(span * 15, 64), new T.MeshStandardMaterial({color:0xffffff, roughness:1}), CX, -0.3, CZ, false); surround.rotation.x = -Math.PI / 2; surround.receiveShadow = true; scene.add(surround); }
    hemi.color.setHex(P.hemi[0]); hemi.groundColor.setHex(P.hemi[1]); hemi.intensity = P.hemi[2];
    const el = P.sun[2] * Math.PI / 180, az = P.sun[3] * Math.PI / 180, d = span * 1.6;
    sun.color.setHex(P.sun[0]); sun.intensity = P.sun[1]; sun.position.set(CX + Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d + 2, CZ + Math.cos(el) * Math.cos(az) * d); sun.target.position.set(CX, 0, CZ);
    sun.castShadow = m !== 'night'; const sm = mobile ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm); const sc = sun.shadow.camera, e = span * 0.78; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 0.5; sc.far = d * 3; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3; sc.updateProjectionMatrix();
    if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
    fill.intensity = m === 'night' ? 0.46 : m === 'dusk' ? 0.18 : 0;
    surround.material.color.copy(lin(P.surround));
    renderer.toneMappingExposure = P.exposure;
    stars.visible = P.stars;
    makeEnv(m);
    populate();
    root.traverse(o => { if(o.material && o.material.isMeshStandardMaterial){ o.material.envMapIntensity = P.env; } });
    glowObjs.forEach(g => { g.visible = !g.userData.nightOnly || P.lamps; g.material.opacity = g.userData.nightOnly ? P.glow : 1; });
    lightObjs.forEach(l => { l.visible = P.lamps; });
  }

  /* ---------- camera moves ---------- */
  let tween = null, mode = 'orbit';
  const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function flyTo(pos, target, ms=900, done){ const p0 = camera.position.clone(), t0 = controls.target.clone(), s = performance.now(); tween = {step:now => { const k = Math.min(1, (now - s) / ms), e2 = ease(k); camera.position.lerpVectors(p0, pos, e2); controls.target.lerpVectors(t0, target, e2); if(k >= 1){ tween = null; done && done(); } }}; }
  const homeTarget = () => new T.Vector3(CX, 0.4, CZ);
  const setFov = v => { if(camera.fov !== v){ camera.fov = v; camera.updateProjectionMatrix(); } };
  function orbit(ms=1000){ mode = 'orbit'; walk.on = false; setFov(40); controls.enabled = true; flyTo(homePos(), homeTarget(), ms, () => { controls.autoRotate = !opts.touched; }); }
  function top(){ mode = 'top'; walk.on = false; setFov(40); controls.enabled = true; controls.autoRotate = false; const side = portrait() && W > H ? new T.Vector3(0.012, 1, 0) : new T.Vector3(0, 1, 0.012); side.normalize(); const tg = new T.Vector3(CX, 0, CZ); flyTo(tg.clone().addScaledVector(side, fitDist(side, tg, 0.9)), tg, 900); }
  function focus(g){
    const it = g.userData.item, size = Math.max(it.w, it.d), dist = Math.max(3.2, size * 2.1), tgt = new T.Vector3(it.x, Math.min(1.2, 0.35 + size * 0.12), it.y);
    const dir = camera.position.clone().sub(controls.target).normalize(); if(dir.y < 0.35){ dir.y = 0.45; dir.normalize(); }
    mode = 'orbit'; controls.autoRotate = false; flyTo(tgt.clone().addScaledVector(dir, dist), tgt, 800);
  }
  /* walk-in: guest's-eye height, drag to look, tap the floor to walk there */
  const walk = {on:false, yaw:0, pitch:-0.08, pos:new T.Vector3(), goal:null};
  function enterWalk(){
    mode = 'walk'; controls.enabled = false; controls.autoRotate = false;
    const en = (plan.items || []).find(i => i.type === 'entry'), sx = en ? en.x : CX, sz = en ? en.y : H - 0.4;
    const toC = new T.Vector2(CX - sx, CZ - sz); const L = toC.length() || 1, ux = toC.x / L, uz = toC.y / L;
    const solid = (plan.items || []).filter(i => !FLAT.has(i.type) && !['stage', 'mandap', 'baithak'].includes(i.type));
    const clear = (x, z) => solid.every(i => Math.hypot(i.x - x, i.y - z) > Math.max(i.w, i.d) / 2 + 0.7);
    let k = 0.7; for(let d = 0.7; d < Math.min(6, L); d += 0.25){ if(clear(sx + ux * d, sz + uz * d)){ k = d; break; } }
    const start = new T.Vector3(sx + ux * k, 1.62, sz + uz * k); setFov(56);
    walk.yaw = Math.atan2(CX - start.x, CZ - start.z); walk.pitch = -0.17; walk.pos.copy(start); walk.goal = null;
    const look = start.clone().add(new T.Vector3(Math.sin(walk.yaw), Math.tan(walk.pitch), Math.cos(walk.yaw)));
    flyTo(start, look, 1300, () => { walk.on = true; });
  }
  const walkDir = () => new T.Vector3(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch));
  const clampPos = p => { p.x = Math.max(0.3, Math.min(W - 0.3, p.x)); p.z = Math.max(0.3, Math.min(H - 0.3, p.z)); return p; };
  function stepWalk(dt){
    if(!walk.on){ camera.lookAt(controls.target); return; }
    if(walk.goal){ const d = walk.goal.clone().sub(walk.pos); d.y = 0; const L = d.length(); if(L < 0.05) walk.goal = null; else walk.pos.addScaledVector(d, Math.min(1, dt * 2.4)); }
    camera.position.copy(walk.pos); controls.target.copy(walk.pos).add(walkDir()); camera.lookAt(controls.target);
  }

  /* ---------- pointer: tap to focus, walk controls ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  let down = null, pinch = null; const ptrs = new Map();
  const toNdc = e => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const pick = e => { toNdc(e); ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(hitList, true); for(const h of hits){ let o = h.object; if(o.isInstancedMesh && h.instanceId != null) return o.userData.owners[h.instanceId]; while(o && !o.userData.item) o = o.parent; if(o) return o; } return null; };
  canvas.addEventListener('pointerdown', e => { opts.touched = true; controls.autoRotate = false; tween && mode !== 'walk' && (tween = null); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); down = {x:e.clientX, y:e.clientY, t:performance.now(), moved:false, yaw:walk.yaw, pitch:walk.pitch}; if(ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } opts.onTouch && opts.onTouch(); });
  canvas.addEventListener('pointermove', e => { if(!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); if(!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; if(Math.hypot(dx, dy) > 6) down.moved = true;
    if(mode === 'walk' && walk.on){ if(ptrs.size === 2 && pinch){ const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); clampPos(walk.pos.addScaledVector(new T.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)), (d - pinch) * 0.02)); pinch = d; walk.goal = null; }
      else if(ptrs.size === 1){ walk.yaw = down.yaw - dx * 0.0045; walk.pitch = Math.max(-0.7, Math.min(0.55, down.pitch + dy * 0.0035)); } } });
  const up = e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if(ptrs.size < 2) pinch = null; if(!was || !down) return; const d = down; if(ptrs.size === 0) down = null;
    if(d.moved || performance.now() - d.t > 450) return;
    if(mode === 'walk' && walk.on){ toNdc(e); ray.setFromCamera(ndc, camera); const p = new T.Vector3(); if(ray.ray.intersectPlane(floor, p)){ walk.goal = clampPos(new T.Vector3(p.x, 1.6, p.z)); opts.onPick && opts.onPick(null); } return; }
    const g = pick(e); if(g){ focus(g); opts.onPick && opts.onPick(g.userData.item); } else opts.onPick && opts.onPick(null); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if(mode !== 'walk' || !walk.on) return; e.preventDefault(); clampPos(walk.pos.addScaledVector(new T.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)), -e.deltaY * 0.01)); walk.goal = null; }, {passive:false});
  const keys = new Set(); const kd = e => { if(/^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/i.test(e.key)){ keys.add(e.key.toLowerCase()); } }; const ku = e => keys.delete(e.key.toLowerCase());
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);

  /* ---------- loop ---------- */
  setMood(mood);
  let raf = 0, last = performance.now(), t0 = last, frames = 0, slow = 0;
  const size = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  size(); const ro = new ResizeObserver(size); ro.observe(canvas);
  // fly in from high above
  { const d0 = homeDir(); camera.position.copy(new T.Vector3(CX, 0, CZ).addScaledVector(new T.Vector3(d0.x * 0.3, 0.95, d0.z * 0.3).normalize(), homeDist() * 1.8)); controls.target.copy(homeTarget()); camera.lookAt(controls.target); }
  orbit(1900);
  const tick = now => {
    raf = requestAnimationFrame(tick);
    if(document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
    // drop resolution once if the device struggles
    frames++; if(dt > 0.034) slow++; if(frames === 90 && slow > 45 && dpr > 1){ dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); size(); }
    lightObjs.forEach(l => { if(l.userData.flicker) l.intensity = l.userData.base * (0.86 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.07); });
    flames.forEach((fl, i) => { fl.scale.y = 0.88 + Math.sin(t * 9 + i * 1.7) * 0.14; });
    if(mode === 'walk' && walk.on && keys.size){ const f2 = new T.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)), r2 = new T.Vector3(-f2.z, 0, f2.x); keys.forEach(k => { if(k === 'w' || k === 'arrowup') walk.pos.addScaledVector(f2, dt * 2.6); if(k === 's' || k === 'arrowdown') walk.pos.addScaledVector(f2, -dt * 2.6); if(k === 'a') walk.pos.addScaledVector(r2, -dt * 2); if(k === 'd') walk.pos.addScaledVector(r2, dt * 2); if(k === 'arrowleft') walk.yaw += dt * 1.6; if(k === 'arrowright') walk.yaw -= dt * 1.6; }); clampPos(walk.pos); walk.goal = null; }
    fw.forEach(b => { b.t += dt; const pa = b.pts.geometry.attributes.position, ca = b.pts.geometry.attributes.color; if(b.t < 0){ b.pts.visible = false; return; }
      if(b.t > b.life || !b.seeded){ b.t = b.seeded ? -Math.random() * 1.2 : b.t; b.seeded = true; const ox = b.o.x + (Math.random() - 0.5) * b.w, oz = b.o.z + (Math.random() - 0.5) * b.d, oy = 11 + Math.random() * 6, c = new T.Color().setHSL(Math.random(), 0.85, 0.62), sp = 3 + Math.random() * 2.5;
        for(let i = 0; i < b.n; i++){ const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u); b.v.set([Math.cos(th) * q * sp, u * sp, Math.sin(th) * q * sp], i * 3); pa.array.set([ox, oy, oz], i * 3); ca.array.set([c.r, c.g, c.b], i * 3); } pa.needsUpdate = ca.needsUpdate = true; return; }
      b.pts.visible = mood !== 'day'; for(let i = 0; i < b.n; i++){ b.v[i * 3 + 1] -= 3.2 * dt; pa.array[i * 3] += b.v[i * 3] * dt; pa.array[i * 3 + 1] += b.v[i * 3 + 1] * dt; pa.array[i * 3 + 2] += b.v[i * 3 + 2] * dt; b.v[i * 3] *= 0.985; b.v[i * 3 + 2] *= 0.985; } pa.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.t / b.life); });
    if(tween) tween.step(now);
    if(mode === 'walk') stepWalk(dt); else controls.update();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return {
    setMood:m => setMood(m),
    setLabels:v => { opts.labels = v; if(labelGroup) labelGroup.visible = v; },
    orbit:() => orbit(900), top, walk:enterWalk, mode:() => mode,
    snapshot:() => new Promise(res => {
      renderer.render(scene, camera);
      const w = canvas.width, h = canvas.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
      const g = x.createLinearGradient(0, h * 0.72, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = g; x.fillRect(0, h * 0.72, w, h * 0.28);
      const u = Math.max(1, w / 900); x.fillStyle = '#F7EEDD'; x.font = `500 ${Math.round(44 * u)}px "New York", Newsreader, Georgia, serif`; x.fillText(ev?.name || plan.name || 'Venue', 32 * u, h - 52 * u);
      x.font = `650 ${Math.round(15 * u)}px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif`; x.fillStyle = '#EBCF98'; x.fillText(`${(plan.name || 'Venue').toUpperCase()}  ·  EKĀYA EVENTS`, 33 * u, h - 26 * u);
      c.toBlob(res, 'image/jpeg', 0.92);
    }),
    dispose:() => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); controls.dispose(); if(envRT) envRT.dispose(); pmrem.dispose(); scene.traverse(o => { o.geometry && o.geometry.dispose(); }); renderer.dispose(); }
  };
}

const MOOD_UI = [['day', 'light_mode', 'Day'], ['dusk', 'wb_twilight', 'Golden hour'], ['night', 'dark_mode', 'Night']];
const VIEW_UI = [['orbit', '3d_rotation', 'Orbit'], ['top', 'crop_free', 'Top'], ['walk', 'directions_walk', 'Walk in']];
const HINTS = {orbit:'Drag to turn · pinch to zoom · tap a table to look closer', top:'Drag to move around · pinch to zoom', walk:'Drag to look around · tap the floor to walk there'};
E.venue3d = {
  open(plan, ev){
    if(cur) return;
    const hr = new Date().getHours(), mood0 = hr >= 19 || hr < 6 || ev?.type === 'diwali' ? 'night' : hr >= 17 ? 'dusk' : 'day';
    const ov = document.createElement('div'); ov.className = 'v3d mood-' + mood0; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '3D view of the venue');
    ov.innerHTML = `<canvas></canvas><div class="v3d-loading"><span class="v3d-spin"></span><b>Setting the scene…</b></div>
      <div class="v3d-bar"><button class="v3d-ib" data-x="close" aria-label="Close 3D view" type="button">${icon('close')}</button><div class="v3d-title"><small>3D view · ${esc(plan.name || 'Venue')}</small><b>${esc(ev?.name || plan.name || 'Venue')}</b></div>
        <button class="v3d-ib" data-x="labels" aria-label="Show labels" aria-pressed="true" type="button">${icon('label')}</button><button class="v3d-ib" data-x="snap" aria-label="Save a picture" type="button">${icon('photo_camera')}</button></div>
      <div class="v3d-card" hidden></div>
      <div class="v3d-hint">${HINTS.orbit}</div>
      <div class="v3d-foot"><div class="v3d-seg" data-g="view">${VIEW_UI.map(([k, ic, l]) => `<button type="button" data-x="${k}" aria-pressed="${k === 'orbit'}">${icon(ic, false, 'sm')}<span>${l}</span></button>`).join('')}</div>
        <div class="v3d-seg" data-g="mood">${MOOD_UI.map(([k, ic, l]) => `<button type="button" data-x="${k}" aria-pressed="${k === mood0}">${icon(ic, false, 'sm')}<span>${l}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(ov); document.body.classList.add('sheet-open');
    const close = () => { if(cur && cur.api) cur.api.dispose(); ov.remove(); document.body.classList.remove('sheet-open'); document.removeEventListener('keydown', onKey); cur = null; };
    const onKey = e => { if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    cur = {ov, api:null};
    const hint = $('.v3d-hint', ov), card = $('.v3d-card', ov);
    const setHint = k => { hint.textContent = HINTS[k]; hint.classList.remove('gone'); clearTimeout(cur && cur.ht); if(cur) cur.ht = setTimeout(() => hint.classList.add('gone'), 5200); };
    const press = (g, k) => $$(`.v3d-seg[data-g="${g}"] button`, ov).forEach(b => b.setAttribute('aria-pressed', b.dataset.x === k));
    const showCard = it => {
      if(!it){ card.hidden = true; return; }
      const c = E.venue.CAT[it.type], seats = E.venue.seatsOf(it), seated = c && c.table ? E.S.people.filter(p => p.tableId === it.id).reduce((a, p) => a + 1 + (+p.plusOnes || 0), 0) : 0, lbl = E.venue.labelOf(it);
      const names = c && c.table ? E.S.people.filter(p => p.tableId === it.id).map(p => p.name.split(' ')[0]).slice(0, 6) : [];
      card.innerHTML = `<b>${esc(lbl ? `${lbl} · ${c.label}` : c.label)}</b><small>${seats ? `${seats} seats${c.table ? ` · ${seated ? `${seated} seated` : 'no one seated yet'}` : ''}` : `${(it.w * 3.28084).toFixed(0)} × ${(it.d * 3.28084).toFixed(0)} ft`}</small>${names.length ? `<span>${esc(names.join(', '))}${seated > names.length ? '…' : ''}</span>` : ''}`;
      card.hidden = false;
    };
    ov.addEventListener('click', async e => {
      const b = e.target.closest('[data-x]'); if(!b) return; const x = b.dataset.x, api = cur && cur.api;
      if(x === 'close') return close();
      if(!api) return;
      if(MOODS[x]){ api.setMood(x); ov.className = 'v3d mood-' + x; press('mood', x); }
      else if(x === 'orbit' || x === 'top' || x === 'walk'){ api[x](); press('view', x); setHint(x); showCard(null); }
      else if(x === 'labels'){ const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); api.setLabels(on); }
      else if(x === 'snap'){ b.disabled = true; try{ const blob = await api.snapshot(); const file = new File([blob], `${E.slug(ev ? ev.name : 'venue')}-3d.jpg`, {type:'image/jpeg'});
          if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:`${ev ? ev.name : 'Venue'} in 3D`}); } catch(err){} }
          else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); E.toast('Picture saved', 'photo_camera'); } }
        catch(err){ console.warn(err); E.toast('Couldn’t save the picture. Try again.', 'warning'); } finally { b.disabled = false; } }
    });
    setHint('orbit');
    loadThree().then(() => {
      if(!cur) return;
      try{ cur.api = build($('canvas', ov), JSON.parse(JSON.stringify(plan)), ev, {mood:mood0, labels:true, onPick:showCard, onTouch:() => hint.classList.add('gone')}); }
      catch(e){ console.error(e); E.toast('3D view isn’t supported on this device.', 'warning'); close(); return; }
      requestAnimationFrame(() => $('.v3d-loading', ov)?.classList.add('done')); setTimeout(() => $('.v3d-loading', ov)?.remove(), 700);
    }).catch(() => { E.toast('Couldn’t load the 3D view. Check your connection.', 'warning'); close(); });
  }
};
})();
