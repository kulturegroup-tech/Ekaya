/* Ekaya core: helpers, storage, templates, maths, sheets. Exposes window.E */
(() => {
'use strict';
const E = window.E = {};

/* ---------- helpers ---------- */
const $ = E.$ = (s, r=document) => r.querySelector(s);
E.$$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = E.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
E.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
E.icon = (n, fill, cls='') => `<svg class="ms ${cls}" aria-hidden="true"><use href="/assets/icons.svg#${n}${fill ? '-f' : ''}"/></svg>`;
E.inr = n => '₹' + Math.round(+n||0).toLocaleString('en-IN');
E.num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g,'')); return isFinite(n) ? n : 0; };
E.okHex = h => /^#[0-9a-f]{6}$/i.test(h||'') ? h : '#cccccc';
E.slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'x';
const parseD = E.parseD = s => { if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
E.today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
E.daysUntil = s => { const d = parseD(s); if(!d) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.round((d - t) / 864e5); };
E.fmtLong = s => { const d = parseD(s); return d ? d.toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : ''; };
E.fmtMed = s => { const d = parseD(s); return d ? d.toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short'}) : ''; };
E.fmtShort = s => { const d = parseD(s); return d ? d.toLocaleDateString('en-IN', {day:'numeric', month:'short'}) : ''; };
E.fmtTime = t => { if(!t || !/^\d{1,2}:\d{2}/.test(t)) return ''; const [h,m] = t.split(':').map(Number); return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
E.initials = n => { const w = String(n||'?').trim().split(/\s+/); return ((w[0]||'?')[0] + (w.length > 1 ? w[w.length-1][0] : '')).toUpperCase(); };
E.avc = n => { let h = 0; for(const c of String(n)) h = (h*31 + c.charCodeAt(0)) >>> 0; return 'av' + (h % 5); };
E.lin = (p, cls='') => `<div class="lin ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.max(0,Math.min(1,p))*100)}"><i style="--p:${Math.round(Math.max(0,Math.min(1,p))*100)}"></i></div>`;
E.ring = (p, size=68, sw=6, cls='') => {
  const r = (size-sw)/2, c = 2*Math.PI*r, v = Math.max(0, Math.min(1, p)), h = size/2;
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke-width="${sw}" class="ring-t"/>${v > 0 ? `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c*(1-v)).toFixed(2)}" transform="rotate(-90 ${h} ${h})" class="ring-a"/>` : ''}</svg>`;
};
E.waLink = (text, phone) => { let p = String(phone||'').replace(/\D/g,''); if(p.length === 10) p = '91' + p; return `https://wa.me/${p}?text=${encodeURIComponent(text)}`; };
E.upiLink = (vpa, name, amount, note) => `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name||'Ekaya')}${amount > 0 ? `&am=${(+amount).toFixed(2)}&cu=INR` : ''}${note ? `&tn=${encodeURIComponent(String(note).slice(0,50))}` : ''}`;
E.vibrate = ms => { try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} };
E.onNetlify = () => !window.claude && /^https?:/.test(location.protocol);

/* ---------- templates ---------- */
const PALETTES = E.PALETTES = {
  'Marigold Night': [['#F2A33A','Marigold'],['#8C1C3F','Maroon'],['#1E5E59','Peacock'],['#D9A441','Gold'],['#F6E7C8','Ivory']],
  'Emerald Royale': [['#0E5C47','Emerald'],['#D4AF37','Antique gold'],['#7A1F2B','Wine'],['#F3E9D2','Parchment']],
  'Rani & Haldi': [['#D6336C','Rani pink'],['#F2B705','Haldi'],['#2E8B57','Mehendi green'],['#FFF4E6','Cream']],
  'Ivory Blush': [['#F7EFE6','Ivory'],['#E8B7B0','Blush'],['#B98B5E','Champagne'],['#6E7F5C','Sage']],
  'Midnight Gold': [['#14213D','Midnight'],['#C9A24B','Gold'],['#F4EEE2','Pearl'],['#5A3E5D','Plum']],
  'Confetti Pop': [['#FF5C8A','Bubblegum'],['#FFC23C','Sunshine'],['#3EC1D3','Aqua'],['#FFF6EC','Vanilla']],
  'Mint & Cream': [['#A8DCC9','Mint'],['#FFF3E2','Cream'],['#F4B9A7','Peach'],['#6B8F71','Leaf']]
};
E.TYPES = {
  diwali:{label:'Diwali', icon:'festival', name:'Diwali Party'},
  birthday:{label:'Birthday', icon:'cake', name:'Birthday Party'},
  wedding:{label:'Wedding', icon:'diamond', name:'Wedding'},
  sangeet:{label:'Mehendi & Sangeet', icon:'music_note', name:'Mehendi & Sangeet'},
  anniversary:{label:'Anniversary', icon:'wine_bar', name:'Anniversary Dinner'},
  babyshower:{label:'Baby shower', icon:'child_care', name:'Baby Shower'},
  corporate:{label:'Corporate', icon:'business_center', name:'Corporate Event'},
  party:{label:'House party', icon:'celebration', name:'House Party'}
};
const TEMPLATES = E.TEMPLATES = {
  diwali:{theme:'Marigold Night', dress:'Festive Indian or Indo-western', contri:true, cats:['Decor & lights','Diyas & rangoli','Food & mithai','Drinks','Music & games','Return gifts','Misc'],
    tasks:['Confirm guest list and who is in for contri','Lock the venue','Fix the per-head contri and share UPI','Plan the menu and order mithai','Buy diyas, candles and fairy lights','Rangoli colours and design','Card table setup: cards, chips and prizes','Playlist and speaker','Send the dress code to the group','Return gifts','Clean-up plan for the next morning']},
  birthday:{theme:'Confetti Pop', dress:'Smart casual', cats:['Venue','Cake','Food','Decor','Entertainment','Return gifts'],
    tasks:['Fix date and venue','Guest list and invites','Order the cake','Decor theme and balloons','Plan the food','Games or entertainment','Return gifts','Photo corner']},
  wedding:{theme:'Emerald Royale', dress:'Traditional', cats:['Venue','Catering','Decor','Photography & film','Makeup & styling','Outfits','Invitations','Music & DJ','Mehendi','Transport & stay','Pandit & rituals'],
    tasks:['Finalise venue and dates','Confirm budget with the family','Book photographer and filmmaker','Book the decorator','Caterer tasting','Bridal makeup trial','Send invitations','Book the mehendi artist','DJ and sangeet choreography','Guest stay and transport','Pandit and puja samagri','Day-of timeline']},
  sangeet:{theme:'Rani & Haldi', dress:'Bright festive', cats:['Venue','Stage & decor','Sound & DJ','Choreographer','Mehendi artist','Food','Outfits'],
    tasks:['Book the choreographer','Song list for each family','Book the mehendi artist','Stage and seating plan','Sound check','Outfit coordination']},
  anniversary:{theme:'Ivory Blush', dress:'Cocktail', cats:['Venue','Food','Decor','Cake','Gifts','Photography'],
    tasks:['Guest list','Book the venue','Photo slideshow','Order the cake','Toasts and speeches','Gift']},
  babyshower:{theme:'Mint & Cream', dress:'Pastels', cats:['Venue','Food','Decor','Games','Return gifts'],
    tasks:['Guest list','Theme and decor','Games and prizes','Menu','Return gifts','Godh bharai rituals']},
  corporate:{theme:'Midnight Gold', dress:'Business formal', cats:['Venue','AV & stage','Catering','Branding','Gifts','Transport'],
    tasks:['Brief and guest count','Book the venue','AV and stage','Branding and standees','Catering','Agenda and run of show','Gifts','Invites and RSVP']},
  party:{theme:'Midnight Gold', dress:'Smart casual', contri:true, cats:['Venue','Food','Drinks','Decor','Music'],
    tasks:['Guest list','Menu','Drinks','Playlist','Decor']}
};
const pal = E.pal = name => (PALETTES[name]||[]).map(([hex,n]) => ({hex, name:n}));
E.eventFromTemplate = (type, f) => {
  const t = TEMPLATES[type] || TEMPLATES.party;
  return { name:f.name, type, date:f.date||'', time:f.time||'', venue:f.venue||'', guests:+f.guests||0, budget:+f.budget||0, perHead:+f.perHead||0,
    upi:f.upi||'', notes:'', contri: f.contri ?? !!t.contri,
    theme:{name:t.theme, dress:t.dress, palette:pal(t.theme)},
    categories:t.cats.map(n => ({id:E.slug(n), name:n, planned:0})), createdAt:f.createdAt||Date.now() };
};
E.tasksFromTemplate = (type, now) => (TEMPLATES[type] || TEMPLATES.party).tasks.map((text,i) => ({id:'t'+String(i+1).padStart(2,'0'), data:{text, done:false, due:'', order:i, createdAt:now+i}}));
E.contriOn = ev => ev && (ev.contri ?? (+ev.perHead > 0 || ev.type === 'diwali' || ev.type === 'party'));

/* ---------- store: Claude shared db when present, this browser otherwise ---------- */
E.Store = (() => {
  let db = null, mode = 'loading', local = {};
  const LKEY = 'ekaya-store-v1', listeners = new Map(), queues = new Map();
  const colOf = p => { const a = p.split('/'); return [a.slice(0,-1).join('/'), a[a.length-1]]; };
  const rows = col => Object.entries(local[col]||{}).map(([id,d]) => ({id, ...d}));
  const emit = col => { const set = listeners.get(col); if(!set) return; const r = rows(col); set.forEach(cb => queueMicrotask(() => cb(r))); };
  const persist = () => { try{ localStorage.setItem(LKEY, JSON.stringify(local)); }catch(e){ throw Object.assign(new Error('local_full'), {code:'local_full'}); } };
  const merge = (a,b) => { const o = {...a}; for(const k in b){ const v = b[k]; o[k] = (v && typeof v==='object' && !Array.isArray(v) && a[k] && typeof a[k]==='object' && !Array.isArray(a[k])) ? merge(a[k], v) : v; } return o; };
  const q = (path, fn) => { const next = (queues.get(path)||Promise.resolve()).catch(()=>{}).then(fn); queues.set(path, next); return next; };
  return {
    get mode(){ return mode; },
    init(ns){ if(ns){ db = ns; mode = 'cloud'; } else { try{ local = JSON.parse(localStorage.getItem(LKEY)||'{}') || {}; }catch(e){ local = {}; } mode = 'local'; } },
    subscribe(col, cb, onErr){
      if(mode === 'cloud') return db.collection(col).onSnapshot(s => cb(s.docs.map(d => ({id:d.id, ...d.data()}))), e => onErr && onErr(e));
      if(!listeners.has(col)) listeners.set(col, new Set());
      listeners.get(col).add(cb); queueMicrotask(() => cb(rows(col)));
      return () => listeners.get(col)?.delete(cb);
    },
    set(path, data){ return q(path, async () => { if(mode === 'cloud') return db.doc(path).set(data); const [c,id] = colOf(path); (local[c] ||= {})[id] = JSON.parse(JSON.stringify(data)); persist(); emit(c); }); },
    update(path, patch){ return q(path, async () => { if(mode === 'cloud') return db.doc(path).update(patch); const [c,id] = colOf(path); if(!local[c]?.[id]) throw Object.assign(new Error('missing'), {code:'invalid_argument'}); local[c][id] = merge(local[c][id], JSON.parse(JSON.stringify(patch))); persist(); emit(c); }); },
    remove(path){ return q(path, async () => { if(mode === 'cloud') return db.doc(path).delete(); const [c,id] = colOf(path); if(local[c]) delete local[c][id]; persist(); emit(c); }); }
  };
})();

/* ---------- state ---------- */
const S = E.S = { canWrite:true, events:[], evLoaded:false, cur:null, tab:'overview', sub:{plan:'venue', budget:'collect'}, filter:'all', query:'', doneOpen:false,
  people:[], expenses:[], mood:[], tasks:[], venue:[], loaded:{}, assets:null, justCreated:null };
E.curEv = () => S.events.find(e => e.id === S.cur);
E.evPath = (sub, id) => `events/${S.cur}/${sub}` + (id ? `/${id}` : '');

/* ---------- feedback ---------- */
let toastT;
E.toast = (msg, ic='check_circle') => { const s = $('#snack'); s.innerHTML = `${E.icon(ic,false,'sm')}<span>${esc(msg)}</span>`; s.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => s.classList.remove('show'), 3000); };
E.writeErr = e => {
  const c = e && e.code;
  if(c === 'invalid_argument'){ S.canWrite = false; E.render && E.render(); E.toast('This view can’t save changes.', 'info'); }
  else if(c === 'quota_exceeded') E.toast('Storage is full. Delete a few old items and try again.', 'warning');
  else if(c === 'local_full') E.toast('This browser is out of space. Remove a few photos and try again.', 'warning');
  else E.toast('Couldn’t save just now. Try again.', 'warning');
};
E.save = async p => { try{ await p; return true; }catch(e){ console.warn(e); E.writeErr(e); return false; } };

/* ---------- money & guest maths ---------- */
E.stats = (ev, people, expenses) => {
  const contri = E.contriOn(ev), per = +ev.perHead || 0;
  const ids = new Set(people.map(p => p.id));
  const rows = people.map(p => {
    const paidIn = (p.payments||[]).reduce((a,x) => a + (+x.amount||0), 0);
    const directList = expenses.filter(x => x.paidBy === p.id);
    const direct = directList.reduce((a,x) => a + (+x.amount||0), 0);
    const expected = !contri ? 0 : (p.expected !== null && p.expected !== undefined && p.expected !== '') ? +p.expected : per;
    const contributed = paidIn + direct;
    const due = Math.max(0, expected - contributed);
    const status = expected <= 0 ? (contributed > 0 ? 'paid' : 'none') : contributed >= expected ? 'paid' : contributed > 0 ? 'part' : 'pending';
    return {...p, rsvp:p.rsvp || 'invited', plusOnes:+p.plusOnes || 0, paidIn, direct, directList, expected, contributed, due, status};
  }).sort((a,b) => String(a.name).localeCompare(String(b.name)));
  const target = rows.reduce((a,r) => a + r.expected, 0);
  const collected = rows.reduce((a,r) => a + r.contributed, 0);
  const potIn = rows.reduce((a,r) => a + r.paidIn, 0);
  const spent = expenses.reduce((a,x) => a + (+x.amount||0), 0);
  const potSpent = expenses.filter(x => !ids.has(x.paidBy)).reduce((a,x) => a + (+x.amount||0), 0);
  const pending = rows.reduce((a,r) => a + r.due, 0);
  const sharers = rows.filter(r => r.expected > 0 || r.contributed > 0);
  const count = k => rows.filter(r => r.rsvp === k).length;
  const going = rows.filter(r => r.rsvp === 'going');
  return {contri, rows, target, collected, potIn, spent, potSpent, inHand:potIn - potSpent, pending,
    pendingCount:rows.filter(r => r.due > 0).length, paidCount:rows.filter(r => r.status === 'paid').length,
    budget:(+ev.budget || target), sharers, fair: sharers.length ? spent / sharers.length : 0,
    rsvp:{going:count('going'), maybe:count('maybe'), no:count('no'), invited:count('invited')},
    headcount: going.reduce((a,r) => a + 1 + r.plusOnes, 0)};
};

/* ---------- sheets ---------- */
let sheetCtx = null, lastFocus = null;
E.openSheet = ({title, body, mount, refresh}) => {
  lastFocus = document.activeElement;
  const sh = $('#sheet');
  sh.innerHTML = `<div class="handle" aria-hidden="true"></div><div class="sheet-head"><h2 id="sheetTitle">${title}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">${E.icon('close')}</button></div><div class="sheet-body">${body}</div>`;
  sh.setAttribute('aria-labelledby', 'sheetTitle');
  sh.hidden = false; $('#scrim').hidden = false; document.body.classList.add('sheet-open');
  const b = $('.sheet-body', sh);
  sheetCtx = {refresh, body:b};
  mount && mount(b);
  const af = $('[data-autofocus]', b);
  (af || $('.icon-btn', sh)).focus({preventScroll:true});
  return b;
};
E.closeSheet = () => {
  const sh = $('#sheet'); if(sh.hidden) return;
  sh.hidden = true; sh.innerHTML = ''; $('#scrim').hidden = true; document.body.classList.remove('sheet-open'); sheetCtx = null;
  if(lastFocus && document.contains(lastFocus)) lastFocus.focus({preventScroll:true});
};
E.refreshSheet = () => { if(sheetCtx && sheetCtx.refresh) sheetCtx.refresh(sheetCtx.body); };
E.val = (b, sel) => ($(sel, b)?.value ?? '').trim();

E.copyText = (text, ta) => {
  const fallback = () => { if(ta){ ta.focus(); ta.select(); E.toast('Selected. Copy it from here.', 'content_copy'); } else E.messageSheet('Message', text); };
  try{ navigator.clipboard.writeText(text).then(() => E.toast('Copied', 'content_copy'), fallback); }catch(e){ fallback(); }
};
E.messageSheet = (title, text, phone) => {
  E.openSheet({title, body:`<label class="field"><span>Edit before sending if you like</span><textarea class="input msg" id="msg-t">${esc(text)}</textarea></label>
    <div class="sheet-foot"><a class="btn ghost" id="msg-wa" target="_blank" rel="noopener" href="${esc(E.waLink(text, phone))}">${E.icon('chat')}WhatsApp</a><button class="btn" type="button" id="msg-copy">${E.icon('content_copy')}Copy</button></div>`,
  mount: b => { const ta = $('#msg-t', b); ta.addEventListener('input', () => { $('#msg-wa', b).href = E.waLink(ta.value, phone); }); $('#msg-copy', b).addEventListener('click', () => E.copyText(ta.value, ta)); }});
};
E.share = async (data, fallbackText) => {
  try{ if(navigator.share){ await navigator.share(data); return true; } }catch(e){ if(e && e.name === 'AbortError') return false; }
  if(fallbackText) E.copyText(fallbackText);
  return false;
};

/* ---------- theme ---------- */
const TKEY = 'ekaya-theme';
E.getTheme = () => { try{ return localStorage.getItem(TKEY) || 'auto'; }catch(e){ return 'auto'; } };
E.setTheme = t => { try{ localStorage.setItem(TKEY, t); }catch(e){} E.applyTheme(); };
E.applyTheme = () => { const t = E.getTheme(); if(t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); };
E.isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
E.applyTheme();

/* ---------- images ---------- */
E.loadImg = file => new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(u); rej(Object.assign(new Error('decode'), {code:'decode'})); }; im.src = u; });
E.scaled = async (file, max, bg='#ffffff') => {
  const im = await E.loadImg(file), w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w*s)); c.height = Math.max(1, Math.round(h*s));
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
  URL.revokeObjectURL(im.src); return c;
};
E.toBlob = (c, q=.85, type='image/jpeg') => new Promise(r => c.toBlob(r, type, q));

/* ---------- QR ---------- */
E.qrSvg = (text, dark='#1C1611') => {
  if(typeof window.qrcode !== 'function') return '';
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(); let d = '';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n+4} ${n+4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n+4}" height="${n+4}" fill="#ffffff"/><path d="${d}" fill="${dark}"/></svg>`;
};

/* grain texture */
try{ const c = document.createElement('canvas'); c.width = c.height = 140; const x = c.getContext('2d'), im = x.createImageData(140,140);
  for(let i = 0; i < im.data.length; i += 4){ const v = Math.random()*255|0; im.data[i] = im.data[i+1] = im.data[i+2] = v; im.data[i+3] = 255; }
  x.putImageData(im, 0, 0); document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`); }catch(e){}
})();
