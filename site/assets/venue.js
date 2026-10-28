/* Ekaya venue planner: a to-scale 2D layout editor (meters internally, feet or meters on screen). */
(() => {
'use strict';
const {$, $$, esc, icon, uid, S, Store} = E;
const VE = ' vector-effect="non-scaling-stroke"';
const FT = 3.28084;
const f = n => +(+n).toFixed(3);

/* ---------- svg helpers (item-local meters, centred on 0,0) ---------- */
const at = o => `${o.fo != null ? ` fill-opacity="${o.fo}"` : ''}${o.s ? ` stroke="${o.s}" stroke-width="${o.sw || 1.2}"${VE}` : ''}${o.so != null ? ` stroke-opacity="${o.so}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.t ? ` transform="${o.t}"` : ''}${o.lc ? ` stroke-linecap="${o.lc}"` : ''}`;
const R = (x, y, w, h, o={}) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${o.rx ? ` rx="${f(o.rx)}"` : ''} fill="${o.fill || 'none'}"${at(o)}/>`;
const Rc = (cx, cy, w, h, o={}) => R(cx - w/2, cy - h/2, w, h, o);
const C = (cx, cy, r, o={}) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${o.fill || 'none'}"${at(o)}/>`;
const P = (d, o={}) => `<path d="${d}" fill="${o.fill || 'none'}"${at(o)}/>`;
const T = (x, y, s, size, o={}) => `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${o.fill || 'var(--plan-ink)'}" font-family="Google Sans Flex, system-ui, sans-serif" font-weight="${o.fw || 650}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`;
const PAPER = 'var(--plan-paper)', INK = 'var(--plan-ink)', WALL = 'var(--plan-wall)';
const COL = {seat:'var(--c-seat)', food:'var(--c-food)', stage:'var(--c-stage)', decor:'var(--c-decor)', light:'var(--c-light)', fire:'var(--c-fire)', util:'var(--c-util)', zone:'var(--c-zone)'};
const chair = (x, y, rot, c) => R(-0.21, -0.19, 0.42, 0.38, {rx:0.1, fill:PAPER, s:c, t:`translate(${f(x)} ${f(y)}) rotate(${f(rot)})`});
const glow = (r, id='vzg-light') => C(0, 0, r, {fill:`url(#${id})`});

/* ---------- catalogue ---------- */
function roundTable(n){
  return (w, d) => {
    const c = COL.seat, r = Math.max(0.3, (Math.min(w, d) - 1.1) / 2); let s = '';
    for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2 - Math.PI / 2; s += chair(Math.cos(a) * (r + 0.3), Math.sin(a) * (r + 0.3), a * 180 / Math.PI + 90, c); }
    return s + C(0, 0, r, {fill:c, fo:0.16, s:c, sw:1.4}) + C(0, 0, r * 0.42, {s:c, so:0.45, dash:'2 3'});
  };
}
const longSeats = w => Math.max(1, Math.floor(w / 0.6)) * 2;
const rowSeats = (w, d) => Math.max(1, Math.floor(w / 0.55)) * Math.max(1, Math.floor(d / 0.95));
const CAT = {
  round6:{label:'Round table · 6', cat:'seat', w:2.3, d:2.3, round:true, seats:6, table:true, draw:roundTable(6)},
  round8:{label:'Round table · 8', cat:'seat', w:2.6, d:2.6, round:true, seats:8, table:true, draw:roundTable(8)},
  round10:{label:'Round table · 10', cat:'seat', w:2.9, d:2.9, round:true, seats:10, table:true, draw:roundTable(10)},
  long:{label:'Long table', cat:'seat', w:2.4, d:1.9, resize:'x', table:true, seats:longSeats, draw:(w) => {
    const c = COL.seat, n = Math.max(1, Math.floor(w / 0.6)); let s = '';
    for(let i = 0; i < n; i++){ const x = -w/2 + (i + 0.5) * (w / n); s += chair(x, -0.68, 0, c) + chair(x, 0.68, 180, c); }
    return s + Rc(0, 0, w, 0.8, {rx:0.08, fill:c, fo:0.16, s:c, sw:1.4});
  }},
  cards:{label:'Card table · 4', cat:'seat', w:1.9, d:1.9, seats:4, table:true, draw:() => {
    const c = COL.seat; return chair(0, -0.68, 0, c) + chair(0.68, 0, 90, c) + chair(0, 0.68, 180, c) + chair(-0.68, 0, 270, c) + Rc(0, 0, 0.9, 0.9, {rx:0.06, fill:c, fo:0.2, s:c, sw:1.4}) + Rc(0, 0, 0.5, 0.5, {s:c, so:0.5, dash:'2 2'});
  }},
  cocktail:{label:'Cocktail table', cat:'seat', w:0.8, d:0.8, round:true, draw:() => C(0, 0, 0.36, {fill:COL.seat, fo:0.18, s:COL.seat, sw:1.4}) + C(0, 0, 0.1, {fill:COL.seat})},
  lounge:{label:'Lounge set', cat:'seat', w:2.6, d:2.1, seats:6, draw:(w, d) => {
    const c = COL.seat;
    return Rc(0, -d/2 + 0.38, w - 0.1, 0.66, {rx:0.18, fill:c, fo:0.18, s:c}) + Rc(-w/2 + 0.38, 0.32, 0.66, d - 0.75, {rx:0.18, fill:c, fo:0.18, s:c}) + Rc(w/2 - 0.38, 0.32, 0.66, d - 0.75, {rx:0.18, fill:c, fo:0.18, s:c}) + Rc(0, 0.25, w * 0.34, d * 0.3, {rx:0.06, fill:PAPER, s:c});
  }},
  baithak:{label:'Floor seating', cat:'seat', w:3.2, d:2.6, resize:true, seats:(w, d) => Math.max(2, Math.round((w + d) * 2 / 0.75)), draw:(w, d) => {
    const c = COL.decor; let s = Rc(0, 0, w - 0.1, d - 0.1, {rx:0.12, fill:c, fo:0.1, s:c});
    const nx = Math.max(1, Math.floor((w - 0.4) / 0.7)), ny = Math.max(1, Math.floor((d - 0.4) / 0.7));
    for(let i = 0; i < nx; i++){ const x = -w/2 + 0.2 + (i + 0.5) * ((w - 0.4) / nx); s += Rc(x, -d/2 + 0.22, 0.5, 0.22, {rx:0.11, fill:c, fo:0.35, s:c}) + Rc(x, d/2 - 0.22, 0.5, 0.22, {rx:0.11, fill:c, fo:0.35, s:c}); }
    for(let i = 0; i < ny; i++){ const y = -d/2 + 0.2 + (i + 0.5) * ((d - 0.4) / ny); s += Rc(-w/2 + 0.22, y, 0.22, 0.5, {rx:0.11, fill:c, fo:0.35, s:c}) + Rc(w/2 - 0.22, y, 0.22, 0.5, {rx:0.11, fill:c, fo:0.35, s:c}); }
    return s;
  }},
  rows:{label:'Chair rows', cat:'seat', w:4.4, d:2.9, resize:true, seats:rowSeats, draw:(w, d) => {
    const c = COL.seat, nx = Math.max(1, Math.floor(w / 0.55)), ny = Math.max(1, Math.floor(d / 0.95)); let s = '';
    for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++) s += chair(-w/2 + (i + 0.5) * (w / nx), -d/2 + (j + 0.5) * (d / ny), 180, c);
    return s;
  }},
  buffet:{label:'Buffet counter', cat:'food', w:4, d:0.9, resize:'x', draw:(w, d) => {
    const c = COL.food, n = Math.max(1, Math.floor(w / 0.75)); let s = Rc(0, 0, w, d, {rx:0.08, fill:PAPER, s:c, sw:1.4}) + Rc(0, 0, w - 0.14, d - 0.14, {rx:0.05, s:c, so:0.35});
    for(let i = 0; i < n; i++) s += Rc(-w/2 + (i + 0.5) * (w / n), 0, 0.5, 0.36, {rx:0.16, fill:c, fo:0.28, s:c});
    return s;
  }},
  bar:{label:'Bar counter', cat:'food', w:3, d:1.6, resize:'x', draw:(w, d) => {
    const c = COL.food, n = Math.max(1, Math.floor(w / 0.65)); let s = '';
    for(let i = 0; i < n; i++) s += C(-w/2 + (i + 0.5) * (w / n), -d/2 + 0.2, 0.16, {fill:PAPER, s:c});
    s += Rc(0, -0.08, w, 0.62, {rx:0.18, fill:c, fo:0.26, s:c, sw:1.4}) + Rc(0, d/2 - 0.18, w, 0.3, {rx:0.04, fill:PAPER, s:c});
    for(let i = 0; i < n * 2; i++) s += C(-w/2 + (i + 0.5) * (w / (n * 2)), d/2 - 0.18, 0.05, {fill:c});
    return s;
  }},
  live:{label:'Live counter', cat:'food', w:2.2, d:1.2, resize:'x', draw:(w, d) => {
    const c = COL.food; return Rc(0, 0, w, d, {rx:0.1, fill:PAPER, s:c, sw:1.4}) + C(-w/4, 0, 0.3, {fill:c, fo:0.3, s:c}) + C(-w/4, 0, 0.12, {fill:COL.fire}) + Rc(w/4, 0, 0.6, 0.5, {rx:0.06, fill:c, fo:0.18, s:c});
  }},
  dessert:{label:'Dessert table', cat:'food', w:2.2, d:0.9, resize:'x', draw:(w, d) => {
    const c = COL.decor; return Rc(0, 0, w, d, {rx:0.45, fill:PAPER, s:c, sw:1.4}) + C(-w/4, 0, 0.26, {fill:c, fo:0.25, s:c}) + C(-w/4, 0, 0.13, {s:c}) + C(0.05, -0.08, 0.17, {fill:c, fo:0.25, s:c}) + C(w/4, 0.06, 0.22, {fill:c, fo:0.25, s:c});
  }},
  tea:{label:'Chai & coffee', cat:'food', w:1.6, d:0.8, draw:(w, d) => {
    const c = COL.food; return Rc(0, 0, w, d, {rx:0.08, fill:PAPER, s:c, sw:1.4}) + C(-0.42, 0, 0.2, {fill:c, fo:0.3, s:c}) + C(0.02, 0, 0.2, {fill:c, fo:0.3, s:c}) + C(0.45, -0.12, 0.06, {s:c}) + C(0.45, 0.12, 0.06, {s:c});
  }},
  stage:{label:'Stage', cat:'stage', w:6, d:3.6, resize:true, ground:true, draw:(w, d) => {
    const c = COL.stage; return Rc(0, 0, w, d, {rx:0.1, fill:c, fo:0.16, s:c, sw:1.6}) + P(`M${f(-w/2)} ${f(d/2 - 0.1)}H${f(w/2)}`, {s:c, sw:3}) + Rc(0, d/2 + 0.2, 1.4, 0.18, {fill:PAPER, s:c}) + Rc(0, d/2 + 0.42, 1.4, 0.18, {fill:PAPER, s:c});
  }},
  dj:{label:'DJ booth', cat:'stage', w:2, d:1.2, draw:(w, d) => {
    const c = COL.stage; return Rc(0, 0, w, d, {rx:0.08, fill:PAPER, s:c, sw:1.4}) + C(-0.5, 0, 0.26, {fill:c, fo:0.25, s:c}) + C(0.5, 0, 0.26, {fill:c, fo:0.25, s:c}) + Rc(0, 0, 0.36, 0.5, {rx:0.04, fill:c, fo:0.4}) + Rc(-w/2 + 0.12, -d/2 + 0.12, 0.2, 0.2, {fill:c}) + Rc(w/2 - 0.12, -d/2 + 0.12, 0.2, 0.2, {fill:c});
  }},
  dance:{label:'Dance floor', cat:'stage', w:5, d:5, resize:true, ground:true, draw:(w, d) => {
    const c = COL.stage, nx = Math.max(1, Math.round(w)), ny = Math.max(1, Math.round(d)); let s = '';
    for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++) s += R(-w/2 + i * w / nx, -d/2 + j * d / ny, w / nx, d / ny, {fill:c, fo:(i + j) % 2 ? 0.08 : 0.24});
    return s + Rc(0, 0, w, d, {s:c, sw:1.4});
  }},
  photobooth:{label:'Photo booth', cat:'stage', w:2.6, d:1.8, draw:(w, d) => {
    const c = COL.decor; let s = Rc(0, -d/2 + 0.12, w, 0.2, {fill:c, fo:0.35, s:c});
    for(let i = 0; i < 7; i++) s += C(-w/2 + 0.2 + i * (w - 0.4) / 6, -d/2 + 0.12, 0.09, {fill:c});
    return s + P(`M0 ${f(d/2 - 0.1)}l-0.25 -0.4M0 ${f(d/2 - 0.1)}l0.25 -0.4M0 ${f(d/2 - 0.1)}v-0.45`, {s:INK, lc:'round'}) + Rc(0, d/2 - 0.55, 0.3, 0.2, {rx:0.04, fill:INK});
  }},
  mandap:{label:'Mandap', cat:'decor', w:4, d:4, resize:true, ground:true, draw:(w, d) => {
    const c = COL.decor, x = w/2 - 0.3, y = d/2 - 0.3; return Rc(0, 0, w, d, {fill:c, fo:0.08, s:c, sw:1.4}) + P(`M${f(-x)} ${f(-y)}Q0 ${f(-y + 0.5)} ${f(x)} ${f(-y)}Q${f(x - 0.5)} 0 ${f(x)} ${f(y)}Q0 ${f(y - 0.5)} ${f(-x)} ${f(y)}Q${f(-x + 0.5)} 0 ${f(-x)} ${f(-y)}`, {s:c, dash:'3 3'}) + [[-x,-y],[x,-y],[x,y],[-x,y]].map(([a,b]) => C(a, b, 0.2, {fill:c, s:c})).join('') + Rc(0, 0, 0.6, 0.6, {fill:PAPER, s:COL.fire}) + C(0, 0, 0.14, {fill:COL.fire});
  }},
  arch:{label:'Flower arch', cat:'decor', w:3, d:0.8, resize:'x', draw:(w) => {
    const c = COL.decor; let s = C(-w/2 + 0.2, 0, 0.18, {fill:c, s:c}) + C(w/2 - 0.2, 0, 0.18, {fill:c, s:c}) + P(`M${f(-w/2 + 0.2)} 0Q0 -0.55 ${f(w/2 - 0.2)} 0`, {s:c, sw:2});
    const n = Math.max(3, Math.round(w / 0.35)); for(let i = 1; i < n; i++){ const t = i / n, x = (-w/2 + 0.2) + t * (w - 0.4), y = -0.55 * 2 * t * (1 - t) * 1; s += C(x, y, 0.08, {fill:c}); }
    return s;
  }},
  rangoli:{label:'Rangoli', cat:'decor', w:2, d:2, round:true, ground:true, draw:(w) => {
    const r = w / 2; let s = C(0, 0, r * 0.95, {fill:COL.decor, fo:0.12, s:COL.decor}) + C(0, 0, r * 0.7, {s:COL.light, sw:1.4}) + C(0, 0, r * 0.22, {fill:COL.fire, fo:0.7});
    for(let i = 0; i < 8; i++) s += `<ellipse cx="0" cy="${f(-r * 0.47)}" rx="${f(r * 0.12)}" ry="${f(r * 0.24)}" fill="var(--c-food)" fill-opacity=".5" transform="rotate(${i * 45})"/>`;
    return s;
  }},
  standee:{label:'Welcome board', cat:'decor', w:1.2, d:0.5, draw:(w, d) => Rc(0, 0, w, 0.12, {fill:COL.decor, fo:0.5, s:COL.decor}) + P(`M${f(-w/3)} 0.06l-0.15 0.18M${f(w/3)} 0.06l0.15 0.18`, {s:COL.decor})},
  gift:{label:'Gift table', cat:'decor', w:1.8, d:0.8, draw:(w, d) => Rc(0, 0, w, d, {rx:0.08, fill:PAPER, s:COL.decor, sw:1.4}) + Rc(-0.4, 0, 0.36, 0.36, {fill:COL.decor, fo:0.3, s:COL.decor}) + Rc(0.1, -0.05, 0.28, 0.28, {fill:COL.light, fo:0.35, s:COL.light}) + Rc(0.5, 0.06, 0.24, 0.24, {fill:COL.decor, fo:0.3, s:COL.decor})},
  plant:{label:'Plant', cat:'decor', w:1.2, d:1.2, round:true, draw:(w) => {
    const r = w / 2, c = COL.zone; let s = '';
    for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; s += C(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.45, {fill:c, fo:0.3, s:c}); }
    return s + C(0, 0, r * 0.25, {fill:c, fo:0.6});
  }},
  fairy:{label:'Fairy lights', cat:'light', w:6, d:0.4, resize:'x', line:true, draw:(w) => {
    const c = COL.light, n = Math.max(2, Math.round(w / 1.5)); let d = `M${f(-w/2)} 0`, s = '';
    for(let i = 0; i < n; i++){ const x0 = -w/2 + i * w / n, x1 = x0 + w / n; d += `Q${f((x0 + x1) / 2)} 0.32 ${f(x1)} 0`; }
    s += P(d, {s:INK, so:0.5});
    const b = Math.max(4, Math.round(w / 0.4)); for(let i = 0; i <= b; i++){ const x = -w/2 + i * w / b, seg = (x + w/2) / (w / n), tt = seg - Math.floor(seg), y = 0.32 * 2 * tt * (1 - tt) * 1; s += C(x, y, 0.13, {fill:'url(#vzg-light)'}) + C(x, y, 0.045, {fill:c}); }
    return s;
  }},
  lantern:{label:'Lamp post', cat:'light', w:0.7, d:0.7, round:true, draw:() => glow(0.35) + C(0, 0, 0.12, {fill:COL.light, s:INK, so:0.4})},
  uplight:{label:'Uplighter', cat:'light', w:0.6, d:0.8, draw:() => P('M0 0.3L-0.28 -0.4A0.4 0.4 0 0 1 0.28 -0.4Z', {fill:'url(#vzg-light)'}) + C(0, 0.3, 0.09, {fill:COL.light, s:INK, so:0.4})},
  diyas:{label:'Diya cluster', cat:'light', w:1, d:1, round:true, draw:() => glow(0.5, 'vzg-fire') + [[0,0],[0.24,0.1],[-0.24,0.1],[0.12,-0.2],[-0.12,-0.2]].map(([x,y]) => C(x, y, 0.07, {fill:COL.fire, s:COL.light})).join('')},
  bonfire:{label:'Bonfire', cat:'light', w:1.8, d:1.8, round:true, draw:() => glow(0.9, 'vzg-fire') + C(0, 0, 0.55, {s:COL.util, sw:2.4, dash:'2 2'}) + Rc(0, 0, 0.75, 0.12, {rx:0.05, fill:'#8a5a3a', t:'rotate(35)'}) + Rc(0, 0, 0.75, 0.12, {rx:0.05, fill:'#8a5a3a', t:'rotate(-35)'}) + C(0, 0, 0.2, {fill:COL.fire}) + C(0, 0, 0.09, {fill:COL.light})},
  fireworks:{label:'Fireworks zone', cat:'light', w:5, d:5, resize:true, ground:true, draw:(w, d) => {
    let s = Rc(0, 0, w, d, {fill:COL.fire, fo:0.06, s:COL.fire, dash:'5 4'});
    for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2, r = Math.min(w, d) * 0.22; s += P(`M${f(Math.cos(a) * r * 0.3)} ${f(Math.sin(a) * r * 0.3)}L${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`, {s:COL.fire, sw:1.6, lc:'round'}); }
    return s;
  }},
  tent:{label:'Shamiana / tent', cat:'util', w:10, d:8, resize:true, ground:true, draw:(w, d) => {
    const c = COL.util, rx = Math.max(0, (w - d) / 2), ry = Math.max(0, (d - w) / 2);
    return Rc(0, 0, w, d, {fill:c, fo:0.06, s:c, sw:1.4, dash:'6 4'}) + P(`M${f(-w/2)} ${f(-d/2)}L${f(-rx)} ${f(-ry)}M${f(w/2)} ${f(-d/2)}L${f(rx)} ${f(-ry)}M${f(-w/2)} ${f(d/2)}L${f(-rx)} ${f(ry)}M${f(w/2)} ${f(d/2)}L${f(rx)} ${f(ry)}M${f(-rx)} ${f(-ry)}L${f(rx)} ${f(ry)}`, {s:c, so:0.6, dash:'3 3'});
  }},
  entry:{label:'Entry', cat:'util', w:3, d:0.8, resize:'x', defLabel:'Entry', draw:(w) => Rc(-w/2 + 0.15, 0, 0.3, 0.3, {fill:WALL}) + Rc(w/2 - 0.15, 0, 0.3, 0.3, {fill:WALL}) + P('M0 0.3V-0.3M-0.22 -0.08L0 -0.32L0.22 -0.08', {s:'var(--gold)', sw:2.2, lc:'round'})},
  exit:{label:'Exit', cat:'util', w:2, d:0.8, resize:'x', defLabel:'Exit', draw:(w) => Rc(-w/2 + 0.12, 0, 0.24, 0.24, {fill:WALL}) + Rc(w/2 - 0.12, 0, 0.24, 0.24, {fill:WALL}) + P('M0 -0.3V0.3M-0.22 0.08L0 0.32L0.22 0.08', {s:COL.util, sw:2.2, lc:'round'})},
  washroom:{label:'Washrooms', cat:'util', w:3, d:2, resize:true, draw:(w, d) => Rc(0, 0, w, d, {rx:0.06, fill:COL.util, fo:0.14, s:COL.util, sw:1.4}) + P(`M0 ${f(-d/2)}V${f(d/2)}`, {s:COL.util}) + T(-w/4, 0, 'WC', 0.42, {fill:COL.util}) + T(w/4, 0, 'WC', 0.42, {fill:COL.util})},
  generator:{label:'Generator', cat:'util', w:1.6, d:1, draw:(w, d) => Rc(0, 0, w, d, {rx:0.06, fill:COL.util, fo:0.18, s:COL.util, sw:1.4}) + P('M0.08 -0.32L-0.16 0.04H0.04L-0.06 0.32L0.2 -0.06H0Z', {fill:COL.light, s:COL.util})},
  speaker:{label:'Speaker', cat:'util', w:0.6, d:0.5, draw:() => Rc(0, 0, 0.5, 0.4, {rx:0.05, fill:INK, fo:0.8}) + C(0, 0, 0.12, {s:PAPER})},
  screen:{label:'LED screen', cat:'util', w:4, d:0.4, resize:'x', draw:(w) => Rc(0, 0, w, 0.18, {fill:INK, fo:0.85}) + Rc(0, 0.14, w * 0.96, 0.05, {fill:'var(--gold)', fo:0.6})},
  parking:{label:'Parking', cat:'util', w:10, d:5, resize:true, ground:true, draw:(w, d) => {
    let s = Rc(0, 0, w, d, {fill:COL.util, fo:0.07, s:COL.util, dash:'5 4'}); const n = Math.max(1, Math.floor(w / 2.5));
    for(let i = 1; i < n; i++) s += P(`M${f(-w/2 + i * w / n)} ${f(-d/2)}v${f(d * 0.55)}`, {s:COL.util, so:0.6});
    return s;
  }},
  pillar:{label:'Pillar', cat:'util', w:0.5, d:0.5, draw:() => Rc(0, 0, 0.5, 0.5, {fill:WALL})},
  wall:{label:'Wall', cat:'util', w:4, d:0.2, resize:'x', draw:(w, d) => Rc(0, 0, w, d, {fill:WALL})},
  zone:{label:'Zone', cat:'util', w:5, d:4, resize:true, ground:true, defLabel:'Zone', draw:(w, d) => Rc(0, 0, w, d, {rx:0.2, fill:COL.zone, fo:0.1, s:COL.zone, sw:1.4, dash:'6 4'})},
  label:{label:'Text label', cat:'util', w:3, d:0.7, resize:'x', defLabel:'Label', draw:(w, d) => Rc(0, 0, w, d, {fill:'transparent'})}
};
const LIB = [
  ['seat','Seating','table_restaurant',['round8','round6','round10','long','cards','cocktail','lounge','baithak','rows']],
  ['food','Food & drink','restaurant',['buffet','bar','live','dessert','tea']],
  ['stage','Stage & fun','celebration',['stage','dj','dance','photobooth','speaker','screen']],
  ['decor','Decor','local_florist',['mandap','arch','rangoli','standee','gift','plant']],
  ['light','Lights & fire','lightbulb',['fairy','lantern','uplight','diyas','bonfire','fireworks']],
  ['util','Structure','foundation',['entry','exit','tent','washroom','generator','parking','pillar','wall','zone','label']]
];
const seatsOf = it => { const c = CAT[it.type]; if(!c || !c.seats) return 0; return typeof c.seats === 'function' ? c.seats(it.w, it.d) : c.seats; };
const GROUNDS = {lawn:'Lawn', terrace:'Terrace tiles', marble:'Marble', wood:'Wooden deck', carpet:'Banquet carpet', sand:'Sand & garden', plain:'Plain'};

function defs(z=30){
  const dk = E.isDark(), pw = px => ` class="pz" data-px="${px}" stroke-width="${f(px / z)}"`;
  const g = {
    lawn: dk ? ['#26331f','#2c3a24'] : ['#a9c48f','#b6cf9b'],
    terrace: dk ? ['#29231f','rgba(255,240,220,.07)'] : ['#e3d8c8','rgba(80,60,40,.14)'],
    marble: dk ? ['#221f26','rgba(255,255,255,.07)'] : ['#f1ece5','rgba(120,110,100,.18)'],
    wood: dk ? ['#33261c','rgba(0,0,0,.35)'] : ['#cfa97d','rgba(90,55,25,.25)'],
    carpet: dk ? ['#3a1622','rgba(216,182,123,.12)'] : ['#7a2a3d','rgba(240,200,140,.22)'],
    sand: dk ? ['#352e22','rgba(255,240,200,.08)'] : ['#e8d6b0','rgba(120,90,50,.18)']
  };
  return `<defs>
    <radialGradient id="vzg-light"><stop offset="0" stop-color="var(--c-light)" stop-opacity=".75"/><stop offset="1" stop-color="var(--c-light)" stop-opacity="0"/></radialGradient>
    <radialGradient id="vzg-fire"><stop offset="0" stop-color="var(--c-fire)" stop-opacity=".8"/><stop offset=".55" stop-color="var(--c-light)" stop-opacity=".3"/><stop offset="1" stop-color="var(--c-light)" stop-opacity="0"/></radialGradient>
    <pattern id="vzp-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="var(--plan-grid)" ${pw(1)}/></pattern>
    <pattern id="vzp-grid5" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="var(--plan-grid-2)" ${pw(1)}/></pattern>
    <pattern id="vzp-lawn" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${g.lawn[0]}"/><rect width="2" height="4" fill="${g.lawn[1]}"/></pattern>
    <pattern id="vzp-terrace" width="0.6" height="0.6" patternUnits="userSpaceOnUse"><rect width="0.6" height="0.6" fill="${g.terrace[0]}"/><path d="M0.6 0H0V0.6" fill="none" stroke="${g.terrace[1]}" ${pw(1)}/></pattern>
    <pattern id="vzp-marble" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${g.marble[0]}"/><path d="M0 1.2C1.5 1.8 2.2 0.6 3.6 1.4S5.4 2.6 6 2.2M0 4.4C1.2 3.8 2.6 5.2 3.8 4.6S5.2 3.6 6 4.1M2 0C2.4 1.4 1.6 2.2 2.2 3.2" fill="none" stroke="${g.marble[1]}" ${pw(1)}/></pattern>
    <pattern id="vzp-wood" width="2.4" height="0.6" patternUnits="userSpaceOnUse"><rect width="2.4" height="0.6" fill="${g.wood[0]}"/><path d="M0 0.3H2.4M0 0.6H2.4M1.2 0V0.3M0.4 0.3V0.6M2 0.3V0.6" fill="none" stroke="${g.wood[1]}" ${pw(1)}/></pattern>
    <pattern id="vzp-carpet" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><rect width="1.2" height="1.2" fill="${g.carpet[0]}"/><path d="M0.6 0.15L1.05 0.6L0.6 1.05L0.15 0.6Z" fill="none" stroke="${g.carpet[1]}" ${pw(1)}/></pattern>
    <pattern id="vzp-sand" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${g.sand[0]}"/><circle cx="0.25" cy="0.3" r="0.03" fill="${g.sand[1]}"/><circle cx="0.7" cy="0.75" r="0.03" fill="${g.sand[1]}"/><circle cx="0.8" cy="0.2" r="0.02" fill="${g.sand[1]}"/></pattern>
  </defs>`;
}
const groundFill = g => g && g !== 'plain' && GROUNDS[g] ? `url(#vzp-${g})` : PAPER;

function itemSvg(it){
  const c = CAT[it.type]; if(!c) return '';
  return c.draw(it.w, it.d, it);
}
function hitShape(it){
  const c = CAT[it.type], w = Math.max(it.w, 0.5), d = Math.max(it.d, 0.5);
  return c && c.round ? C(0, 0, Math.max(w, d) / 2, {fill:'transparent'}) : Rc(0, 0, w, d, {fill:'transparent'});
}
const labelOf = it => it.label != null && it.label !== '' ? it.label : (CAT[it.type]?.defLabel || '');
const ordered = items => [...items].sort((a, b) => (CAT[b.type]?.ground ? 1 : 0) - (CAT[a.type]?.ground ? 1 : 0));

/* static svg of a plan (overview card, layout previews, export) */
function staticSvg(plan, opts={}){
  const W = plan.w, H = plan.h, pad = opts.pad ?? 0.8;
  const items = ordered(plan.items || []).map(it => `<g transform="translate(${f(it.x)} ${f(it.y)}) rotate(${f(it.rot || 0)})">${itemSvg(it)}</g>`).join('');
  const labels = opts.labels ? (plan.items || []).filter(it => labelOf(it)).map(it => T(it.x, it.y, labelOf(it), opts.labelSize || 0.42, {fill:CAT[it.type]?.table ? 'var(--gold)' : INK})).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-pad)} ${f(-pad)} ${f(W + pad * 2)} ${f(H + pad * 2)}" preserveAspectRatio="xMidYMid meet">${defs(opts.z || 18)}<rect x="${f(-pad)}" y="${f(-pad)}" width="${f(W + pad * 2)}" height="${f(H + pad * 2)}" fill="${PAPER}"/><rect width="${f(W)}" height="${f(H)}" fill="${groundFill(plan.ground)}"/>${opts.grid ? `<rect width="${f(W)}" height="${f(H)}" fill="url(#vzp-grid5)"/>` : ''}<rect width="${f(W)}" height="${f(H)}" fill="none" stroke="${WALL}" stroke-width="${opts.wall || 2}"${VE}/>${items}${labels}</svg>`;
}
function symbolSvg(type){
  const c = CAT[type]; const w = c.w, d = c.d, s = Math.max(w, d) * 0.62 + 0.25;
  return `<svg viewBox="${f(-s)} ${f(-s)} ${f(s * 2)} ${f(s * 2)}" xmlns="http://www.w3.org/2000/svg"><g>${c.draw(w, d, {w, d})}</g></svg>`;
}

/* ---------- layouts ---------- */
const mk = (type, x, y, o={}) => ({id:uid() + Math.random().toString(36).slice(2,5), type, x:f(x), y:f(y), rot:o.rot || 0, w:o.w ?? CAT[type].w, d:o.d ?? CAT[type].d, label:o.label ?? null});
function numberTables(items){ let n = 1; items.forEach(it => { if(CAT[it.type]?.table && (it.label == null || it.label === '')) it.label = 'T' + n++; }); return items; }
const LAYOUTS = {
  diwali:{name:'Diwali terrace night', note:'Card tables, floor seating, bar, buffet, diyas and fairy lights', w:18, h:12, ground:'terrace', build:(W, H) => numberTables([
    mk('entry', W/2, H - 0.4, {w:3}), mk('rangoli', W/2, H - 2.3), mk('diyas', W/2 - 2.2, H - 1.1), mk('diyas', W/2 + 2.2, H - 1.1),
    mk('cards', 4.2, 3.6), mk('cards', 6.8, 3.6), mk('cards', 4.2, 6.2), mk('cards', 6.8, 6.2),
    mk('baithak', W - 5.6, 4.0, {w:3.6, d:2.8, label:'Baithak'}), mk('cocktail', W/2 + 0.4, 5.2), mk('cocktail', W/2 - 0.8, 7.6), mk('cocktail', W/2 + 1.8, 8.2),
    mk('bar', W - 1.0, H - 4.6, {rot:-90, w:3.2}), mk('buffet', 1.0, H - 4.8, {rot:90, w:4}), mk('dessert', 1.0, 2.6, {rot:90, w:2.2}),
    mk('dj', W - 1.7, 1.3, {rot:180}), mk('speaker', W - 3.2, 0.7),
    mk('fairy', W/2, 0.35, {w:W - 3}), mk('fairy', 0.35, H/2, {rot:90, w:H - 3}), mk('fairy', W - 0.35, H/2, {rot:90, w:H - 3}),
    mk('lantern', 0.8, 0.8), mk('lantern', 0.8, H - 0.8), mk('lantern', W - 0.8, H - 0.8), mk('plant', 2.2, H - 1.2), mk('plant', W - 2.2, H - 1.2)
  ])},
  lawn:{name:'Lawn reception', note:'Stage, dance floor, round tables, buffet and bar', w:30, h:22, ground:'lawn', build:(W, H) => {
    const items = [mk('stage', W/2, 2.4, {w:7, d:3.6}), mk('photobooth', W/2 + 6.8, 1.6), mk('screen', W/2 - 6.5, 1.2, {w:3.4}), mk('dance', W/2, 7.4, {w:7, d:5}), mk('dj', W/2 - 5.6, 6.8, {rot:90})];
    for(let r = 0; r < 3; r++) for(let c = 0; c < 6; c++){ const x = 4.5 + c * 3.6 + (c >= 3 ? 1.6 : 0); if(x > W - 3.5) continue; items.push(mk('round8', x, 12 + r * 3.3)); }
    items.push(mk('buffet', 1.1, 11, {rot:90, w:5}), mk('live', 1.2, 16.5, {rot:90}), mk('dessert', 1.1, 19.4, {rot:90}), mk('bar', W - 1.0, 13, {rot:-90, w:3.6}), mk('tea', W - 1.0, 17.6, {rot:-90}),
      mk('entry', W/2, H - 0.4, {w:4}), mk('arch', W/2, H - 1.6, {w:4}), mk('standee', W/2 + 3, H - 1.4), mk('washroom', W - 2.2, H - 1.6), mk('generator', 1.4, H - 1.0),
      mk('fairy', W/2, 10, {w:W - 6}), mk('lantern', 3, H - 3), mk('lantern', W - 3, 3.6), mk('lantern', 3, 3.6), mk('plant', W/2 - 4, H - 1.4));
    return numberTables(items);
  }},
  bonfire:{name:'Bonfire night', note:'Fire pit in the middle, floor seating and lounges around it', w:16, h:16, ground:'sand', build:(W, H) => {
    const cx = W/2, cy = H/2 + 0.6, items = [mk('bonfire', cx, cy)];
    [[0, -3.3, 0], [3.3, 0, 90], [0, 3.3, 180], [-3.3, 0, 270]].forEach(([dx, dy, r], i) => items.push(i % 2 ? mk('lounge', cx + dx, cy + dy, {rot:r}) : mk('baithak', cx + dx, cy + dy, {rot:r, w:3, d:1.6})));
    for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; items.push(mk('lantern', cx + Math.cos(a) * 6, cy + Math.sin(a) * 6)); }
    items.push(mk('bar', W/2, 1.0, {w:3.4, rot:180}), mk('live', W - 1.3, 3.2, {rot:-90, label:'BBQ'}), mk('entry', W/2, H - 0.4), mk('fairy', W/2, 2.4, {w:W - 4}), mk('speaker', 1.2, 1.2), mk('plant', 1.4, H - 1.4), mk('plant', W - 1.4, H - 1.4));
    return numberTables(items);
  }},
  banquet:{name:'Banquet dinner', note:'Long tables, stage, buffet and bar on a carpet', w:24, h:16, ground:'carpet', build:(W, H) => {
    const items = [mk('stage', W/2, 2.0, {w:6, d:3}), mk('screen', W/2, 0.5, {w:5})];
    for(let r = 0; r < 4; r++) items.push(mk('long', W/2 - 4.6, 6.2 + r * 2.4, {w:6}), mk('long', W/2 + 4.6, 6.2 + r * 2.4, {w:6}));
    items.push(mk('buffet', 1.0, 9, {rot:90, w:6}), mk('bar', W - 1.0, 9, {rot:-90, w:3.6}), mk('entry', W/2, H - 0.4, {w:3}), mk('standee', W/2 + 2.6, H - 1.2), mk('pillar', 6, 4.2), mk('pillar', W - 6, 4.2), mk('pillar', 6, H - 2), mk('pillar', W - 6, H - 2));
    return numberTables(items);
  }}
};

/* ---------- editor ---------- */
let ed = null;   // the single live editor
function create(evId){
  const el = document.createElement('div');
  el.className = 'vz'; el.tabIndex = 0; el.setAttribute('aria-label', 'Venue layout editor');
  el.innerHTML = `<svg class="canvas" xmlns="http://www.w3.org/2000/svg"><g class="vz-defs"></g><g class="vz-world"><g class="vz-ground"></g><g class="vz-items"></g><g class="vz-labels"></g><g class="vz-sel"></g></g></svg>
    <div class="vz-over">
      <div class="vz-tl"><button class="vz-title" data-v="settings" type="button">${icon('map')}<span class="vz-name"></span></button><div class="vz-stats"></div></div>
      <div class="vz-tr">
        <button class="icon-btn" data-v="undo" aria-label="Undo" type="button">${icon('undo')}</button>
        <button class="icon-btn" data-v="redo" aria-label="Redo" type="button">${icon('redo')}</button>
        <button class="icon-btn" data-v="fit" aria-label="Fit to screen" type="button">${icon('fit_screen')}</button>
        <button class="icon-btn" data-v="snap" aria-label="Snap to grid" type="button">${icon('grid_on')}</button>
        <button class="icon-btn" data-v="share" aria-label="Share as image" type="button">${icon('ios_share')}</button>
      </div>
      <div class="vz-bottom"><div class="vz-scale"><span class="vz-scale-t"></span><i></i></div>
        <div class="vz-actions"><button class="btn ghost" data-v="3d" type="button">${icon('view_in_ar')}3D</button><button class="btn gold" data-v="add" type="button">${icon('add')}Add</button></div></div>
      <div class="vz-insp" hidden></div>
    </div>`;
  const svg = $('svg', el);
  const st = {
    el, svg, evId, world:$('.vz-world', svg), gGround:$('.vz-ground', svg), gItems:$('.vz-items', svg), gLabels:$('.vz-labels', svg), gSel:$('.vz-sel', svg),
    plan:null, view:{z:20, tx:0, ty:0}, sel:null, snap:true, undo:[], redo:[], ptrs:new Map(), mode:null, drag:null, fitted:false, lastSaved:0, saveT:null, dark:E.isDark()
  };
  $('.vz-defs', svg).innerHTML = defs();
  bind(st);
  return st;
}
function blankPlan(ev){ return {name: ev?.venue || 'Venue', w:18, h:12, ground:'terrace', units:'ft', items:[], updatedAt:0}; }

function setPlan(st, doc){
  const p = doc ? JSON.parse(JSON.stringify(doc)) : blankPlan(E.curEv());
  delete p.id;
  p.items = (p.items || []).filter(it => CAT[it.type]);
  st.plan = p; renderAll(st);
}
function renderAll(st){ renderGround(st); renderItems(st); renderSel(st); renderHud(st); applyView(st); }

function renderGround(st){
  const {w, h, ground} = st.plan;
  const u = st.plan.units === 'm' ? 'm' : 'ft', W = u === 'ft' ? Math.round(w * FT) : +w.toFixed(1), H = u === 'ft' ? Math.round(h * FT) : +h.toFixed(1);
  st.gGround.innerHTML = `<rect x="-200" y="-200" width="${w + 400}" height="${h + 400}" fill="url(#vzp-grid)" opacity=".45"/>
    <rect width="${w}" height="${h}" fill="${groundFill(ground)}"/>
    <rect width="${w}" height="${h}" fill="url(#vzp-grid)"/><rect width="${w}" height="${h}" fill="url(#vzp-grid5)"/>
    <rect width="${w}" height="${h}" fill="none" stroke="${WALL}" stroke-width="2.5"${VE}/>
    <text class="vz-dim" x="${f(w / 2)}" y="-0.5" text-anchor="middle" fill="var(--ink-2)">${W} ${u}</text>
    <text class="vz-dim" x="-0.5" y="${f(h / 2)}" text-anchor="middle" fill="var(--ink-2)" transform="rotate(-90 -0.5 ${f(h / 2)})">${H} ${u}</text>`;
}
function itemG(it, sel){
  return `<g class="it${sel ? ' sel' : ''}" data-id="${esc(it.id)}" transform="translate(${f(it.x)} ${f(it.y)}) rotate(${f(it.rot || 0)})">${itemSvg(it)}${hitShape(it)}</g>`;
}
function renderItems(st){
  st.gItems.innerHTML = ordered(st.plan.items).map(it => itemG(it, it.id === st.sel)).join('');
  renderLabels(st);
}
function renderLabels(st){
  st.gLabels.innerHTML = st.plan.items.filter(it => labelOf(it)).map(it => {
    const isT = CAT[it.type]?.table, isL = it.type === 'label';
    return `<text class="vz-lbl${isT ? ' t' : ''}${isL ? ' big' : ''}" data-for="${esc(it.id)}" x="${f(it.x)}" y="${f(it.y)}" text-anchor="middle" dominant-baseline="central">${esc(labelOf(it))}</text>`;
  }).join('');
}
function updateItemDom(st, it){
  const g = st.gItems.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
  if(g){ g.setAttribute('transform', `translate(${f(it.x)} ${f(it.y)}) rotate(${f(it.rot || 0)})`); }
  const t = st.gLabels.querySelector(`[data-for="${CSS.escape(it.id)}"]`);
  if(t){ t.setAttribute('x', f(it.x)); t.setAttribute('y', f(it.y)); }
}
function redrawItem(st, it){
  const g = st.gItems.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
  if(g) g.outerHTML = itemG(it, it.id === st.sel);
  renderLabels(st);
}
const selItem = st => st.plan.items.find(i => i.id === st.sel);
function renderSel(st){
  st.gItems.querySelectorAll('.it.sel').forEach(g => g.classList.remove('sel'));
  const it = selItem(st);
  if(!it){ st.gSel.innerHTML = ''; renderInspector(st); return; }
  st.gItems.querySelector(`[data-id="${CSS.escape(it.id)}"]`)?.classList.add('sel');
  const c = CAT[it.type], z = st.view.z, w = it.w + 0.2, d = it.d + 0.2, hr = 9 / z, off = d / 2 + 26 / z;
  let h = `<g transform="translate(${f(it.x)} ${f(it.y)}) rotate(${f(it.rot || 0)})">`;
  h += c.round ? `<circle r="${f(Math.max(w, d) / 2)}" class="sel-ol" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="5 4"${VE}/>` : `<rect x="${f(-w / 2)}" y="${f(-d / 2)}" width="${f(w)}" height="${f(d)}" class="sel-ol" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="5 4"${VE}/>`;
  h += `<line x1="0" y1="${f(-d / 2)}" x2="0" y2="${f(-off)}" stroke="var(--gold)" stroke-width="1.5"${VE}/><circle class="handle rot" data-h="rot" cx="0" cy="${f(-off)}" r="${f(hr)}" fill="var(--bg)" stroke="var(--gold)" stroke-width="2"${VE}/>`;
  if(c.resize === true) h += `<rect class="handle" data-h="rs" x="${f(w / 2 - hr)}" y="${f(d / 2 - hr)}" width="${f(hr * 2)}" height="${f(hr * 2)}" rx="${f(hr * 0.4)}" fill="var(--bg)" stroke="var(--gold)" stroke-width="2"${VE}/>`;
  if(c.resize === 'x') h += `<rect class="handle" data-h="rx" x="${f(w / 2 - hr)}" y="${f(-hr)}" width="${f(hr * 2)}" height="${f(hr * 2)}" rx="${f(hr)}" fill="var(--bg)" stroke="var(--gold)" stroke-width="2"${VE}/>`;
  st.gSel.innerHTML = h + '</g>';
  renderInspector(st);
}
const fmtLen = (st, m) => st.plan.units === 'm' ? `${(+m).toFixed(1)} m` : `${Math.round(m * FT)} ft`;
function renderInspector(st){
  const box = $('.vz-insp', st.el), it = selItem(st), bottom = $('.vz-bottom', st.el);
  if(!it){ box.hidden = true; bottom.hidden = false; return; }
  const c = CAT[it.type], seats = seatsOf(it), seated = c.table ? S.people.filter(p => p.tableId === it.id).length : 0;
  bottom.hidden = true; box.hidden = false;
  box.innerHTML = `<div class="vz-insp-h"><span class="sym">${symbolSvg(it.type)}</span><div class="grow" style="min-width:0"><b>${esc(labelOf(it) ? `${labelOf(it)} · ${c.label}` : c.label)}</b><small>${fmtLen(st, it.w)} × ${fmtLen(st, it.d)}${seats ? ` · ${seats} seats` : ''}${c.table ? ` · ${seated} seated` : ''} · ${Math.round(((it.rot || 0) % 360 + 360) % 360)}°</small></div><button class="icon-btn" data-v="deselect" aria-label="Done" type="button">${icon('close')}</button></div>
    <div class="vz-tools">
      <button class="icon-btn" data-v="rotl" aria-label="Rotate left" type="button">${icon('rotate_left')}</button>
      <button class="icon-btn" data-v="rotr" aria-label="Rotate right" type="button">${icon('rotate_right')}</button>
      <button class="icon-btn" data-v="dup" aria-label="Duplicate" type="button">${icon('content_copy')}</button>
      <button class="icon-btn" data-v="edit" aria-label="Edit details" type="button">${icon('tune')}</button>
      <button class="icon-btn del" data-v="del" aria-label="Delete" type="button">${icon('delete')}</button>
    </div>`;
}
function renderHud(st){
  const p = st.plan, seats = p.items.reduce((a, it) => a + seatsOf(it), 0), tables = p.items.filter(it => CAT[it.type]?.table).length;
  const ev = E.curEv(), head = ev ? E.stats(ev, S.people, S.expenses).headcount : 0;
  $('.vz-name', st.el).textContent = `${p.name || 'Venue'} · ${fmtLen(st, p.w).replace(/ (ft|m)$/, '')} × ${fmtLen(st, p.h)}`;
  $('.vz-stats', st.el).innerHTML = `<span class="tag gold">${icon('event_seat')}${seats} seats</span>${tables ? `<span class="tag">${tables} tables</span>` : ''}${head ? `<span class="tag ${seats >= head ? 'good' : 'warn'}">${head} coming</span>` : ''}`;
  $('[data-v="undo"]', st.el).disabled = !st.undo.length; $('[data-v="redo"]', st.el).disabled = !st.redo.length;
  $('[data-v="snap"]', st.el).classList.toggle('on', st.snap);
}
function applyView(st){
  const {z, tx, ty} = st.view;
  st.world.setAttribute('transform', `matrix(${z} 0 0 ${z} ${f(tx)} ${f(ty)})`);
  st.svg.style.setProperty('--z', z);
  st.svg.querySelectorAll('.vz-defs .pz').forEach(p => p.setAttribute('stroke-width', f(+p.dataset.px / z)));
  // scale bar: pick a round length close to 90px
  const ft = st.plan.units !== 'm', unitM = ft ? 1 / FT : 1, target = 90 / z / unitM;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200]; const len = steps.find(s => s >= target * 0.6) || 200;
  const bar = $('.vz-scale i', st.el); bar.style.width = f(len * unitM * z) + 'px';
  $('.vz-scale-t', st.el).textContent = `${len} ${ft ? 'ft' : 'm'}`;
  if(st.sel) renderSel(st);
}
function fit(st){
  const r = st.el.getBoundingClientRect(); if(!r.width) return;
  const p = st.plan, padT = r.width < 600 ? 110 : 76, padB = 80, padL = 28, padR = 76;
  const z = Math.max(4, Math.min((r.width - padL - padR) / (p.w + 1.2), (r.height - padT - padB) / (p.h + 1.2)));
  st.view = {z, tx:padL + (r.width - padL - padR - p.w * z) / 2, ty:padT + (r.height - padT - padB - p.h * z) / 2};
  st.fitted = true; applyView(st);
}
function toWorld(st, cx, cy){ const r = st.svg.getBoundingClientRect(); return {x:(cx - r.left - st.view.tx) / st.view.z, y:(cy - r.top - st.view.ty) / st.view.z}; }
function zoomAt(st, factor, cx, cy){
  const r = st.svg.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, v = st.view;
  const z = Math.max(3, Math.min(240, v.z * factor)), k = z / v.z;
  st.view = {z, tx:px - (px - v.tx) * k, ty:py - (py - v.ty) * k}; applyView(st);
}
const snapV = (st, v, step=0.25) => st.snap ? Math.round(v / step) * step : v;

/* history + save */
function checkpoint(st){ st.undo.push(JSON.stringify(st.plan.items)); if(st.undo.length > 80) st.undo.shift(); st.redo = []; }
function commit(st){
  renderHud(st);
  clearTimeout(st.saveT);
  st.saveT = setTimeout(() => persist(st), 450);
}
async function persist(st){
  if(!S.canWrite || !S.cur) return;
  st.plan.updatedAt = Date.now(); st.lastSaved = st.plan.updatedAt;
  const {id, ...data} = st.plan;
  await E.save(Store.set(`events/${st.evId}/venue/main`, JSON.parse(JSON.stringify(data))));
}
function undo(st){ if(!st.undo.length) return; st.redo.push(JSON.stringify(st.plan.items)); st.plan.items = JSON.parse(st.undo.pop()); if(!selItem(st)) st.sel = null; renderItems(st); renderSel(st); commit(st); }
function redo(st){ if(!st.redo.length) return; st.undo.push(JSON.stringify(st.plan.items)); st.plan.items = JSON.parse(st.redo.pop()); if(!selItem(st)) st.sel = null; renderItems(st); renderSel(st); commit(st); }
function select(st, id){ st.sel = id; renderSel(st); }

function addItem(st, type, at){
  if(!S.canWrite) return;
  const c = CAT[type], r = st.el.getBoundingClientRect();
  const center = at || toWorld(st, r.left + r.width / 2, r.top + r.height / 2);
  checkpoint(st);
  const it = {id:'i' + uid(), type, x:f(Math.min(st.plan.w, Math.max(0, snapV(st, center.x)))), y:f(Math.min(st.plan.h, Math.max(0, snapV(st, center.y)))), rot:0, w:c.w, d:c.d, label:null};
  if(c.table){ const used = new Set(st.plan.items.map(i => i.label)); let n = 1; while(used.has('T' + n)) n++; it.label = 'T' + n; }
  st.plan.items.push(it); st.sel = it.id; renderItems(st); renderSel(st); commit(st); E.vibrate(8);
}
function removeSel(st){ const it = selItem(st); if(!it) return; checkpoint(st); st.plan.items = st.plan.items.filter(i => i.id !== it.id); st.sel = null; renderItems(st); renderSel(st); commit(st); E.toast(`${CAT[it.type].label} removed`, 'delete'); }
function dupSel(st){
  const it = selItem(st); if(!it) return; checkpoint(st);
  const n = {...it, id:'i' + uid(), x:f(Math.min(st.plan.w, it.x + 0.6 + (it.round ? 0 : it.w * 0)) ), y:f(Math.min(st.plan.h, it.y + 0.6))};
  const c = CAT[it.type]; n.x = f(Math.min(st.plan.w, it.x + Math.min(3, it.w * 0.6 + 0.6))); n.y = f(it.y);
  if(c.table){ const used = new Set(st.plan.items.map(i => i.label)); let k = 1; while(used.has('T' + k)) k++; n.label = 'T' + k; }
  st.plan.items.push(n); st.sel = n.id; renderItems(st); renderSel(st); commit(st);
}
function rotateSel(st, deg){ const it = selItem(st); if(!it) return; checkpoint(st); it.rot = ((it.rot || 0) + deg + 360) % 360; updateItemDom(st, it); renderSel(st); commit(st); }

/* ---------- gestures ---------- */
function bind(st){
  const svg = st.svg;
  svg.addEventListener('pointerdown', e => {
    if(e.button > 0) return;
    svg.setPointerCapture(e.pointerId);
    st.ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(st.ptrs.size === 2){
      const [a, b] = [...st.ptrs.values()];
      st.mode = 'pinch'; st.pinch = {d:Math.hypot(a.x - b.x, a.y - b.y), mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2};
      if(st.drag && st.drag.moved){ /* finish drag first */ }
      st.drag = null; return;
    }
    const h = e.target.closest('.handle'), g = e.target.closest('.it');
    const w0 = toWorld(st, e.clientX, e.clientY);
    if(h && S.canWrite){
      const it = selItem(st); if(!it) return;
      st.mode = h.dataset.h; st.drag = {it, sx:e.clientX, sy:e.clientY, w0, x:it.x, y:it.y, w:it.w, d:it.d, rot:it.rot || 0, moved:false};
    } else if(g){
      const it = st.plan.items.find(i => i.id === g.dataset.id);
      if(st.sel !== it.id) select(st, it.id);
      st.mode = S.canWrite ? 'move' : 'pan'; st.drag = {it, sx:e.clientX, sy:e.clientY, w0, x:it.x, y:it.y, moved:false, tx:st.view.tx, ty:st.view.ty};
    } else {
      st.mode = 'pan'; st.drag = {sx:e.clientX, sy:e.clientY, tx:st.view.tx, ty:st.view.ty, moved:false, bg:true};
      svg.classList.add('panning');
    }
  });
  svg.addEventListener('pointermove', e => {
    if(!st.ptrs.has(e.pointerId)) return;
    st.ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(st.mode === 'pinch' && st.ptrs.size >= 2){
      const [a, b] = [...st.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      st.view.tx += mx - st.pinch.mx; st.view.ty += my - st.pinch.my;
      zoomAt(st, d / (st.pinch.d || d), mx, my);
      st.pinch = {d, mx, my}; return;
    }
    const D = st.drag; if(!D) return;
    const dx = e.clientX - D.sx, dy = e.clientY - D.sy;
    if(!D.moved && Math.hypot(dx, dy) < 4) return;
    if(!D.moved && D.it && st.mode !== 'pan') checkpoint(st);
    D.moved = true;
    if(st.mode === 'pan'){ st.view.tx = D.tx + dx; st.view.ty = D.ty + dy; applyView(st); return; }
    const w = toWorld(st, e.clientX, e.clientY), it = D.it;
    if(st.mode === 'move'){
      it.x = f(Math.min(st.plan.w + 1, Math.max(-1, snapV(st, D.x + (w.x - D.w0.x)))));
      it.y = f(Math.min(st.plan.h + 1, Math.max(-1, snapV(st, D.y + (w.y - D.w0.y)))));
      updateItemDom(st, it); renderSel(st);
    } else if(st.mode === 'rot'){
      let a = Math.atan2(w.y - it.y, w.x - it.x) * 180 / Math.PI + 90;
      if(!e.altKey) a = Math.round(a / 15) * 15;
      it.rot = ((a % 360) + 360) % 360; updateItemDom(st, it); renderSel(st);
    } else if(st.mode === 'rs' || st.mode === 'rx'){
      const r = -(it.rot || 0) * Math.PI / 180, lx = (w.x - it.x) * Math.cos(r) - (w.y - it.y) * Math.sin(r), ly = (w.x - it.x) * Math.sin(r) + (w.y - it.y) * Math.cos(r);
      it.w = f(Math.max(0.5, snapV(st, Math.abs(lx) * 2 - 0.2, 0.1)));
      if(st.mode === 'rs') it.d = f(Math.max(0.4, snapV(st, Math.abs(ly) * 2 - 0.2, 0.1)));
      redrawItem(st, it); renderSel(st);
    }
  });
  const end = e => {
    if(!st.ptrs.has(e.pointerId)) return;
    st.ptrs.delete(e.pointerId);
    svg.classList.remove('panning');
    if(st.mode === 'pinch'){ if(st.ptrs.size < 2){ st.mode = null; st.drag = null; } return; }
    const D = st.drag; st.drag = null; const mode = st.mode; st.mode = null;
    if(!D) return;
    if(!D.moved){ if(D.bg && st.sel){ select(st, null); } return; }
    if(D.it && mode !== 'pan'){ commit(st); E.vibrate(5); }
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(st, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY); }, {passive:false});
  svg.addEventListener('dblclick', e => { const g = e.target.closest('.it'); if(g){ select(st, g.dataset.id); itemSheet(st); } });
  st.el.addEventListener('keydown', e => {
    if(e.target.closest('input,textarea,select')) return;
    const it = selItem(st), mod = e.metaKey || e.ctrlKey;
    if(mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? redo(st) : undo(st); return; }
    if(!it) return;
    if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeSel(st); }
    else if(e.key === 'Escape') select(st, null);
    else if(mod && e.key.toLowerCase() === 'd'){ e.preventDefault(); dupSel(st); }
    else if(e.key.toLowerCase() === 'r'){ rotateSel(st, e.shiftKey ? -15 : 15); }
    else if(e.key.startsWith('Arrow')){ e.preventDefault(); const s = e.shiftKey ? 1 : 0.1; if(!st.nudging){ checkpoint(st); st.nudging = true; } it.x = f(it.x + (e.key === 'ArrowRight' ? s : e.key === 'ArrowLeft' ? -s : 0)); it.y = f(it.y + (e.key === 'ArrowDown' ? s : e.key === 'ArrowUp' ? -s : 0)); updateItemDom(st, it); renderSel(st); commit(st); }
  });
  st.el.addEventListener('keyup', e => { if(e.key.startsWith('Arrow')) st.nudging = false; });
  st.el.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if(!b) return;
    const v = b.dataset.v;
    if(v === 'undo') undo(st); else if(v === 'redo') redo(st); else if(v === 'fit') fit(st);
    else if(v === 'snap'){ st.snap = !st.snap; renderHud(st); E.toast(st.snap ? 'Snap to grid on' : 'Snap to grid off', 'grid_on'); }
    else if(v === 'add') library(st); else if(v === 'settings') settingsSheet(st); else if(v === 'share') exportImage(st);
    else if(v === '3d') E.venue3d ? E.venue3d.open(st.plan, E.curEv()) : null;
    else if(v === 'deselect') select(st, null); else if(v === 'rotl') rotateSel(st, -15); else if(v === 'rotr') rotateSel(st, 15);
    else if(v === 'dup') dupSel(st); else if(v === 'del') removeSel(st); else if(v === 'edit') itemSheet(st);
  });
  new ResizeObserver(() => { if(st.plan && st.el.isConnected){ if(!st.fitted) fit(st); else applyView(st); } }).observe(st.el);
}

/* ---------- sheets ---------- */
function library(st){
  if(!S.canWrite) return;
  let cat = st.libCat || 'seat';
  const grid = () => { const g = LIB.find(l => l[0] === cat); return g[3].map(t => `<button class="lib-item" type="button" data-t="${t}"><span class="sym">${symbolSvg(t)}</span><b>${esc(CAT[t].label)}</b><small>${fmtLen(st, CAT[t].w)} × ${fmtLen(st, CAT[t].d)}</small></button>`).join(''); };
  E.openSheet({title:'Add to the venue', body:`<div class="lib-cats" id="lib-cats">${LIB.map(([k, l, ic]) => `<button class="chip" type="button" data-c="${k}" aria-pressed="${k === cat}">${icon(ic)}${l}</button>`).join('')}</div>
    <div class="lib-grid" id="lib-grid">${grid()}</div>
    <button class="btn ghost" type="button" id="lib-layouts">${icon('dashboard_customize')}Start from a ready layout</button>`,
  mount: b => {
    $('#lib-cats', b).addEventListener('click', e => { const c = e.target.closest('[data-c]'); if(!c) return; cat = st.libCat = c.dataset.c; $$('#lib-cats .chip', b).forEach(x => x.setAttribute('aria-pressed', x.dataset.c === cat)); $('#lib-grid', b).innerHTML = grid(); });
    $('#lib-grid', b).addEventListener('click', e => { const t = e.target.closest('[data-t]'); if(!t) return; E.closeSheet(); addItem(st, t.dataset.t); });
    $('#lib-layouts', b).addEventListener('click', () => { E.closeSheet(); layoutSheet(st); });
  }});
}
function layoutSheet(st){
  E.openSheet({title:'Ready layouts', body:`<p class="sub">Pick a starting point, then move things around. ${st.plan.items.length ? 'This replaces what is on the plan now; you can undo it.' : ''}</p>
    <div class="layout-grid">${Object.entries(LAYOUTS).map(([k, L]) => { const pv = {w:L.w, h:L.h, ground:L.ground, items:L.build(L.w, L.h)}; return `<button class="layout-opt" type="button" data-l="${k}"><span class="pv">${staticSvg(pv, {pad:0.4, wall:1.5})}</span><span><b>${esc(L.name)}</b><span>${Math.round(L.w * FT)} × ${Math.round(L.h * FT)} ft · ${esc(L.note)}</span></span></button>`; }).join('')}</div>`,
  mount: b => b.addEventListener('click', e => {
    const o = e.target.closest('[data-l]'); if(!o) return; const L = LAYOUTS[o.dataset.l];
    checkpoint(st); st.plan.w = L.w; st.plan.h = L.h; st.plan.ground = L.ground; st.plan.items = L.build(L.w, L.h); st.sel = null;
    E.closeSheet(); renderAll(st); fit(st); commit(st); E.toast(`${L.name} placed. Drag anything to adjust.`, 'wand_stars');
  })});
}
function settingsSheet(st){
  const p = st.plan, ft = p.units !== 'm', cv = m => ft ? Math.round(m * FT) : +(+m).toFixed(1);
  let ground = p.ground || 'plain', units = p.units || 'ft';
  E.openSheet({title:'Venue', body:`
    <label class="field"><span>Venue name</span><input class="input" id="vs-name" maxlength="60" value="${esc(p.name || '')}" placeholder="Rooftop terrace, farmhouse lawn…"></label>
    <div class="field"><span>Units</span><div class="seg" id="vs-units" role="tablist"><button type="button" data-u="ft" aria-selected="${units === 'ft'}">Feet</button><button type="button" data-u="m" aria-selected="${units === 'm'}">Metres</button></div></div>
    <div class="grid2"><label class="field"><span>Width (<em id="vs-u1">${ft ? 'ft' : 'm'}</em>)</span><input class="input" type="number" inputmode="decimal" min="3" id="vs-w" value="${cv(p.w)}"></label>
      <label class="field"><span>Length (<em id="vs-u2">${ft ? 'ft' : 'm'}</em>)</span><input class="input" type="number" inputmode="decimal" min="3" id="vs-h" value="${cv(p.h)}"></label></div>
    <div class="field"><span>Floor</span><div class="chips" id="vs-ground">${Object.entries(GROUNDS).map(([k, l]) => `<button class="chip" type="button" data-g="${k}" aria-pressed="${k === ground}">${l}</button>`).join('')}</div></div>
    <div class="sheet-foot"><button class="btn danger-text" type="button" id="vs-clear">${icon('delete_sweep')}Clear plan</button><span class="grow"></span><button class="btn" type="button" id="vs-save">Save</button></div>`,
  mount: b => {
    $('#vs-units', b).addEventListener('click', e => { const u = e.target.closest('[data-u]'); if(!u || u.dataset.u === units) return;
      const wv = E.num($('#vs-w', b).value), hv = E.num($('#vs-h', b).value), toM = units === 'ft' ? 1 / FT : 1; units = u.dataset.u; const fromM = units === 'ft' ? FT : 1;
      $('#vs-w', b).value = units === 'ft' ? Math.round(wv * toM * fromM) : +(wv * toM).toFixed(1); $('#vs-h', b).value = units === 'ft' ? Math.round(hv * toM * fromM) : +(hv * toM).toFixed(1);
      $$('#vs-units button', b).forEach(x => x.setAttribute('aria-selected', x.dataset.u === units)); $('#vs-u1', b).textContent = $('#vs-u2', b).textContent = units; });
    $('#vs-ground', b).addEventListener('click', e => { const g = e.target.closest('[data-g]'); if(!g) return; ground = g.dataset.g; $$('#vs-ground .chip', b).forEach(x => x.setAttribute('aria-pressed', x.dataset.g === ground)); });
    $('#vs-save', b).addEventListener('click', () => {
      const toM = units === 'ft' ? 1 / FT : 1, w = Math.max(3, Math.min(400, E.num($('#vs-w', b).value) * toM)), h = Math.max(3, Math.min(400, E.num($('#vs-h', b).value) * toM));
      p.name = E.val(b, '#vs-name'); p.units = units; p.ground = ground; p.w = f(w); p.h = f(h);
      E.closeSheet(); renderAll(st); fit(st); commit(st); E.toast('Venue updated', 'map');
    });
    $('#vs-clear', b).addEventListener('click', () => { checkpoint(st); st.plan.items = []; st.sel = null; E.closeSheet(); renderAll(st); commit(st); E.toast('Plan cleared. Undo brings it back.', 'undo'); });
  }});
}
function itemSheet(st){
  const it = selItem(st); if(!it || !S.canWrite) return;
  const c = CAT[it.type], ft = st.plan.units !== 'm', cv = m => ft ? Math.round(m * FT * 10) / 10 : +(+m).toFixed(2), u = ft ? 'ft' : 'm';
  const seatedGuests = c.table ? S.people.filter(p => p.tableId === it.id) : [];
  E.openSheet({title:c.label, body:`
    <label class="field"><span>Label</span><input class="input" id="is-l" maxlength="30" value="${esc(it.label ?? '')}" placeholder="${esc(c.defLabel || (c.table ? 'T1' : 'Optional'))}"></label>
    ${c.resize ? `<div class="grid2"><label class="field"><span>${c.resize === 'x' ? 'Length' : 'Width'} (${u})</span><input class="input" type="number" inputmode="decimal" id="is-w" value="${cv(it.w)}"></label>${c.resize === true ? `<label class="field"><span>Depth (${u})</span><input class="input" type="number" inputmode="decimal" id="is-d" value="${cv(it.d)}"></label>` : '<span></span>'}</div>` : ''}
    <label class="field"><span>Rotation (degrees)</span><input class="input" type="number" inputmode="numeric" id="is-r" value="${Math.round(it.rot || 0)}"></label>
    ${c.table ? `<div class="panel"><span class="eyebrow">Seated here · ${seatedGuests.length} of ${seatsOf(it)}</span>${seatedGuests.length ? `<div class="chips">${seatedGuests.map(g => `<span class="tag">${esc(g.name)}</span>`).join('')}</div>` : `<p class="hint-s">Assign guests to this table from their card in Guests.</p>`}</div>` : ''}
    <div class="sheet-foot"><button class="btn danger-text" type="button" id="is-del">${icon('delete')}Delete</button><span class="grow"></span><button class="btn" type="button" id="is-save">Save</button></div>`,
  mount: b => {
    $('#is-save', b).addEventListener('click', () => {
      checkpoint(st); const toM = ft ? 1 / FT : 1;
      it.label = E.val(b, '#is-l') || null;
      if($('#is-w', b)) it.w = f(Math.max(0.3, E.num($('#is-w', b).value) * toM));
      if($('#is-d', b)) it.d = f(Math.max(0.3, E.num($('#is-d', b).value) * toM));
      it.rot = ((E.num($('#is-r', b).value) % 360) + 360) % 360;
      E.closeSheet(); renderItems(st); renderSel(st); commit(st);
    });
    $('#is-del', b).addEventListener('click', () => { E.closeSheet(); removeSel(st); });
  }});
}

/* ---------- export ---------- */
function resolveVars(svgText){
  const cs = getComputedStyle(document.documentElement);
  return svgText.replace(/var\((--[a-z0-9-]+)\)/gi, (m, v) => (cs.getPropertyValue(v).trim() || '#888'));
}
async function exportImage(st){
  const p = st.plan, ev = E.curEv();
  const svgText = resolveVars(staticSvg(p, {pad:1.2, labels:true, grid:true, labelSize:0.45, z:2000 / (p.w + 2.4)}));
  const scale = 2000 / (p.w + 2.4), Wpx = Math.round((p.w + 2.4) * scale), Hpx = Math.round((p.h + 2.4) * scale), head = 150;
  const img = new Image(); const url = URL.createObjectURL(new Blob([svgText], {type:'image/svg+xml'}));
  try{
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas'); c.width = Wpx; c.height = Hpx + head; const x = c.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    x.fillStyle = cs.getPropertyValue('--plan-paper').trim() || '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, head, Wpx, Hpx);
    x.fillStyle = cs.getPropertyValue('--plan-ink').trim() || '#222';
    x.font = '600 64px "Cormorant Garamond", Georgia, serif'; x.fillText(ev ? ev.name : 'Venue plan', 60, 92);
    x.font = '600 26px "Google Sans Flex", system-ui, sans-serif'; x.fillStyle = cs.getPropertyValue('--gold').trim() || '#a80';
    const seats = p.items.reduce((a, it) => a + seatsOf(it), 0);
    x.fillText(`${(p.name || 'Venue').toUpperCase()} · ${fmtLen(st, p.w)} × ${fmtLen(st, p.h)} · ${seats} SEATS`, 62, 132);
    const blob = await E.toBlob(c, 0.92, 'image/png');
    const file = new File([blob], `${E.slug(ev ? ev.name : 'venue')}-layout.png`, {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:`${ev ? ev.name : 'Venue'} layout`}); return; }catch(e){ if(e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    E.toast('Layout image saved', 'download');
  }catch(e){ console.warn(e); E.toast('Couldn’t make the image. Try again.', 'warning'); }
  finally{ URL.revokeObjectURL(url); }
}

/* ---------- public api ---------- */
E.venue = {
  CAT, LIB, LAYOUTS, seatsOf, labelOf, staticSvg, symbolSvg,
  /** attach the live editor to host for event evId; doc = stored plan or undefined */
  attach(host, evId, doc){
    if(!ed || ed.evId !== evId){ ed = create(evId); setPlan(ed, doc); }
    else if(doc && doc.updatedAt && doc.updatedAt > (ed.plan.updatedAt || 0) && doc.updatedAt !== ed.lastSaved && !ed.drag){ setPlan(ed, doc); }
    if(ed.el.parentNode !== host) host.appendChild(ed.el);
    if(ed.dark !== E.isDark()){ ed.dark = E.isDark(); $('.vz-defs', ed.svg).innerHTML = defs(ed.view.z); }
    renderHud(ed);
    requestAnimationFrame(() => { if(!ed.fitted) fit(ed); });
    return ed;
  },
  reset(){ ed = null; },
  busy(){ return !!(ed && (ed.drag || ed.ptrs.size)); },
  tables(){ const src = ed && ed.evId === S.cur ? ed.plan.items : ((S.venue.find(v => v.id === 'main') || {}).items || []); return src.filter(it => CAT[it.type]?.table).map(it => ({id:it.id, label:labelOf(it) || CAT[it.type].label, seats:seatsOf(it)})).sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric:true})); },
  seatCount(doc){ return ((doc && doc.items) || []).reduce((a, it) => a + seatsOf(it), 0); },
  refreshHud(){ if(ed && ed.plan) renderHud(ed); }
};
})();
