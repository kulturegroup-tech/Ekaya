/* Ekaya home widgets: rotating greeting phrases, a paper-and-foil clock, and weather from MET Norway. */
(() => {
'use strict';
const {$, esc, icon} = E;

/* ---------- greeting phrases (time of day, the season, and what's coming up) ---------- */
const P = {
  late:    ['Moonlit planning, <em>{n}</em>', 'Burning the midnight diya, <em>{n}</em>', 'Night owl mode, <em>{n}</em>', 'Quiet hours, <em>big ideas</em>', 'Still up, <em>{n}</em>?'],
  dawn:    ['Chai first, <em>then plans</em>', 'Rise and shine, <em>{n}</em>', 'Early light, <em>fresh lists</em>', 'Up with the sun, <em>{n}</em>'],
  morning: ['Good morning, <em>{n}</em>', 'Let’s make today <em>count</em>', 'Time for some <em>creative work</em>', 'Fresh day, <em>fresh lists</em>', 'Morning, <em>{n}</em>'],
  noon:    ['Good afternoon, <em>{n}</em>', 'Chai break, <em>then checklists</em>', 'Afternoon, <em>{n}</em>', 'Back to the <em>drawing board</em>'],
  evening: ['Good evening, <em>{n}</em>', 'Golden hour, <em>{n}</em>', 'Time to plan something <em>lovely</em>', 'Evening, <em>{n}</em>'],
  night:   ['Winding down, <em>{n}</em>?', 'Late-night lists, <em>{n}</em>', 'Moonlit planning, <em>{n}</em>', 'Good evening, <em>{n}</em>']
};
const bucket = h => h < 5 ? 'late' : h < 9 ? 'dawn' : h < 12 ? 'morning' : h < 17 ? 'noon' : h < 21 ? 'evening' : 'night';
const hash = s => { let h = 0; for(const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
function phrase(name, events){
  const now = new Date(), b = bucket(now.getHours()), seed = hash(E.today() + b);
  const next = (events || []).filter(e => e.date && E.daysUntil(e.date) >= 0).sort((a, c) => a.date < c.date ? -1 : 1)[0];
  const n = next ? E.daysUntil(next.date) : null;
  const special = [];
  if(next && n === 0) special.push(next.type === 'diwali' ? 'Happy Diwali, <em>{n}</em>' : 'It’s the big day, <em>{n}</em>');
  else if(next && n === 1) special.push('One sleep to go, <em>{n}</em>');
  else if(next && next.type === 'diwali' && n <= 10) special.push('Diyas at the ready, <em>{n}</em>', 'Rangoli season, <em>{n}</em>');
  else if(next && ['wedding', 'sangeet'].includes(next.type) && n <= 45) special.push('Shaadi season, <em>{n}</em>', 'Mehendi on the mind, <em>{n}</em>');
  if(now.getDay() === 0 && b !== 'late') special.push('Sunday plans, <em>{n}</em>?');
  const pool = special.length && (n !== null && n <= 1 || seed % 3 === 0) ? special : P[b];
  return pool[seed % pool.length].replace('{n}', esc(name));
}

/* ---------- clock ---------- */
const clockHtml = () => {
  let ticks = '';
  for(let i = 0; i < 12; i++){ const a = i * 30; if(i === 0) continue; ticks += `<line x1="60" y1="${i % 3 ? 11 : 9}" x2="60" y2="${i % 3 ? 15 : 17}" transform="rotate(${a} 60 60)" class="tk${i % 3 ? '' : ' big'}"/>`; }
  return `<section class="w-card w-clock stock" aria-label="Clock">
    <svg class="dial" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="url(#foil)" stroke-width="1.6"/>
      <circle cx="60" cy="60" r="51.5" fill="none" class="ring2"/>
      ${ticks}
      <path transform="translate(60 14) scale(.42)" d="M0-15C6-7 7 2 0 8-7 2-6-7 0-15Z" fill="url(#foil)"/>
      <line id="w-hh" x1="60" y1="60" x2="60" y2="34" class="hh"/>
      <line id="w-mh" x1="60" y1="60" x2="60" y2="20" class="mh"/>
      <line id="w-sh" x1="60" y1="68" x2="60" y2="16" class="sh"/>
      <circle cx="60" cy="60" r="3.4" fill="url(#foil)"/>
    </svg>
    <div class="w-clock-r"><div class="w-time"><b id="w-time"></b><span id="w-ampm"></span></div><p class="smallcaps" id="w-date"></p><p class="w-zone" id="w-zone"></p></div>
  </section>`;
};
let lastBucket = bucket(new Date().getHours());
function tick(){
  const d = new Date(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const hh = document.getElementById('w-hh');
  if(hh){
    hh.setAttribute('transform', `rotate(${(h % 12) * 30 + m * 0.5} 60 60)`);
    document.getElementById('w-mh').setAttribute('transform', `rotate(${m * 6 + s * 0.1} 60 60)`);
    document.getElementById('w-sh').setAttribute('transform', `rotate(${s * 6} 60 60)`);
    const t = d.toLocaleTimeString('en-IN', {hour:'numeric', minute:'2-digit', hour12:true}).split(' ');
    document.getElementById('w-time').textContent = t[0]; document.getElementById('w-ampm').textContent = (t[1] || '').toLowerCase();
    document.getElementById('w-date').textContent = d.toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'});
    const z = document.getElementById('w-zone'); if(z && !z.textContent) z.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Calcutta' || Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata' ? 'India time' : Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
  }
  const b = bucket(h);
  if(b !== lastBucket){ lastBucket = b; if(!E.S.cur && !E.S.gate) E.render(); }
}
setInterval(() => { if(document.visibilityState === 'visible') tick(); }, 1000);

/* ---------- weather (MET Norway via /api/weather) ---------- */
const CITIES = [['Kanpur', 26.4499, 80.3319], ['Lucknow', 26.8467, 80.9462], ['Delhi', 28.6139, 77.209], ['Agra', 27.1767, 78.0081], ['Varanasi', 25.3176, 82.9739], ['Jaipur', 26.9124, 75.7873], ['Udaipur', 24.5854, 73.7125], ['Mumbai', 19.076, 72.8777], ['Goa', 15.4909, 73.8278], ['Bengaluru', 12.9716, 77.5946]];
const LKEY = 'ekaya-weather-loc', DKEY = 'ekaya-weather-v1';
const ls = { get(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } }, set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
const W = {loc: ls.get(LKEY) || {name:'Kanpur', lat:26.4499, lon:80.3319}, data:null, at:0, loading:false, err:false};
const saved = ls.get(DKEY); if(saved && saved.loc && saved.loc.name === W.loc.name){ W.data = saved.data; W.at = saved.at || 0; }

const LABEL = {clearsky:'Clear', fair:'Mostly clear', partlycloudy:'Partly cloudy', cloudy:'Cloudy', fog:'Foggy', lightrain:'Light rain', rain:'Rain', heavyrain:'Heavy rain', lightrainshowers:'Light showers', rainshowers:'Showers', heavyrainshowers:'Heavy showers',
  lightsleet:'Light sleet', sleet:'Sleet', heavysleet:'Heavy sleet', lightsnow:'Light snow', snow:'Snow', heavysnow:'Heavy snow', sleetshowers:'Sleet showers', snowshowers:'Snow showers'};
const kind = sym => { const b = String(sym || '').replace(/_(day|night|polartwilight)$/, ''); return b.includes('thunder') ? 'thunder' : /rain|showers/.test(b) ? 'rain' : /sleet|snow/.test(b) ? 'snow' : b === 'fog' ? 'fog' : b === 'cloudy' ? 'cloud' : b === 'partlycloudy' || b === 'fair' ? 'part' : 'clear'; };
const isNight = sym => /_night$/.test(sym || '');
function describe(sym){
  const b = String(sym || '').replace(/_(day|night|polartwilight)$/, '');
  let t = LABEL[b] || (b.includes('thunder') ? 'Thunderstorms' : 'Fair');
  if(b === 'clearsky' && isNight(sym)) t = 'Clear night';
  return t;
}
/* line-art weather marks in ink and foil */
function wx(sym, size = 48){
  const k = kind(sym), night = isNight(sym);
  const sun = `<circle cx="24" cy="22" r="7.5" fill="url(#foil)"/>${[0,45,90,135,180,225,270,315].map(a => `<line x1="24" y1="9" x2="24" y2="5" transform="rotate(${a} 24 22)" stroke="url(#foil)" stroke-width="2" stroke-linecap="round"/>`).join('')}`;
  const moon = `<path d="M28 9a12 12 0 1 0 9 19A10 10 0 0 1 28 9Z" fill="url(#foil)"/>`;
  const cloud = (dx = 0, dy = 0, op = 1) => `<path transform="translate(${dx} ${dy})" d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18Z" fill="var(--stock-top)" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="${op}"/>`;
  let g = '';
  if(k === 'clear') g = night ? moon : sun;
  else if(k === 'part') g = `<g transform="translate(-6 -6) scale(.85)">${night ? moon : sun}</g>${cloud(2, 4)}`;
  else if(k === 'cloud') g = `${cloud(-4, -4, .55)}${cloud(2, 3)}`;
  else if(k === 'fog') g = `${cloud(0, -2)}<line x1="10" y1="42" x2="38" y2="42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="46" x2="34" y2="46" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/>`;
  else if(k === 'rain') g = `${cloud(0, -4)}${[16, 24, 32].map((x, i) => `<line x1="${x}" y1="${38 + (i % 2) * 2}" x2="${x - 3}" y2="${45 + (i % 2) * 2}" stroke="url(#foil)" stroke-width="2.2" stroke-linecap="round"/>`).join('')}`;
  else if(k === 'snow') g = `${cloud(0, -4)}${[16, 24, 32].map(x => `<circle cx="${x}" cy="42" r="1.8" fill="url(#foil)"/>`).join('')}`;
  else g = `${cloud(0, -4)}<path d="M25 36l-5 7h5l-3 7 9-10h-5l3-4Z" fill="url(#foil)"/>`;
  return `<svg class="wx" viewBox="0 0 48 52" width="${size}" height="${size * 52 / 48}" aria-hidden="true">${g}</svg>`;
}
const localDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function current(){
  const s = W.data && W.data.series; if(!s || !s.length) return null;
  const now = Date.now(); let i = s.findIndex(x => Date.parse(x.t) > now) - 1; if(i < 0) i = 0;
  const today = E.today(), todays = s.filter(x => localDay(x.t) === today).map(x => x.temp);
  const next = s.slice(i + 1).filter(x => x.span === 1).slice(0, 5);
  return {now:s[i], hi:todays.length ? Math.max(...todays) : null, lo:todays.length ? Math.min(...todays) : null, next};
}
function weatherHtml(){
  if(!E.onNetlify()) return '';
  const c = current(), place = `<button class="w-place" data-act="weather-place" aria-label="Change weather location">${icon('location_on', false, 'xs')}${esc(W.loc.name)}</button>`;
  if(!c) return `<section class="w-card w-weather stock" id="w-weather"><div class="w-head">${place}<span class="w-src">MET Norway</span></div>
    ${W.err ? `<button class="w-retry" data-act="weather-retry">${icon('cloud_off')}<span>Weather is resting.<br><small>Tap to try again.</small></span></button>` : `<div class="w-now skel-line"></div><div class="w-hours skel-line"></div>`}</section>`;
  const hr = t => new Date(t).toLocaleTimeString('en-IN', {hour:'numeric', hour12:true}).replace(' ', '').toLowerCase();
  return `<section class="w-card w-weather stock" id="w-weather">
    <div class="w-head">${place}<span class="w-src">MET Norway</span></div>
    <div class="w-now">${wx(c.now.sym, 54)}<b>${Math.round(c.now.temp)}°</b><div class="w-cond"><span>${describe(c.now.sym)}</span><small>${c.hi != null ? `High ${Math.round(c.hi)}° · Low ${Math.round(c.lo)}°` : ''}${c.now.hum != null ? `${c.hi != null ? ' · ' : ''}${Math.round(c.now.hum)}% humidity` : ''}</small></div></div>
    ${c.next.length ? `<div class="w-hours">${c.next.map(x => `<div><small>${hr(x.t)}</small>${wx(x.sym, 30)}<b>${Math.round(x.temp)}°</b></div>`).join('')}</div>` : ''}
  </section>`;
}
/* the forecast for an event's evening, once it's within MET's ten-day range */
function eventForecast(ev){
  const s = W.data && W.data.series; if(!s || !s.length || !ev.date) return null;
  const target = new Date(`${ev.date}T${ev.time || '19:00'}`).getTime();
  if(target < Date.now() - 3 * 3600e3 || target > Date.parse(s[s.length - 1].t) + 6 * 3600e3) return null;
  let best = s[0]; for(const x of s) if(Math.abs(Date.parse(x.t) - target) < Math.abs(Date.parse(best.t) - target)) best = x;
  return {temp:Math.round(best.temp), sym:best.sym, text:describe(best.sym).toLowerCase(), rain:best.rain};
}
async function load(force){
  if(!E.onNetlify() || W.loading) return;
  if(!force && W.data && Date.now() - W.at < 20 * 60e3) return;
  W.loading = true;
  try{
    const r = await fetch(`/api/weather?lat=${W.loc.lat.toFixed(2)}&lon=${W.loc.lon.toFixed(2)}`);
    const j = await r.json(); if(!r.ok || !j.series) throw new Error(j.error || 'weather');
    W.data = j; W.at = Date.now(); W.err = false; ls.set(DKEY, {loc:W.loc, data:j, at:W.at});
  }catch(e){ W.err = !W.data; }
  finally{ W.loading = false; if(!E.S.cur && !E.S.gate) E.render(); }
}
function placeSheet(){
  E.openSheet({id:'weather', title:'Weather for', body:`<p class="muted">Forecasts come from MET Norway, the Norwegian Meteorological Institute.</p>
    <div class="chips">${CITIES.map(([n]) => `<button class="chip" type="button" data-city="${n}" aria-pressed="${W.loc.name === n}">${n}</button>`).join('')}</div>
    ${navigator.geolocation ? `<button class="btn ghost" type="button" id="w-geo">${icon('my_location')}Use my location</button>` : ''}`,
  mount: b => {
    const set = loc => { W.loc = loc; W.data = null; W.at = 0; W.err = false; ls.set(LKEY, loc); E.closeSheet(); E.render(); load(true); };
    b.addEventListener('click', e => { const c = e.target.closest('[data-city]'); if(c){ const [n, lat, lon] = CITIES.find(x => x[0] === c.dataset.city); set({name:n, lat, lon}); } });
    $('#w-geo', b)?.addEventListener('click', () => navigator.geolocation.getCurrentPosition(p => set({name:'Near you', lat:p.coords.latitude, lon:p.coords.longitude}), () => E.toast('Couldn’t get your location. Pick a city instead.', 'location_off'), {timeout:8000}));
  }});
}
document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if(!t) return; if(t.dataset.act === 'weather-place') placeSheet(); else if(t.dataset.act === 'weather-retry') load(true); });

E.widgets = {phrase, clockHtml, weatherHtml, eventForecast, wx, describe, tick, load, after(){ tick(); load(); }};
})();
