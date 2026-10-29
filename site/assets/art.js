/* Ekaya card artwork: a printed-invitation illustration for each kind of celebration.
   E.art(ev, [w, h]) returns {svg, tone}. Compositions are laid out for the size they are drawn at,
   so a phone hero, a desktop hero and a card band each keep their lanterns and diyas in frame.
   Colours come from the event's theme palette when it has one. Motion is CSS only (see app.css .art). */
(() => {
'use strict';
const f = n => +(+n).toFixed(1);
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? '#' + m[1].toLowerCase() : null; };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const seeded = s => { let h = 2166136261; for(const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
let uid = 0;

const DEFAULTS = {
  diwali:['#F2A33A', '#8C1C3F', '#1E5E59', '#D9A441', '#F6E7C8'],
  wedding:['#F2A33A', '#F6E7C8', '#D6336C', '#2E8B57'], sangeet:['#F2B705', '#D6336C', '#2E8B57', '#FFF4E6'], anniversary:['#D9A441', '#F6E7C8', '#E8809F'],
  birthday:['#FF5C8A', '#FFC23C', '#3EC1D3', '#7C5CFF'], babyshower:['#9AD0EC', '#F7C5CC', '#FFE5A5', '#B8E0D2'],
  party:['#D9A441', '#E8809F', '#7FB7BE'], corporate:['#D9A441', '#9FB3C8', '#F6E7C8']
};
const BASE = {diwali:'#1a0f2e', wedding:'#6a1b29', sangeet:'#5c1238', anniversary:'#4a1424', party:'#1b1430', corporate:'#14213a'};
const KIND = {diwali:'diwali', wedding:'wedding', sangeet:'wedding', anniversary:'wedding', birthday:'birthday', babyshower:'birthday', party:'deco', corporate:'deco'};

/* shared pieces */
function archPath(cx, aw, ys, ya, bottom){
  const L = cx - aw / 2, R = cx + aw / 2, k = (ys - ya);
  return `M${f(L)} ${f(bottom)}V${f(ys)}C${f(L)} ${f(ys - k * 0.62)} ${f(cx - aw * 0.2)} ${f(ya + k * 0.12)} ${f(cx)} ${f(ya)}C${f(cx + aw * 0.2)} ${f(ya + k * 0.12)} ${f(R)} ${f(ys - k * 0.62)} ${f(R)} ${f(ys)}V${f(bottom)}`;
}
function arch(w, h, opt = {}){
  const cx = w / 2, aw = Math.min(w * (opt.wide || 0.6), h * 0.95), ya = h * (opt.top ?? 0.1), ys = ya + aw * 0.42, bot = h + 12;
  const inner = aw - 22;
  return `<path d="${archPath(cx, aw, ys, ya, bot)}" fill="${opt.wash || 'rgba(255,236,200,.05)'}" stroke="url(#foil)" stroke-width="1.6"/>
    <path d="${archPath(cx, inner, ys + 6, ya + 13, bot)}" fill="none" stroke="url(#foil)" stroke-width=".8" opacity=".7"/>
    <g transform="translate(${f(cx)} ${f(ya - 4)})"><path d="M0-17C3-12 4-8 0-4-4-8-3-12 0-17Z" fill="url(#foil)"/><circle cy="-1" r="3" fill="url(#foil)"/></g>`;
}
function toran(w, cols, leaf, y0 = 6, depth = 22){
  const n = Math.max(3, Math.round(w / 110)), sw = w / n; let s = '';
  for(let k = 0; k < n; k++){
    const x0 = k * sw;
    for(let j = 0; j <= 10; j++){ const t = j / 10, x = x0 + sw * t, y = y0 + Math.sin(Math.PI * t) * depth; s += `<circle cx="${f(x)}" cy="${f(y)}" r="${j % 2 ? 4.2 : 5.2}" fill="${cols[(j + k) % cols.length]}"/>`; }
    const lx = x0 + sw / 2, ly = y0 + depth + 6;
    s += `<path d="M${f(lx)} ${f(ly - 4)}c5 6 6 14 0 22c-6-8-5-16 0-22Z" fill="${leaf}"/><circle cx="${f(lx)}" cy="${f(ly - 6)}" r="3.4" fill="url(#foil)"/>`;
    if(k) s += `<circle cx="${f(x0)}" cy="${f(y0 + 4)}" r="3" fill="url(#foil)"/><circle cx="${f(x0)}" cy="${f(y0 + 12)}" r="4.2" fill="${cols[k % cols.length]}"/><circle cx="${f(x0)}" cy="${f(y0 + 21)}" r="5" fill="${cols[(k + 1) % cols.length]}"/>`;
  }
  return `<g class="toran-a">${s}</g>`;
}
function stars(R, n, w, h, avoid, cls = 'tw'){
  let s = '';
  for(let i = 0; i < n; i++){
    const x = R() * w, y = R() * h * 0.62; if(avoid && avoid(x, y)) continue;
    const z = 1.4 + R() * 2.6, q = z * 0.28;
    s += `<path class="${i % 5 === 0 ? cls : ''}" style="--d:${f(R() * 5)}s" d="M${f(x)} ${f(y - z)}L${f(x + q)} ${f(y - q)}L${f(x + z)} ${f(y)}L${f(x + q)} ${f(y + q)}L${f(x)} ${f(y + z)}L${f(x - q)} ${f(y + q)}L${f(x - z)} ${f(y)}L${f(x - q)} ${f(y - q)}Z" fill="#F7E3B0" opacity="${f(0.35 + R() * 0.5)}"/>`;
  }
  return s;
}

/* ---------- Diwali: a night sky through a mehrab arch, hanging kandils, a row of diyas, a rangoli ---------- */
function diwali(w, h, pal, R, id){
  const [mari, rani, peacock] = [pal[0], pal[1] || '#8C1C3F', pal[2] || '#1E5E59'];
  const base = BASE.diwali, top = mix(base, rani, 0.22), deep = mix(base, '#000000', 0.35);
  const cx = w / 2, aw = Math.min(w * 0.6, h * 0.95), narrow = w < 560;
  const inArch = (x, y) => Math.abs(x - cx) < aw / 2 + 14 && y > h * 0.06;
  let g = '';
  // kandils hang outside the arch
  const compact = h < 380, xs = narrow || compact ? [w * 0.09, w * 0.91] : [w * 0.07, w * 0.16, w * 0.84, w * 0.93];
  xs.forEach((x, i) => {
    const L = h * (compact ? 0.3 + i * 0.06 : 0.2 + ((i * 7) % 5) * 0.06), s = narrow ? 15 : 19, c = [mari, rani, mari, peacock][i % 4];
    g += `<g class="sway" style="transform-origin:${f(x)}px 0px;--d:${f(i * 0.7)}s"><line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${f(L - s)}" stroke="#C9A45C" stroke-width="1"/>
      <path transform="translate(${f(x)} ${f(L)})" d="M${-s * 0.35} ${-s - 4}h${s * 0.7}l${s * 0.15} 5h${-s}Z" fill="url(#foil)"/>
      <g transform="translate(${f(x)} ${f(L + 3)})"><circle r="${f(s * 1.6)}" fill="url(#${id}g)" class="glo" style="--d:${f(i * 0.9)}s"/>
        <path d="M0 ${-s}L${f(s * 0.82)} ${f(-s * 0.2)}L${f(s * 0.52)} ${f(s * 0.78)}L0 ${f(s * 1.05)}L${f(-s * 0.52)} ${f(s * 0.78)}L${f(-s * 0.82)} ${f(-s * 0.2)}Z" fill="${c}" stroke="url(#foil)" stroke-width="1.2"/>
        <path d="M0 ${-s}V${f(s * 1.05)}M${f(-s * 0.82)} ${f(-s * 0.2)}L${f(s * 0.52)} ${f(s * 0.78)}M${f(s * 0.82)} ${f(-s * 0.2)}L${f(-s * 0.52)} ${f(s * 0.78)}" stroke="url(#foil)" stroke-width=".7" opacity=".8"/>
        <circle r="${f(s * 0.32)}" fill="#FFE3A8" opacity=".85"/>
        <line x1="0" y1="${f(s * 1.05)}" x2="0" y2="${f(s * 1.9)}" stroke="#C9A45C" stroke-width="1.2"/><circle cy="${f(s * 2)}" r="2.6" fill="url(#foil)"/></g></g>`;
  });
  // rangoli medallion rising from the bottom edge
  const rr = Math.min(w, h) * (narrow ? 0.36 : 0.3), ry = h + rr * 0.42;
  let rang = `<circle r="${f(rr)}" fill="${mix(rani, base, 0.25)}" opacity=".7"/><circle r="${f(rr * 0.86)}" fill="none" stroke="${mari}" stroke-width="5" stroke-dasharray="2 7" stroke-linecap="round"/>`;
  for(let i = 0; i < 16; i++) rang += `<ellipse transform="rotate(${i * 22.5})" cy="${f(-rr * 0.66)}" rx="${f(rr * 0.07)}" ry="${f(rr * 0.15)}" fill="${i % 2 ? mari : '#F6E7C8'}" opacity=".9"/>`;
  rang += `<circle r="${f(rr * 0.5)}" fill="${peacock}"/>`;
  for(let i = 0; i < 8; i++) rang += `<ellipse transform="rotate(${i * 45 + 22.5})" cy="${f(-rr * 0.3)}" rx="${f(rr * 0.09)}" ry="${f(rr * 0.17)}" fill="${mari}"/>`;
  rang += `<circle r="${f(rr * 0.13)}" fill="#F6E7C8"/><circle r="${f(rr * 0.06)}" fill="${rani}"/>`;
  if(!compact) g += `<g transform="translate(${f(cx)} ${f(ry)})" opacity=".92">${rang}</g>`;
  // diyas along the bottom, outside the arch
  const per = narrow ? 2 : 4, dy = h - (narrow ? 16 : 20);
  for(let side = -1; side <= 1; side += 2) for(let i = 0; i < per; i++){
    const x = cx + side * (aw / 2 + (narrow ? 18 : 30) + i * (narrow ? 30 : 42)); if(x < 12 || x > w - 12) continue;
    const s = narrow ? 9 : 11;
    g += `<g transform="translate(${f(x)} ${f(dy)})"><circle cy="-10" r="${s * 2.6}" fill="url(#${id}g)" class="glo" style="--d:${f(R() * 3)}s"/>
      <path d="M${-s * 1.5} -2Q0 ${s * 1.4} ${s * 1.5} -2Z" fill="#B5653A"/><path d="M${-s * 1.5} -2H${s * 1.5}" stroke="url(#foil)" stroke-width="1.6" stroke-linecap="round"/>
      <path class="flick" style="--d:${f(R() * 2)}s;transform-origin:0px -2px" d="M0 ${-s * 1.9}C${s * 0.55} ${-s * 1.1} ${s * 0.45} -3 0 -3C${-s * 0.45} -3 ${-s * 0.55} ${-s * 1.1} 0 ${-s * 1.9}Z" fill="url(#${id}f)"/></g>`;
  }
  return {tone:'dark', defs:`<radialGradient id="${id}b" cx="50%" cy="28%" r="85%"><stop offset="0" stop-color="${top}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${deep}"/></radialGradient>
      <radialGradient id="${id}h" cx="50%" cy="62%" r="45%"><stop offset="0" stop-color="${mari}" stop-opacity=".26"/><stop offset="1" stop-color="${mari}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="#FFC56B" stop-opacity=".55"/><stop offset=".45" stop-color="${mari}" stop-opacity=".18"/><stop offset="1" stop-color="${mari}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF8A2B"/><stop offset=".6" stop-color="#FFC45C"/><stop offset="1" stop-color="#FFF1C2"/></linearGradient>`,
    body:`<rect width="${w}" height="${h}" fill="url(#${id}b)"/>${stars(R, narrow ? 26 : 48, w, h, inArch)}<rect width="${w}" height="${h}" fill="url(#${id}h)"/>
      ${arch(w, h, {wash:'rgba(255,214,150,.05)'})}${toran(w, [mari, '#F6E7C8', rani], peacock)}${g}`};
}

/* ---------- weddings, sangeet, anniversaries: maroon stock, marigold toran, temple bells, florals ---------- */
function wedding(w, h, pal, R, id, type){
  const light = pal.filter(c => lum(c) > 0.33), cols = light.length >= 2 ? light : ['#F2A33A', '#F6E7C8'];
  const darkest = [...pal].sort((a, b) => lum(a) - lum(b))[0];
  const base = darkest && lum(darkest) < 0.35 ? mix(darkest, '#2a0a12', 0.35) : BASE[type] || BASE.wedding;
  const cx = w / 2, narrow = w < 560, aw = Math.min(w * 0.6, h * 0.95);
  let g = '';
  // faint mandala behind the arch
  let man = ''; for(let r = 0.18; r <= 0.5; r += 0.08){ const n = Math.round(12 + r * 40); for(let i = 0; i < n; i++) man += `<ellipse transform="rotate(${f(i * 360 / n)}) translate(0 ${f(-h * r)})" rx="${f(h * 0.012)}" ry="${f(h * 0.03)}" fill="#F6E7C8"/>`; }
  g += `<g transform="translate(${f(cx)} ${f(h * 0.58)})" opacity=".07">${man}</g>`;
  // temple bells either side
  const xs = narrow || h < 380 ? [w * 0.09, w * 0.91] : [w * 0.08, w * 0.17, w * 0.83, w * 0.92];
  xs.forEach((x, i) => { const L = h * (h < 380 ? 0.3 + i * 0.06 : 0.22 + ((i * 3) % 4) * 0.07), s = narrow ? 11 : 14;
    g += `<g class="sway" style="transform-origin:${f(x)}px 0px;--d:${f(i * 0.8)}s"><line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${f(L - s)}" stroke="#C9A45C" stroke-width="1"/>
      ${[0.35, 0.6].map(t => `<circle cx="${f(x)}" cy="${f((L - s) * t)}" r="3.4" fill="${cols[i % cols.length]}"/>`).join('')}
      <path transform="translate(${f(x)} ${f(L)})" d="M0 ${-s}C${s * 0.6} ${-s} ${s * 0.7} ${-s * 0.2} ${s * 0.75} ${s * 0.5}L${s} ${s * 0.85}H${-s}L${-s * 0.75} ${s * 0.5}C${-s * 0.7} ${-s * 0.2} ${-s * 0.6} ${-s} 0 ${-s}Z" fill="url(#foil)"/>
      <circle cx="${f(x)}" cy="${f(L + s * 1.05)}" r="2.6" fill="url(#foil)"/></g>`; });
  // florals in the bottom corners
  const bloom = (x, y, s, c) => { let b = ''; for(let i = 0; i < 8; i++) b += `<ellipse transform="rotate(${i * 45})" cy="${f(-s * 0.55)}" rx="${f(s * 0.32)}" ry="${f(s * 0.55)}" fill="${c}"/>`; return `<g transform="translate(${f(x)} ${f(y)})">${b}<circle r="${f(s * 0.32)}" fill="url(#foil)"/></g>`; };
  const leafP = (x, y, a, s) => `<path transform="translate(${f(x)} ${f(y)}) rotate(${a})" d="M0 0C${s * 0.4} ${-s * 0.5} ${s * 0.4} ${-s} 0 ${-s * 1.4}C${-s * 0.4} ${-s} ${-s * 0.4} ${-s * 0.5} 0 0Z" fill="#3f6b3a"/>`;
  [-1, 1].forEach(side => { const bx = side < 0 ? 0 : w, sc = narrow ? 1.05 : 1.55;
    g += leafP(bx + side * -46 * sc, h - 8, side * 50, 26 * sc) + leafP(bx + side * -18 * sc, h - 52 * sc, side * 20, 24 * sc) + leafP(bx + side * -70 * sc, h - 30 * sc, side * 75, 22 * sc);
    g += bloom(bx + side * -28 * sc, h - 22 * sc, 26 * sc, cols[0]) + bloom(bx + side * -62 * sc, h - 6, 18 * sc, cols[1 % cols.length]) + bloom(bx + side * -12 * sc, h - 64 * sc, 16 * sc, cols[2 % cols.length] || cols[0]); });
  return {tone:'dark', defs:`<radialGradient id="${id}b" cx="50%" cy="30%" r="85%"><stop offset="0" stop-color="${mix(base, '#c0505e', 0.28)}"/><stop offset=".6" stop-color="${base}"/><stop offset="1" stop-color="${mix(base, '#000000', 0.38)}"/></radialGradient>`,
    body:`<rect width="${w}" height="${h}" fill="url(#${id}b)"/>${arch(w, h, {wash:'rgba(255,230,210,.05)'})}${toran(w, [cols[0], '#F6E7C8', cols[1 % cols.length]], '#3f6b3a')}${g}`};
}

/* ---------- birthdays and baby showers: vanilla stock, bunting, confetti, balloons ---------- */
function birthday(w, h, pal, R, id, type){
  const cols = pal.filter(c => lum(c) < 0.92).slice(0, 5), narrow = w < 560;
  let g = '';
  // bunting across the top
  const n = Math.max(5, Math.round(w / 52)), sw = w / n;
  g += `<path d="M0 10Q${f(w / 2)} 46 ${w} 10" fill="none" stroke="#C9A35A" stroke-width="1.2"/>`;
  for(let i = 0; i < n; i++){ const x = (i + 0.5) * sw, t = (i + 0.5) / n, y = 10 + 72 * t * (1 - t);
    g += `<path class="flag" style="transform-origin:${f(x)}px ${f(y)}px;--d:${f(i * 0.25)}s" d="M${f(x - sw * 0.34)} ${f(y)}L${f(x + sw * 0.34)} ${f(y)}L${f(x)} ${f(y + sw * 0.6)}Z" fill="${cols[i % cols.length]}"/>`; }
  // confetti
  for(let i = 0; i < (narrow ? 34 : 70); i++){ const x = R() * w, y = 50 + R() * (h - 60); if(Math.abs(x - w / 2) < w * 0.26 && y > h * 0.22 && y < h * 0.82) continue; const c = cols[i % cols.length];
    g += R() < 0.55 ? `<rect x="${f(x)}" y="${f(y)}" width="${f(5 + R() * 8)}" height="3.4" rx="1.7" fill="${c}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>` : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2 + R() * 3)}" fill="${c}"/>`; }
  // balloons
  const bal = (x, y, s, c, d) => `<g class="bob" style="--d:${d}s"><path d="M${f(x)} ${f(y + s * 1.2)}C${f(x - 8)} ${f(y + s * 2.2)} ${f(x + 10)} ${f(y + s * 2.8)} ${f(x - 2)} ${f(h + 10)}" fill="none" stroke="#B79A6A" stroke-width="1"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 1.2)}" fill="${c}"/><ellipse cx="${f(x - s * 0.35)}" cy="${f(y - s * 0.45)}" rx="${f(s * 0.22)}" ry="${f(s * 0.32)}" fill="#fff" opacity=".45"/><path d="M${f(x - 4)} ${f(y + s * 1.24)}h8l-4 -6Z" fill="${c}"/></g>`;
  const bs = narrow ? 20 : 28;
  g += bal(w - bs * 1.6, h * 0.5, bs, cols[0], 0) + bal(w - bs * 3.1, h * 0.62, bs * 0.85, cols[1 % cols.length], 0.8) + (narrow ? '' : bal(w - bs * 1.2, h * 0.78, bs * 0.7, cols[2 % cols.length], 1.6) + bal(bs * 1.8, h * 0.58, bs * 0.9, cols[3 % cols.length] || cols[0], 1.1) + bal(bs * 3.2, h * 0.74, bs * 0.7, cols[0], 0.4));
  if(type === 'babyshower') g += stars(R, 14, w, h, (x, y) => Math.abs(x - w / 2) < w * 0.3).replace(/#F7E3B0/g, '#E8C770');
  return {tone:'light', defs:`<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF9F0"/><stop offset="1" stop-color="#FBEBDA"/></linearGradient>`,
    body:`<rect width="${w}" height="${h}" fill="url(#${id}b)"/>${g}`};
}

/* ---------- house parties and corporate evenings: art deco fan in foil under a starry sky ---------- */
function deco(w, h, pal, R, id, type){
  const base = BASE[type] || BASE.party, cx = w / 2, by = h + 20, narrow = w < 560;
  let g = '';
  for(let i = 0; i <= 36; i++){ const a = Math.PI + (i / 36) * Math.PI; g += `<line x1="${f(cx)}" y1="${f(by)}" x2="${f(cx + Math.cos(a) * w * 1.2)}" y2="${f(by + Math.sin(a) * w * 1.2)}" stroke="#C9A45C" stroke-width="${i % 3 ? 0.6 : 1.3}" opacity="${i % 3 ? 0.22 : 0.45}"/>`; }
  for(let r = h * 0.22; r <= h * 1.1; r += h * 0.17) g += `<circle cx="${f(cx)}" cy="${f(by)}" r="${f(r)}" fill="none" stroke="url(#foil)" stroke-width="1" opacity=".35"/>`;
  g += stars(R, narrow ? 24 : 44, w, h, null);
  return {tone:'dark', defs:`<radialGradient id="${id}b" cx="50%" cy="100%" r="110%"><stop offset="0" stop-color="${mix(base, '#7a5a9a', 0.3)}"/><stop offset=".6" stop-color="${base}"/><stop offset="1" stop-color="${mix(base, '#000000', 0.4)}"/></radialGradient>`,
    body:`<rect width="${w}" height="${h}" fill="url(#${id}b)"/>${g}`};
}

const DRAW = {diwali, wedding, birthday, deco};
/** artwork for an event at a given drawing size; tone tells the card whether to set light or dark text */
E.art = (ev, size = [800, 420]) => {
  const [w, h] = size, type = ev && E.TYPES[ev.type] ? ev.type : 'party', kind = KIND[type] || 'deco', id = 'ea' + (++uid);
  const pal = ((ev && ev.theme && ev.theme.palette) || []).map(c => hex(c.hex)).filter(Boolean);
  const cols = pal.length >= 3 ? pal : DEFAULTS[type] || DEFAULTS.party;
  const R = seeded((ev && (ev.id || ev.name)) || 'ekaya');
  const a = DRAW[kind](w, h, cols, R, id, type);
  return {tone:a.tone, svg:`<svg class="art art-${kind}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${a.defs}</defs>${a.body}</svg>`};
};
E.artTone = ev => (KIND[ev && ev.type] || 'deco') === 'birthday' ? 'light' : 'dark';
})();
