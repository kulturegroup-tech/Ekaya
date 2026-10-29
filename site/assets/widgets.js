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

/* ---------- clock: a foil dial whose hands sweep on their own (CSS animations started at the right moment) ---------- */
const clockHtml = () => {
  const d = new Date(), sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
  let ticks = '';
  for(let i = 0; i < 60; i++){ if(i % 15 === 0) continue; const big = i % 5 === 0; ticks += `<line x1="60" y1="${big ? 9 : 9.5}" x2="60" y2="${big ? 15 : 12}" transform="rotate(${i * 6} 60 60)" class="tk${big ? ' big' : ''}"/>`; }
  const num = (t, x, y) => `<text x="${x}" y="${y}" class="num" text-anchor="middle" dominant-baseline="central">${t}</text>`;
  const t = d.toLocaleTimeString('en-IN', {hour:'numeric', minute:'2-digit', hour12:true}).split(' ');
  return `<section class="tile t-clock fx fx-edge" style="--i:7" aria-label="Clock">
    <div class="clock-in"><svg class="dial" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="57" class="face"/>
      <circle cx="60" cy="60" r="57" fill="none" stroke="url(#foil)" stroke-width="2"/>
      <circle cx="60" cy="60" r="52" fill="none" class="ring2"/>
      ${ticks}${num('3', 99, 60)}${num('6', 60, 100)}${num('9', 21, 60)}
      <path transform="translate(60 18) scale(.5)" d="M0-15C6-7 7 2 0 8-7 2-6-7 0-15Z" fill="url(#foil)"/>
      <g class="hand hh" id="w-hh" style="animation-delay:-${(hr * 3600).toFixed(1)}s;--a:${(hr * 30).toFixed(2)}deg"><path d="M60 66L58 60L60 33L62 60Z" class="hp"/></g>
      <g class="hand mh" id="w-mh" style="animation-delay:-${(min * 60).toFixed(1)}s;--a:${(min * 6).toFixed(2)}deg"><path d="M60 68L58.6 60L60 18L61.4 60Z" class="mp"/></g>
      <g class="hand sh" id="w-sh" style="animation-delay:-${sec.toFixed(2)}s;--a:${(sec * 6).toFixed(2)}deg"><line x1="60" y1="72" x2="60" y2="14" class="sp"/><circle cx="60" cy="60" r="2.6" class="sc"/></g>
      <circle cx="60" cy="60" r="1.2" fill="#fff" opacity=".8"/>
    </svg>
    <div class="clock-txt"><div class="w-time"><b id="w-time">${t[0]}</b><span id="w-ampm">${(t[1] || '').toLowerCase()}</span></div><p class="w-zone" id="w-zone"></p></div></div>
  </section>`;
};
let lastBucket = bucket(new Date().getHours());
function tick(){
  const d = new Date(), h = d.getHours();
  const tm = document.getElementById('w-time');
  if(tm){
    const t = d.toLocaleTimeString('en-IN', {hour:'numeric', minute:'2-digit', hour12:true}).split(' ');
    if(tm.textContent !== t[0]){ tm.innerHTML = `<span class="roll">${t[0]}</span>`; }
    const ap = document.getElementById('w-ampm'); if(ap) ap.textContent = (t[1] || '').toLowerCase();
    // only mention the time zone when it isn't India's
    const z = document.getElementById('w-zone'); if(z && !z.textContent){ const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if(tz !== 'Asia/Calcutta' && tz !== 'Asia/Kolkata') z.textContent = tz.replace(/_/g, ' ') + ' time'; }
    // with reduced motion the hands don't sweep, so place them each second
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ const s = d.getSeconds(), m = d.getMinutes() + s / 60, hr = (h % 12) + m / 60;
      [['w-hh', hr * 30], ['w-mh', m * 6], ['w-sh', s * 6]].forEach(([id, a]) => { const g = document.getElementById(id); if(g) g.style.setProperty('--a', a.toFixed(2) + 'deg'); }); }
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
/* line-art weather marks in ink and foil; on the weather tile the sun turns, clouds drift and rain falls */
function wx(sym, size = 48){
  const k = kind(sym), night = isNight(sym);
  const sun = `<g class="wx-sun"><circle cx="24" cy="22" r="7.5" fill="url(#foil)"/><g class="wx-rays">${[0,45,90,135,180,225,270,315].map(a => `<line x1="24" y1="9.5" x2="24" y2="5" transform="rotate(${a} 24 22)" stroke="#C9A45C" stroke-width="2" stroke-linecap="round"/>`).join('')}</g></g>`;
  const moon = `<g class="wx-moon"><path d="M28 9a12 12 0 1 0 9 19A10 10 0 0 1 28 9Z" fill="url(#foil)"/><circle cx="40" cy="11" r="1" fill="#E2C27C" class="wx-st"/><circle cx="9" cy="16" r=".8" fill="#E2C27C" class="wx-st" style="animation-delay:1.2s"/></g>`;
  const cloud = (dx = 0, dy = 0, op = 1, cls = 'wx-cloud') => `<path class="${cls}" transform="translate(${dx} ${dy})" d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18Z" fill="var(--wx-cloud, var(--stock-top))" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="${op}"/>`;
  let g = '';
  if(k === 'clear') g = night ? moon : sun;
  else if(k === 'part') g = `<g transform="translate(-6 -6) scale(.85)">${night ? moon : sun}</g>${cloud(2, 4)}`;
  else if(k === 'cloud') g = `${cloud(-4, -4, .55, 'wx-cloud b')}${cloud(2, 3)}`;
  else if(k === 'fog') g = `${cloud(0, -2)}<line class="wx-fog" x1="10" y1="42" x2="38" y2="42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line class="wx-fog b" x1="14" y1="46" x2="34" y2="46" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/>`;
  else if(k === 'rain') g = `${cloud(0, -4)}${[16, 24, 32].map((x, i) => `<line class="wx-drop" style="animation-delay:${i * 0.28}s" x1="${x}" y1="${38 + (i % 2) * 2}" x2="${x - 3}" y2="${45 + (i % 2) * 2}" stroke="#C9A45C" stroke-width="2.2" stroke-linecap="round"/>`).join('')}`;
  else if(k === 'snow') g = `${cloud(0, -4)}${[16, 24, 32].map((x, i) => `<circle class="wx-drop" style="animation-delay:${i * 0.4}s" cx="${x}" cy="42" r="1.8" fill="url(#foil)"/>`).join('')}`;
  else g = `${cloud(0, -4)}<path class="wx-bolt" d="M25 36l-5 7h5l-3 7 9-10h-5l3-4Z" fill="url(#foil)"/>`;
  return `<svg class="wx wx-${k}" viewBox="0 0 48 52" width="${size}" height="${size * 52 / 48}" aria-hidden="true">${g}</svg>`;
}
const localDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function current(){
  const s = W.data && W.data.series; if(!s || !s.length) return null;
  const now = Date.now(); let i = s.findIndex(x => Date.parse(x.t) > now) - 1; if(i < 0) i = 0;
  const today = E.today(), todays = s.filter(x => localDay(x.t) === today).map(x => x.temp);
  // the evening is what matters for a party: 6, 8 and 10 pm today (or tomorrow once it's late)
  const hourly = s.filter(x => x.span === 1), day = new Date().getHours() >= 22 ? localDay(Date.now() + 864e5) : today;
  const eve = [18, 20, 22].map(H => hourly.find(x => localDay(x.t) === day && new Date(x.t).getHours() === H)).filter(Boolean).filter(x => Date.parse(x.t) > now - 3600e3);
  return {now:s[i], hi:todays.length ? Math.max(...todays) : null, lo:todays.length ? Math.min(...todays) : null, next:eve, eveLabel:day === today ? 'This evening' : 'Tomorrow evening'};
}
/* the weather tile is a window: its sky follows the conditions and the hour */
const skyOf = sym => { const k = kind(sym), h = new Date().getHours(); if(k === 'rain' || k === 'thunder') return 'rain'; if(k === 'snow' || k === 'fog') return 'fog'; if(isNight(sym) || h >= 20 || h < 5) return 'night'; if(h >= 17) return 'dusk'; if(k === 'cloud') return 'cloud'; return 'day'; };
function weatherHtml(){
  if(!E.onNetlify()) return '';
  const c = current(), place = `<button class="w-place" data-act="weather-place" aria-label="Change weather location">${icon('location_on', false, 'xs')}${esc(W.loc.name)}</button>`;
  if(!c) return `<section class="tile t-wx sky-day" id="w-weather" style="--i:8"><div class="w-head">${place}<span class="w-src">MET Norway</span></div>
    ${W.err ? `<button class="w-retry" data-act="weather-retry">${icon('cloud_off')}<span>Weather is resting.<br><small>Tap to try again.</small></span></button>` : `<div class="w-now skel-line"></div>`}</section>`;
  const hr = t => new Date(t).toLocaleTimeString('en-IN', {hour:'numeric', hour12:true}).replace(' ', '').toLowerCase();
  const sky = skyOf(c.now.sym);
  return `<section class="tile t-wx sky-${sky} fx fx-edge" id="w-weather" style="--i:8">
    ${sky === 'night' ? `<span class="w-stars" aria-hidden="true">${[[12, 18], [30, 10], [58, 22], [74, 9], [88, 30], [46, 36], [20, 44]].map(([x, y], i) => `<i style="left:${x}%;top:${y}%;animation-delay:${(i * 0.7).toFixed(1)}s"></i>`).join('')}</span>` : sky === 'rain' ? '<span class="w-rain" aria-hidden="true"></span>' : ''}
    <div class="w-head">${place}<span class="w-src">MET Norway</span></div>
    <div class="w-now">${wx(c.now.sym, 52)}<b><span data-count="${Math.round(c.now.temp)}">${Math.round(c.now.temp)}</span>°</b><p class="w-cond"><span>${describe(c.now.sym)}</span>${c.hi != null ? `<small>High ${Math.round(c.hi)}°, low ${Math.round(c.lo)}°</small>` : ''}</p></div>
    ${c.next.length ? `<div class="w-eve" aria-label="${c.eveLabel}">${c.next.map(x => `<span>${hr(x.t)}<b>${Math.round(x.temp)}°</b></span>`).join('')}</div>` : ''}
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
