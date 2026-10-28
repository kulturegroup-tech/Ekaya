/* Ekaya 3D venue view: builds a three.js scene from the 2D plan. Loads three.js on first use. */
(() => {
'use strict';
const {$, esc, icon} = E;
let loading = null, cur = null;
function loadThree(){
  if(window.THREE && THREE.OrbitControls) return Promise.resolve();
  if(loading) return loading;
  const add = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  loading = add('/assets/vendor/three.min.js').then(() => add('/assets/vendor/OrbitControls.js')).catch(e => { loading = null; throw e; });
  return loading;
}

function build(canvas, plan, ev, opts){
  const T = THREE, W = plan.w, H = plan.h, span = Math.max(W, H);
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, 1, 0.1, span * 12);
  const camHome = () => { const k = Math.max(0.55, Math.min(1.3, camera.aspect)), dist = (span * 0.5) / (Math.tan(21 * Math.PI / 180) * k) * 0.95, d = new T.Vector3(0.42, 0.62, 0.66).normalize(); camera.position.set(W / 2 + d.x * dist, d.y * dist, H / 2 + d.z * dist); };
  const controls = new T.OrbitControls(camera, canvas);
  controls.target.set(W / 2, 0.4, H / 2); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minDistance = 2.5; controls.maxDistance = span * 3.2;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.45;
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; }, {once:true});

  const mats = {}, M = (key, o) => mats[key] || (mats[key] = new T.MeshStandardMaterial(o));
  const cloth = M('cloth', {color:0xf3eee6, roughness:0.9});
  const gold = M('gold', {color:0xc9a24b, roughness:0.35, metalness:0.75});
  const chairM = M('chair', {color:0xc4a067, roughness:0.45, metalness:0.4});
  const wood = M('wood', {color:0x7a4f33, roughness:0.75});
  const dark = M('dark', {color:0x231b20, roughness:0.6});
  const metal = M('metal', {color:0xcfd2d6, roughness:0.25, metalness:0.9});
  const wine = M('wine', {color:0x6e2140, roughness:0.7});
  const cream = M('cream', {color:0xeee3cf, roughness:0.85});
  const green = M('green', {color:0x3e6b3a, roughness:0.9});
  const pink = M('pink', {color:0xe68ba8, roughness:0.8});
  const marigold = M('marigold', {color:0xf2a33a, roughness:0.8});
  const stone = M('stone', {color:0x55504c, roughness:0.95});
  const glowM = c => mats['g' + c] || (mats['g' + c] = new T.MeshStandardMaterial({color:c, emissive:c, emissiveIntensity:1.6, roughness:0.4}));
  const geo = {}, G = (k, f) => geo[k] || (geo[k] = f());

  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const glows = [];
  const glowSprite = (color, size, y=0, x=0, z=0) => { const s = new T.Sprite(new T.SpriteMaterial({map:glowTex, color, blending:T.AdditiveBlending, transparent:true, depthWrite:false, opacity:0.9})); s.scale.set(size, size, 1); s.position.set(x, y, z); glows.push(s); return s; };
  const mesh = (g, m, x=0, y=0, z=0, cast=true) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };
  const box = (w, h, d, m, x=0, y=0, z=0) => mesh(G(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d)), m, x, y + h / 2, z);
  const cyl = (rt, rb, h, m, x=0, y=0, z=0, seg=24) => mesh(G(`c${rt}|${rb}|${h}|${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg)), m, x, y + h / 2, z);
  const sph = (r, m, x=0, y=0, z=0) => mesh(G(`s${r}`, () => new T.SphereGeometry(r, 16, 12)), m, x, y, z);
  const texCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  const lights = [];   // night point lights (capped)
  const addPoint = (grp, color, intensity, dist, y) => { if(lights.length >= 8) return null; const l = new T.PointLight(color, intensity, dist, 2); l.position.y = y; grp.add(l); lights.push(l); return l; };
  const flames = [];

  function chair(g, x, z, rotY){ const c = new T.Group(); c.add(box(0.42, 0.05, 0.42, chairM, 0, 0.44, 0)); c.add(box(0.42, 0.48, 0.04, chairM, 0, 0.47, 0.19)); [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].forEach(([a,b]) => c.add(cyl(0.015, 0.015, 0.44, chairM, a, 0, b, 6))); c.position.set(x, 0, z); c.rotation.y = rotY; g.add(c); }
  function centrepiece(g, night){ g.add(cyl(0.06, 0.08, 0.22, gold, 0, 0.78, 0, 10)); g.add(sph(0.11, Math.random() > 0.5 ? pink : marigold, 0, 1.06, 0)); const t = sph(0.03, glowM(0xffc66b), 0.18, 0.8, 0.05); g.add(t); g.add(glowSprite(0xffb050, 0.5, 0.82, 0.18, 0.05)); }
  const B = {
    round(g, it, n){ const r = Math.max(0.3, (Math.min(it.w, it.d) - 1.1) / 2); g.add(cyl(r, r, 0.74, cloth, 0, 0, 0, 40)); g.add(cyl(r + 0.02, r + 0.02, 0.03, cloth, 0, 0.74, 0, 40)); for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; chair(g, Math.sin(a) * (r + 0.32), Math.cos(a) * (r + 0.32), a); } centrepiece(g); },
    round6(g, it){ B.round(g, it, 6); }, round8(g, it){ B.round(g, it, 8); }, round10(g, it){ B.round(g, it, 10); },
    long(g, it){ g.add(box(it.w, 0.75, 0.8, cloth)); const n = Math.max(1, Math.floor(it.w / 0.6)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + (i + 0.5) * it.w / n; chair(g, x, -0.66, Math.PI); chair(g, x, 0.66, 0); } for(let i = 0; i < Math.max(1, Math.round(it.w / 1.8)); i++) { const x = -it.w / 2 + (i + 0.5) * it.w / Math.max(1, Math.round(it.w / 1.8)); const cp = new T.Group(); centrepiece(cp); cp.position.x = x; g.add(cp); } },
    cards(g){ g.add(box(0.9, 0.72, 0.9, M('felt', {color:0x1f5a43, roughness:0.95}))); g.add(box(0.94, 0.03, 0.94, wood, 0, 0.72, 0)); chair(g, 0, -0.66, Math.PI); chair(g, 0, 0.66, 0); chair(g, 0.66, 0, Math.PI / 2); chair(g, -0.66, 0, -Math.PI / 2); },
    cocktail(g){ g.add(cyl(0.36, 0.3, 1.08, cloth, 0, 0, 0, 28)); g.add(sph(0.05, glowM(0xffc66b), 0, 1.13, 0)); g.add(glowSprite(0xffb050, 0.5, 1.14)); },
    lounge(g, it){ const w = it.w, d = it.d, sofa = M('sofa', {color:0xd9c7a8, roughness:0.95}); g.add(box(w - 0.1, 0.42, 0.66, sofa, 0, 0, -d / 2 + 0.38)); g.add(box(w - 0.1, 0.4, 0.14, sofa, 0, 0.42, -d / 2 + 0.12)); g.add(box(0.66, 0.42, d - 0.75, sofa, -w / 2 + 0.38, 0, 0.32)); g.add(box(0.66, 0.42, d - 0.75, sofa, w / 2 - 0.38, 0, 0.32)); g.add(box(w * 0.34, 0.38, d * 0.3, wood, 0, 0, 0.25)); },
    baithak(g, it){ g.add(box(it.w - 0.1, 0.14, it.d - 0.1, cloth)); const bol = M('bolster', {color:0x8c1c3f, roughness:0.8}); const n = Math.max(1, Math.floor((it.w - 0.4) / 0.7)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + 0.2 + (i + 0.5) * (it.w - 0.4) / n; [-1, 1].forEach(s => { const b = mesh(G('bol', () => new T.CylinderGeometry(0.11, 0.11, 0.5, 14)), bol, x, 0.25, s * (it.d / 2 - 0.22)); b.rotation.z = Math.PI / 2; g.add(b); }); } },
    rows(g, it){ const nx = Math.max(1, Math.floor(it.w / 0.55)), ny = Math.max(1, Math.floor(it.d / 0.95)); for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++) chair(g, -it.w / 2 + (i + 0.5) * it.w / nx, -it.d / 2 + (j + 0.5) * it.d / ny, Math.PI); },
    buffet(g, it){ g.add(box(it.w, 0.82, it.d, cloth)); g.add(box(it.w + 0.01, 0.12, it.d + 0.01, gold, 0, 0.6, 0)); const n = Math.max(1, Math.floor(it.w / 0.75)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + (i + 0.5) * it.w / n; g.add(box(0.5, 0.1, 0.34, metal, x, 0.82, 0)); const lid = mesh(G('lid', () => new T.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), metal, x, 0.92, 0); lid.scale.set(1.2, 0.6, 0.85); g.add(lid); } },
    bar(g, it){ g.add(box(it.w, 1.08, 0.62, dark, 0, 0, -0.08)); g.add(box(it.w + 0.08, 0.05, 0.72, gold, 0, 1.08, -0.08)); g.add(box(it.w, 1.6, 0.3, wood, 0, 0, it.d / 2 - 0.18)); const cols = [0x2f6b4f, 0x8a2a2a, 0xd8b067, 0x3a4a7a]; for(let i = 0; i < Math.floor(it.w / 0.18); i++) g.add(cyl(0.035, 0.035, 0.28, M('bt' + i % 4, {color:cols[i % 4], roughness:0.2, metalness:0.1, transparent:true, opacity:0.85}), -it.w / 2 + 0.1 + i * 0.18, 1.6, it.d / 2 - 0.18, 8)); const n = Math.max(1, Math.floor(it.w / 0.65)); for(let i = 0; i < n; i++){ const x = -it.w / 2 + (i + 0.5) * it.w / n; g.add(cyl(0.17, 0.17, 0.05, dark, x, 0.75, -it.d / 2 + 0.2, 16)); g.add(cyl(0.025, 0.025, 0.75, gold, x, 0, -it.d / 2 + 0.2, 6)); } const strip = box(it.w, 0.03, 0.02, glowM(0xffbf66), 0, 1.0, -0.4); g.add(strip); },
    live(g, it){ g.add(box(it.w, 0.85, it.d, cream)); g.add(cyl(0.32, 0.32, 0.03, dark, -it.w / 4, 0.85, 0, 24)); g.add(cyl(0.12, 0.02, 0.2, glowM(0xff7a33), -it.w / 4, 0.86, 0, 10)); g.add(glowSprite(0xff8a3a, 0.9, 0.95)); },
    dessert(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); [[-it.w / 4, 0.22, 3], [0.05, 0.16, 2], [it.w / 4, 0.2, 2]].forEach(([x, r, n], k) => { for(let i = 0; i < n; i++) g.add(cyl(r - i * 0.06, r - i * 0.06, 0.12, M('cake' + k, {color:[0xf6d3dc, 0xfff1d6, 0xd8b7e6][k], roughness:0.7}), x, 0.8 + i * 0.12, 0, 24)); }); },
    tea(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); g.add(cyl(0.15, 0.17, 0.42, metal, -0.42, 0.8, 0)); g.add(cyl(0.15, 0.17, 0.42, metal, 0.02, 0.8, 0)); },
    stage(g, it){ g.add(box(it.w, 0.6, it.d, wine)); g.add(box(it.w + 0.02, 0.06, it.d + 0.02, gold, 0, 0.6, 0)); g.add(box(1.4, 0.2, 0.3, wine, 0, 0, it.d / 2 + 0.2)); g.add(box(1.4, 0.4, 0.3, wine, 0, 0, it.d / 2 + 0.02)); const bd = box(it.w, 3, 0.1, M('backdrop', {color:0xf6e9dc, roughness:0.9}), 0, 0.6, -it.d / 2 + 0.05); g.add(bd); for(let i = 0; i < Math.round(it.w * 2); i++) g.add(sph(0.12, i % 3 ? pink : marigold, -it.w / 2 + 0.2 + i * (it.w - 0.4) / Math.max(1, Math.round(it.w * 2) - 1), 3.5 - (i % 2) * 0.15, -it.d / 2 + 0.15)); },
    dj(g, it){ g.add(box(it.w, 1.0, it.d, dark)); g.add(box(it.w, 0.04, 0.02, glowM(0x8f6bff), 0, 0.7, -it.d / 2 - 0.01)); g.add(cyl(0.22, 0.22, 0.03, metal, -0.5, 1.0, 0)); g.add(cyl(0.22, 0.22, 0.03, metal, 0.5, 1.0, 0)); g.add(box(0.3, 1.5, 0.3, dark, -it.w / 2 - 0.25, 0, -it.d / 2 + 0.2)); g.add(box(0.3, 1.5, 0.3, dark, it.w / 2 + 0.25, 0, -it.d / 2 + 0.2)); },
    dance(g, it, night){ const t = texCanvas(512, 512, (x, w, h) => { const n = 8; for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){ x.fillStyle = (i + j) % 2 ? '#141016' : '#f4efe6'; x.fillRect(i * w / n, j * h / n, w / n, h / n); } }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(it.w / 8, it.d / 8); const m = new T.MeshStandardMaterial({map:t, roughness:0.15, metalness:0.3}); g.add(box(it.w, 0.04, it.d, m)); },
    photobooth(g, it){ const bd = M('pbd', {color:0xf2c9d6, roughness:0.85}); g.add(box(it.w, 2.4, 0.08, bd, 0, 0, -it.d / 2 + 0.1)); for(let i = 0; i < 18; i++) g.add(sph(0.1, i % 2 ? pink : cloth, -it.w / 2 + 0.15 + (i % 9) * (it.w - 0.3) / 8, 0.6 + Math.floor(i / 9) * 1.4 + (i % 3) * 0.2, -it.d / 2 + 0.16)); const ring = mesh(new T.TorusGeometry(0.3, 0.025, 8, 32), glowM(0xffffff), 0, 1.5, it.d / 2 - 0.4); g.add(ring); g.add(cyl(0.02, 0.02, 1.2, dark, 0, 0, it.d / 2 - 0.4, 6)); },
    mandap(g, it){ const x = it.w / 2 - 0.3, z = it.d / 2 - 0.3; g.add(box(it.w, 0.25, it.d, cream)); [[-x,-z],[x,-z],[x,z],[-x,z]].forEach(([a, b]) => { g.add(cyl(0.14, 0.18, 2.8, gold, a, 0.25, b, 16)); g.add(sph(0.22, marigold, a, 3.1, b)); }); const roof = mesh(new T.ConeGeometry(Math.max(it.w, it.d) * 0.72, 1.1, 4, 1, true), M('mroof', {color:0xf6e1c3, roughness:0.9, side:T.DoubleSide}), 0, 3.6, 0); roof.rotation.y = Math.PI / 4; g.add(roof); g.add(box(0.6, 0.35, 0.6, M('havan', {color:0x7a4a2a}), 0, 0.25, 0)); g.add(sph(0.12, glowM(0xff7a33), 0, 0.75, 0)); g.add(glowSprite(0xff8a3a, 1.2, 0.8)); },
    arch(g, it){ const r = Math.max(0.6, it.w / 2 - 0.2), arc = mesh(new T.TorusGeometry(r, 0.09, 10, 36, Math.PI), M('archv', {color:0x5d7d4a, roughness:0.9}), 0, 2.0, 0); g.add(arc); for(let i = 0; i <= 16; i++){ const a = i / 16 * Math.PI; g.add(sph(0.11, i % 3 ? pink : cloth, Math.cos(a) * r, 2.0 + Math.sin(a) * r, 0)); } g.add(cyl(0.09, 0.09, 2.0, M('archv', {}), -r, 0, 0, 10)); g.add(cyl(0.09, 0.09, 2.0, M('archv', {}), r, 0, 0, 10)); },
    rangoli(g, it){ const t = texCanvas(512, 512, (x, w) => { const c = w / 2; const ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill(); }; ring(250, '#e0457e'); ring(205, '#f2b705'); ring(160, '#2e8b57'); ring(120, '#f6e7c8'); for(let i = 0; i < 8; i++){ x.save(); x.translate(c, c); x.rotate(i * Math.PI / 4); x.fillStyle = '#d6336c'; x.beginPath(); x.ellipse(0, -80, 26, 52, 0, 0, Math.PI * 2); x.fill(); x.restore(); } ring(40, '#f2a33a'); }); const m = new T.MeshStandardMaterial({map:t, transparent:true, roughness:0.9}); const c = mesh(new T.CircleGeometry(it.w / 2, 48), m, 0, 0.012, 0, false); c.rotation.x = -Math.PI / 2; g.add(c); },
    standee(g, it){ g.add(box(it.w, 1.5, 0.05, cream, 0, 0.5, 0)); g.add(box(it.w + 0.06, 0.04, 0.07, gold, 0, 2.0, 0)); g.add(cyl(0.015, 0.015, 1.1, gold, -it.w / 3, 0, 0.15, 6)); g.add(cyl(0.015, 0.015, 1.1, gold, it.w / 3, 0, 0.15, 6)); },
    gift(g, it){ g.add(box(it.w, 0.8, it.d, cloth)); g.add(box(0.36, 0.3, 0.36, pink, -0.4, 0.8, 0)); g.add(box(0.28, 0.24, 0.28, marigold, 0.1, 0.8, -0.05)); g.add(box(0.24, 0.36, 0.24, M('giftb', {color:0x3a6fa8}), 0.5, 0.8, 0.06)); },
    plant(g, it){ g.add(cyl(0.22, 0.17, 0.42, M('pot', {color:0xa0673a, roughness:0.8}))); const r = it.w / 2; g.add(sph(r * 0.55, green, 0, 0.9, 0)); g.add(sph(r * 0.42, green, r * 0.25, 1.25, 0.1)); g.add(sph(r * 0.38, green, -r * 0.2, 1.3, -0.1)); },
    fairy(g, it, night){ const w = it.w, n = Math.max(2, Math.round(w / 1.5)), h = 2.9, pts = []; for(let i = 0; i <= n * 8; i++){ const t = i / (n * 8), x = -w / 2 + t * w, seg = (t * n) % 1; pts.push(new T.Vector3(x, h - 0.45 * 4 * seg * (1 - seg), 0)); } g.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length, 0.008, 4), dark, 0, 0, 0, false)); const bulb = glowM(0xffd27a); for(let i = 0; i < pts.length; i += 2){ const p = pts[i]; g.add(mesh(G('bulb', () => new T.SphereGeometry(0.035, 8, 6)), bulb, p.x, p.y - 0.04, 0, false)); if(night) g.add(glowSprite(0xffc060, 0.32, p.y - 0.04, p.x, 0)); } [-w / 2, w / 2].forEach(x => g.add(cyl(0.03, 0.03, h, dark, x, 0, 0, 6))); },
    lantern(g, it, night){ g.add(cyl(0.04, 0.06, 2.4, dark, 0, 0, 0, 8)); g.add(sph(0.16, glowM(0xffd08a), 0, 2.5, 0)); g.add(glowSprite(0xffb560, night ? 1.6 : 0.6, 2.5)); if(night) addPoint(g, 0xffb46b, 1.6, 9, 2.4); },
    uplight(g, it, night){ g.add(cyl(0.1, 0.1, 0.16, dark)); const beam = mesh(new T.ConeGeometry(0.6, 2.8, 20, 1, true), new T.MeshBasicMaterial({color:0xd889ff, transparent:true, opacity:night ? 0.16 : 0.06, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide}), 0, 1.55, 0, false); beam.rotation.x = Math.PI; g.add(beam); g.add(glowSprite(0xd889ff, 0.8, 0.2)); },
    diyas(g, it, night){ [[0,0],[0.24,0.1],[-0.24,0.1],[0.12,-0.2],[-0.12,-0.2]].forEach(([x, z]) => { g.add(cyl(0.07, 0.05, 0.05, M('clay', {color:0xb5653a}), x, 0, z, 10)); const fl = mesh(G('dflame', () => new T.ConeGeometry(0.02, 0.07, 8)), glowM(0xffb347), x, 0.09, z, false); g.add(fl); flames.push(fl); }); g.add(glowSprite(0xff9a40, night ? 1.4 : 0.6, 0.12)); if(night) addPoint(g, 0xff9a40, 1.2, 4, 0.3); },
    bonfire(g, it, night){ const ring = mesh(new T.TorusGeometry(0.55, 0.12, 8, 20), stone, 0, 0.08, 0); ring.rotation.x = Math.PI / 2; g.add(ring); [35, -35, 90].forEach(a => { const l = cyl(0.07, 0.07, 0.9, wood, 0, 0.1, 0, 8); l.rotation.z = Math.PI / 2; l.rotation.y = a * Math.PI / 180; l.position.y = 0.12; g.add(l); });
      [[0xff5a1f, 0.32, 0.9], [0xff9a2e, 0.22, 0.7], [0xffd36b, 0.12, 0.5]].forEach(([c, r, h]) => { const fl = mesh(new T.ConeGeometry(r, h, 12), new T.MeshBasicMaterial({color:c, transparent:true, opacity:0.85, blending:T.AdditiveBlending, depthWrite:false}), 0, 0.15 + h / 2, 0, false); g.add(fl); flames.push(fl); });
      g.add(glowSprite(0xff7a2e, night ? 4 : 1.6, 0.6)); const l = addPoint(g, 0xff8a3a, night ? 4 : 1.5, 14, 1.0); if(l) l.userData.flicker = true; },
    fireworks(g, it, night){ const m = new T.MeshBasicMaterial({color:0xff7a45, transparent:true, opacity:0.5}); const edges = [[it.w, 0.05, 0, -it.d / 2], [it.w, 0.05, 0, it.d / 2], [0.05, it.d, -it.w / 2, 0], [0.05, it.d, it.w / 2, 0]]; edges.forEach(([a, b, x, z]) => { const p = mesh(new T.PlaneGeometry(a, b), m, x, 0.02, z, false); p.rotation.x = -Math.PI / 2; g.add(p); }); if(night) for(let i = 0; i < 4; i++) g.add(glowSprite([0xff6ad5, 0x6ad5ff, 0xffd36b, 0x9cff6a][i], 3.5, 9 + (i % 2) * 2, (i - 1.5) * 1.2, (i % 2 - 0.5) * 1.5)); },
    tent(g, it){ const fab = M('tent', {color:0xfbf7f0, roughness:0.95, side:T.DoubleSide, transparent:true, opacity:0.9}); [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a, b]) => g.add(cyl(0.06, 0.06, 3.2, gold, a * it.w / 2, 0, b * it.d / 2, 8))); const roof = mesh(new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true), fab, 0, 3.2 + 0.9, 0, false); roof.rotation.y = Math.PI / 4; roof.scale.set(it.w, 1.8, it.d); g.add(roof); },
    entry(g, it){ const w = it.w; g.add(box(0.3, 2.8, 0.3, cream, -w / 2 + 0.15, 0, 0)); g.add(box(0.3, 2.8, 0.3, cream, w / 2 - 0.15, 0, 0)); g.add(box(w, 0.35, 0.36, gold, 0, 2.8, 0)); for(let i = 0; i < Math.round(w * 4); i++) g.add(sph(0.07, i % 2 ? marigold : cloth, -w / 2 + 0.1 + i * (w - 0.2) / Math.max(1, Math.round(w * 4) - 1), 2.72 - 0.25 * Math.sin(i / Math.max(1, Math.round(w * 4) - 1) * Math.PI), 0.2)); },
    exit(g, it){ g.add(box(0.2, 2.2, 0.2, cream, -it.w / 2 + 0.1, 0, 0)); g.add(box(0.2, 2.2, 0.2, cream, it.w / 2 - 0.1, 0, 0)); g.add(box(0.8, 0.25, 0.04, glowM(0x2fbf71), 0, 2.25, 0)); },
    washroom(g, it){ g.add(box(it.w, 2.4, it.d, cream)); g.add(box(0.8, 2.0, 0.04, wood, -it.w / 4, 0, it.d / 2 + 0.01)); g.add(box(0.8, 2.0, 0.04, wood, it.w / 4, 0, it.d / 2 + 0.01)); },
    generator(g, it){ g.add(box(it.w, 1.2, it.d, M('gen', {color:0x5b6670, roughness:0.6, metalness:0.4}))); },
    speaker(g){ g.add(box(0.45, 1.5, 0.4, dark)); g.add(cyl(0.13, 0.13, 0.02, metal, 0, 1.0, 0.2, 16).rotateX(Math.PI / 2)); },
    screen(g, it, night){ g.add(box(it.w + 0.1, 2.4, 0.12, dark, 0, 0.8, 0)); g.add(box(it.w, 2.2, 0.02, M('led' + (night ? 1 : 0), {color:0x1b2440, emissive:0x3a5bd9, emissiveIntensity:night ? 0.9 : 0.25}), 0, 0.9, 0.07)); g.add(box(0.1, 0.8, 0.1, dark, -it.w / 3, 0, 0)); g.add(box(0.1, 0.8, 0.1, dark, it.w / 3, 0, 0)); },
    parking(g, it){ const m = new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.6}); const n = Math.max(1, Math.floor(it.w / 2.5)); for(let i = 1; i < n; i++){ const p = mesh(new T.PlaneGeometry(0.08, it.d * 0.55), m, -it.w / 2 + i * it.w / n, 0.015, -it.d / 2 + it.d * 0.275, false); p.rotation.x = -Math.PI / 2; g.add(p); } },
    pillar(g){ g.add(box(0.5, 3.4, 0.5, cream)); },
    wall(g, it){ g.add(box(it.w, 2.4, it.d, cream)); },
    zone(g, it){ const p = mesh(new T.PlaneGeometry(it.w, it.d), new T.MeshBasicMaterial({color:0x4f8b76, transparent:true, opacity:0.18, depthWrite:false}), 0, 0.02, 0, false); p.rotation.x = -Math.PI / 2; g.add(p); },
    label(){}
  };

  function groundTexture(kind){
    const draws = {
      lawn:(x, w, h) => { x.fillStyle = '#6f9a52'; x.fillRect(0, 0, w, h); x.fillStyle = '#7ea85f'; for(let i = 0; i < 8; i += 2) x.fillRect(i * w / 8, 0, w / 8, h); for(let i = 0; i < 4000; i++){ x.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 60},${30 + Math.random() * 30},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 3); } },
      terrace:(x, w, h) => { x.fillStyle = '#d9cdbb'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(90,70,50,.25)'; x.lineWidth = 2; for(let i = 0; i <= 8; i++){ x.beginPath(); x.moveTo(i * w / 8, 0); x.lineTo(i * w / 8, h); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke(); } },
      marble:(x, w, h) => { x.fillStyle = '#efe9e1'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(130,120,110,.25)'; x.lineWidth = 1.5; for(let i = 0; i < 14; i++){ x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for(let k = 0; k < 6; k++){ px += (Math.random() - 0.3) * 80; py += (Math.random() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); } },
      wood:(x, w, h) => { for(let j = 0; j < 16; j++){ x.fillStyle = `hsl(28,${38 + Math.random() * 10}%,${42 + Math.random() * 8}%)`; x.fillRect(0, j * h / 16, w, h / 16 - 2); } },
      carpet:(x, w, h) => { x.fillStyle = '#6a2234'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(232,190,120,.35)'; x.lineWidth = 2; for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++){ const cx = (i + 0.5) * w / 8, cy = (j + 0.5) * h / 8, r = w / 22; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.stroke(); } },
      sand:(x, w, h) => { x.fillStyle = '#d9c39a'; x.fillRect(0, 0, w, h); for(let i = 0; i < 3000; i++){ x.fillStyle = `rgba(120,90,50,${Math.random() * 0.2})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
      plain:(x, w, h) => { x.fillStyle = '#e9e3da'; x.fillRect(0, 0, w, h); }
    };
    const t = texCanvas(512, 512, draws[kind] || draws.plain); t.wrapS = t.wrapT = T.RepeatWrapping;
    const rep = {lawn:8, terrace:4.8, marble:6, wood:4, carpet:9.6, sand:4, plain:10}[kind] || 10; t.repeat.set(W / rep, H / rep); return t;
  }
  function labelSprite(text){
    const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 256; c.height = 96;
    x.font = '600 52px "Google Sans Flex", system-ui, sans-serif'; const tw = Math.min(244, x.measureText(text).width + 40);
    x.fillStyle = 'rgba(20,14,18,.78)'; const r = 30, bx = (256 - tw) / 2; x.beginPath(); x.moveTo(bx + r, 18); x.arcTo(bx + tw, 18, bx + tw, 78, r); x.arcTo(bx + tw, 78, bx, 78, r); x.arcTo(bx, 78, bx, 18, r); x.arcTo(bx, 18, bx + tw, 18, r); x.fill();
    x.fillStyle = '#EBCF98'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 50);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const s = new T.Sprite(new T.SpriteMaterial({map:t, depthTest:false, transparent:true})); s.scale.set(1.6, 0.6, 1); s.renderOrder = 10; return s;
  }

  let root = null, labelGroup = null, sun, hemi, moon, groundOuter;
  function populate(night){
    if(root){ scene.remove(root); root.traverse(o => { if(o.material && o.material.map && !Object.values(mats).includes(o.material)) o.material.map.dispose && o.material.map.dispose(); }); }
    glows.length = 0; lights.length = 0; flames.length = 0;
    root = new T.Group(); labelGroup = new T.Group(); root.add(labelGroup);
    const ground = mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({map:groundTexture(plan.ground || 'plain'), roughness:0.92}), W / 2, 0, H / 2, false); ground.rotation.x = -Math.PI / 2; root.add(ground);
    const edgeM = M('edge', {color:0xd8c9b2, roughness:0.8});
    [[W, 0.18, 0.12, W / 2, -0.06], [W, 0.18, 0.12, W / 2, H + 0.06]].forEach(([a, b, c, x, z]) => root.add(box(a, b, c, edgeM, x, 0, z)));
    [[0.12, 0.18, H, -0.06, H / 2], [0.12, 0.18, H, W + 0.06, H / 2]].forEach(([a, b, c, x, z]) => root.add(box(a, b, c, edgeM, x, 0, z)));
    (plan.items || []).forEach(it => {
      const g = new T.Group(), fn = B[it.type]; if(!fn) return;
      fn(g, it, night);
      g.position.set(it.x, 0, it.y); g.rotation.y = -(it.rot || 0) * Math.PI / 180; root.add(g);
      const lbl = E.venue.labelOf(it); if(lbl){ const s = labelSprite(lbl); s.position.set(it.x, it.type === 'label' ? 1.2 : 2.1, it.y); labelGroup.add(s); }
    });
    labelGroup.visible = opts.labels;
    scene.add(root);
  }
  function setMode(night){
    opts.night = night;
    scene.background = new T.Color(night ? 0x07060b : 0xe9e1d4);
    scene.fog = new T.Fog(night ? 0x07060b : 0xe9e1d4, span * 2.2, span * 6);
    if(!hemi){ hemi = new T.HemisphereLight(); scene.add(hemi); sun = new T.DirectionalLight(); scene.add(sun); scene.add(sun.target);
      groundOuter = mesh(new T.PlaneGeometry(span * 14, span * 14), new T.MeshStandardMaterial({color:0x8e8a82, roughness:1}), W / 2, -0.01, H / 2, false); groundOuter.rotation.x = -Math.PI / 2; scene.add(groundOuter); }
    hemi.color.set(night ? 0x2a3160 : 0xfff4e0); hemi.groundColor.set(night ? 0x120c0a : 0x6b5a46); hemi.intensity = night ? 0.32 : 0.95;
    sun.color.set(night ? 0x8fa2ff : 0xfff0d6); sun.intensity = night ? 0.28 : 1.7;
    sun.position.set(W / 2 - span * 0.6, span * 1.1, H / 2 - span * 0.4); sun.target.position.set(W / 2, 0, H / 2);
    sun.castShadow = !night; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.far = span * 4; sun.shadow.bias = -0.0004; sc.updateProjectionMatrix();
    groundOuter.material.color.set(night ? 0x0d0b10 : 0xb8b0a2);
    renderer.toneMappingExposure = night ? 1.25 : 1.0;
    populate(night);
  }
  setMode(opts.night);

  let raf = 0, t0 = performance.now();
  const resize = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  resize(); camHome(); window.addEventListener('resize', resize);
  const tick = now => {
    const t = (now - t0) / 1000;
    lights.forEach(l => { if(l.userData.flicker) l.intensity = (opts.night ? 4 : 1.5) * (0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07); });
    flames.forEach((fl, i) => { fl.scale.y = 0.9 + Math.sin(t * 9 + i) * 0.12; });
    controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    setNight:n => setMode(n),
    setLabels:v => { opts.labels = v; if(labelGroup) labelGroup.visible = v; },
    top:() => { controls.autoRotate = false; const from = camera.position.clone(), to = new T.Vector3(W / 2, span * 1.15, H / 2 + 0.01), start = performance.now(); const step = now => { const k = Math.min(1, (now - start) / 700), e = 1 - Math.pow(1 - k, 3); camera.position.lerpVectors(from, to, e); if(k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); },
    reset:() => { camHome(); controls.target.set(W / 2, 0.4, H / 2); },
    dispose:() => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); scene.traverse(o => { o.geometry && o.geometry.dispose(); }); }
  };
}

E.venue3d = {
  open(plan, ev){
    if(cur) return;
    const night0 = (() => { const h = new Date().getHours(); return h >= 18 || h < 6 || ev?.type === 'diwali'; })();
    const ov = document.createElement('div'); ov.className = 'v3d'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '3D view of the venue');
    ov.innerHTML = `<canvas></canvas><div class="v3d-loading">Setting the scene…</div>
      <div class="v3d-bar"><button class="icon-btn" data-x="close" aria-label="Close 3D view" type="button">${icon('close')}</button><div class="v3d-title"><small>3D view · ${esc(plan.name || 'Venue')}</small><b>${esc(ev?.name || plan.name || 'Venue')}</b></div><button class="icon-btn" data-x="reset" aria-label="Reset camera" type="button">${icon('3d_rotation')}</button></div>
      <div class="v3d-hint">Drag to look around · pinch or scroll to zoom</div>
      <div class="v3d-foot"><button type="button" data-x="day" aria-pressed="${!night0}">${icon('light_mode','','sm')}Day</button><button type="button" data-x="night" aria-pressed="${night0}">${icon('dark_mode','','sm')}Night</button><button type="button" data-x="top" aria-pressed="false">${icon('crop_free','','sm')}Top</button><button type="button" data-x="labels" aria-pressed="true">${icon('label','','sm')}Labels</button></div>`;
    ov.classList.toggle('day', !night0);
    document.body.appendChild(ov); document.body.classList.add('sheet-open');
    const close = () => { if(cur && cur.api) cur.api.dispose(); ov.remove(); document.body.classList.remove('sheet-open'); document.removeEventListener('keydown', onKey); cur = null; };
    const onKey = e => { if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    cur = {ov, api:null};
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-x]'); if(!b) return; const x = b.dataset.x, api = cur && cur.api;
      if(x === 'close') return close();
      if(!api) return;
      if(x === 'day' || x === 'night'){ api.setNight(x === 'night'); ov.classList.toggle('day', x === 'day'); $('[data-x="day"]', ov).setAttribute('aria-pressed', x === 'day'); $('[data-x="night"]', ov).setAttribute('aria-pressed', x === 'night'); }
      else if(x === 'top') api.top(); else if(x === 'reset') api.reset();
      else if(x === 'labels'){ const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); api.setLabels(on); }
    });
    loadThree().then(() => {
      if(!cur) return;
      $('.v3d-loading', ov).remove();
      try{ cur.api = build($('canvas', ov), JSON.parse(JSON.stringify(plan)), ev, {night:night0, labels:true}); }
      catch(e){ console.error(e); E.toast('3D view isn’t supported on this device.', 'warning'); close(); }
    }).catch(() => { E.toast('Couldn’t load the 3D view. Check your connection.', 'warning'); close(); });
  }
};
})();
