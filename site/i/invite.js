/* Ekaya invitation: the page a household opens from its personal link (/i/#token).
   The token stays in the URL fragment, so it never reaches server logs or other sites.
   Nothing here is trusted: the server decides what this household may see and do. */
(() => {
'use strict';
const {$, esc, icon, inr} = E;
const frag = decodeURIComponent(location.hash.replace(/^#/, ''));
const PREVIEW = (/^preview=([A-Za-z0-9_.:@+-]{1,80})$/.exec(frag) || [])[1] || '';
const TOKEN = PREVIEW ? '' : (/^([A-Za-z0-9_-]{40,60})/.exec(frag) || [])[1] || '';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
let data = null, form = null, editing = false, ui = {qr:!mobile, claim:false, cal:false}, sending = false;

/* ---------- small helpers ---------- */
let toastT;
const toast = (m, ic = 'check_circle') => { const s = $('#snack'); s.innerHTML = `${icon(ic, false, 'sm')}<span>${esc(m)}</span>`; s.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => s.classList.remove('show'), 3200); };
const copy = (text, what) => { const done = () => toast(`${what} copied`, 'content_copy'); try{ navigator.clipboard.writeText(String(text)).then(done, () => prompt('Copy this:', text)); }catch(e){ prompt('Copy this:', text); } };
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const days = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
const phase = () => { const d = data.event.date, t = data.today; return !d || t < d ? 'before' : t === d ? 'day' : 'after'; };
const RS = {going:'Coming', maybe:'Maybe', no:'Can’t make it'};

async function api(path, body){
  const headers = {};
  if(PREVIEW){ try{ const t = localStorage.getItem('ekaya-token'); if(t) headers.authorization = 'Bearer ' + t; }catch(e){} }
  else headers['x-invite'] = TOKEN;
  if(body) headers['content-type'] = 'application/json';
  let r;
  try{ r = await fetch('/api/invite/' + path, {method:body ? 'POST' : 'GET', headers, body:body ? JSON.stringify(body) : undefined, cache:'no-store', referrerPolicy:'no-referrer'}); }
  catch(e){ throw Object.assign(new Error('Not sent yet. Check your connection and try again.'), {offline:true}); }
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again in a moment.'), {status:r.status, gone:!!j.gone});
  return j;
}

/* ---------- loading ---------- */
async function load(){
  if(!TOKEN && !PREVIEW){ stop('This invitation link isn’t complete.', 'Open it again from the WhatsApp message, or ask the host to send it again.'); return; }
  try{
    data = await api(PREVIEW ? 'preview?ev=' + encodeURIComponent(PREVIEW) : 'me');
    startForm(); render();
  }catch(e){
    if(PREVIEW && e.status === 401) stop('Sign in to preview', 'Open Ekāya Events on this device and sign in, then tap Preview again.');
    else if(e.gone || e.status === 404 || e.status === 410) stop('This invitation has closed', e.message);
    else stop('Couldn’t open your invitation', e.offline ? 'Check your connection and try again.' : e.message, true);
  }
}
function stop(title, msg, retry){
  $('#iv').innerHTML = `${logo()}<section class="iv-card iv-stop plain foil"><span class="iv-seal">${icon('mail')}</span><h1 class="iv-h">${esc(title)}</h1><p class="sub">${esc(msg)}</p>${retry ? `<button class="btn" type="button" id="iv-retry">${icon('refresh')}Try again</button>` : ''}</section>${foot(false)}`;
  $('#iv-retry')?.addEventListener('click', () => { $('#iv').innerHTML = skeleton(); load(); });
}
const skeleton = () => `${logo()}<section class="iv-card plain foil iv-skel"><div class="iv-face"></div><div class="iv-body"><i></i><i></i><i></i></div></section>`;
const logo = () => `<div class="iv-logo"><span class="logo" role="img" aria-label="Ekāya Events"><svg class="lg-mark" aria-hidden="true"><use href="/assets/brand.svg#mark"/></svg><span class="lg-text"><svg class="lg-word" aria-hidden="true"><use href="/assets/brand.svg#ekaya"/></svg><span class="lg-tag">Events</span></span></span></div>`;

function startForm(){
  const h = data.household, r = h.reply;
  form = r ? {rsvp:r.rsvp, coming:Math.min(h.max, Math.max(1, r.coming || h.max)), meals:{...(r.meals || {})}, note:r.note || ''} : {rsvp:'', coming:h.max, meals:{}, note:''};
  editing = !r;
}

/* ---------- the invitation ---------- */
function when(ev){
  const d = ev.date ? E.fmtLong(ev.date).replace(/,? \d{4}$/, '') : '', t = ev.time ? E.fmtTime(ev.time) : '';
  return [d, t].filter(Boolean).join(' · ');
}
const forLine = h => { const n = String(h.name || '').trim(); if(/\b(family|parivar|fam)\b/i.test(n)) return `For ${/^the\s/i.test(n) ? '' : 'the '}${n}`; return h.max > 1 ? `For ${n} and family` : `For ${n}`; };
const mapUrl = ev => ev.map || (ev.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.venue)}` : '');
function inviteCard(){
  const ev = data.event, h = data.household, ph = phase(), n = ev.date ? days(ev.date, data.today) : null;
  const count = n === null ? '' : n > 1 ? `In ${n} days` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : '';
  const face = ev.cover ? `<img src="/api/data/img/${esc(ev.cover.img)}" alt="" loading="eager">` : '';
  return `<section class="iv-card iv-invite plain foil">
    <div class="iv-face ${ev.cover ? 'photo' : ''}" data-art>${face}</div>
    <div class="iv-body">
      <p class="iv-k">${ph === 'after' ? 'Thank you for celebrating' : 'You’re invited'}</p>
      <p class="iv-for">${esc(forLine(h))}</p>
      <h1 class="iv-title">${esc(ev.name)}</h1>
      ${E.divider(150)}
      ${when(ev) ? `<p class="iv-when">${esc(when(ev))}</p>` : ''}
      ${ev.venue ? `<p class="iv-where">${esc(ev.venue)}</p>` : ''}
      ${ev.dress ? `<p class="iv-dress"><span>Dress code</span>${esc(ev.dress)}</p>` : ''}
      ${count && ph !== 'after' ? `<span class="iv-count">${count}</span>` : ''}
      ${ph !== 'after' && (mapUrl(ev) || ev.date) ? `<div class="iv-acts">${mapUrl(ev) ? `<a class="btn ghost" href="${esc(mapUrl(ev))}" target="_blank" rel="noopener noreferrer">${icon('directions')}Directions</a>` : ''}${ev.date ? `<button class="btn ghost" type="button" data-a="cal" aria-expanded="${ui.cal}">${icon('calendar_add_on')}Save the date</button>` : ''}</div>
      <div class="iv-cal" ${ui.cal ? '' : 'hidden'}><button class="btn text" type="button" data-a="ics">${icon('event')}Apple or Outlook calendar</button><a class="btn text" href="${esc(gcal(ev))}" target="_blank" rel="noopener noreferrer">${icon('open_in_new')}Google Calendar</a></div>` : ''}
      <p class="iv-host">With love, ${esc(ev.host)}</p>
    </div></section>`;
}

/* ---------- the reply ---------- */
function replyCard(){
  const h = data.household, ev = data.event;
  if(phase() === 'after') return h.reply ? `<section class="iv-card plain iv-done-card"><p class="iv-k">Your reply</p><p class="iv-sum">${esc(sumLine(h.reply))}</p></section>` : '';
  if(!data.open){
    return `<section class="iv-card plain"><p class="iv-k">Your reply</p>${h.reply ? `<p class="iv-sum">${esc(sumLine(h.reply))}</p>` : ''}<p class="sub">Replies have closed${ev.rsvpBy ? ` (the date was ${esc(E.fmtShort(ev.rsvpBy))})` : ''}. ${ev.hostPhone ? 'Message the host to change anything.' : 'Ask the host to change anything.'}</p>${hostBtn('I’d like to change my reply')}</section>`;
  }
  if(!editing && h.reply){
    return `<section class="iv-card plain iv-saved" aria-live="polite"><div class="iv-saved-h"><span class="iv-tick">${icon('check')}</span><div><p class="iv-k">Your reply is saved</p><p class="iv-sum">${esc(sumLine(h.reply, false))}</p>${mealLine(h.reply) ? `<p class="iv-meals">${esc(mealLine(h.reply))}</p>` : ''}</div></div>
      ${h.reply.note ? `<q class="iv-q">${esc(h.reply.note)}</q>` : ''}
      ${h.review ? `<p class="hint">${icon('schedule')}<span>${esc(ev.host)} will confirm this change.</span></p>` : ''}
      <button class="btn ghost" type="button" data-a="edit">${icon('edit')}Change reply</button></section>`;
  }
  const f = form, food = data.food || [], max = h.max, going = f.rsvp && f.rsvp !== 'no';
  const used = Object.values(f.meals).reduce((a, n) => a + n, 0);
  return `<section class="iv-card plain iv-reply" id="iv-reply">
    <div class="iv-row-h"><p class="iv-k">Your reply</p>${ev.rsvpBy ? `<span class="iv-by">Please reply by ${esc(E.fmtShort(ev.rsvpBy))}</span>` : ''}</div>
    <h2 class="iv-h">Will you join us?</h2>
    <div class="iv-rsvp" role="radiogroup" aria-label="Your reply">${['going', 'maybe', 'no'].map(k => `<button type="button" role="radio" data-a="rsvp" data-v="${k}" aria-checked="${f.rsvp === k}">${icon(k === 'going' ? 'celebration' : k === 'maybe' ? 'help' : 'event_busy')}<span>${RS[k]}</span></button>`).join('')}</div>
    ${going && max > 1 ? `<div class="iv-field"><span>How many of your ${max} are coming?</span><div class="stepper iv-step"><button type="button" data-a="coming" data-d="-1" aria-label="One fewer" ${f.coming > 1 ? '' : 'disabled'}>${icon('remove')}</button><b aria-live="polite">${plural(f.coming, 'person', 'people')}</b><button type="button" data-a="coming" data-d="1" aria-label="One more" ${f.coming < max ? '' : 'disabled'}>${icon('add')}</button></div></div>` : ''}
    ${going && food.length ? `<div class="iv-field"><span>Food <em>optional</em></span><div class="iv-food">${food.map(k => { const n = f.meals[k] || 0; return `<div class="iv-meal"><b>${esc(k)}</b><div class="stepper sm"><button type="button" data-a="meal" data-k="${esc(k)}" data-d="-1" aria-label="One fewer ${esc(k)}" ${n > 0 ? '' : 'disabled'}>${icon('remove')}</button><b>${n}</b><button type="button" data-a="meal" data-k="${esc(k)}" data-d="1" aria-label="One more ${esc(k)}" ${used < f.coming ? '' : 'disabled'}>${icon('add')}</button></div></div>`; }).join('')}</div><small class="iv-hint">${used ? `${used} of ${plural(f.coming, 'person', 'people')}` : 'Tell us how many of each, so the food is right.'}</small></div>` : ''}
    ${f.rsvp ? `<label class="iv-field"><span>A note for ${esc(first(ev.host))} <em>optional</em></span><textarea class="input" id="iv-note" rows="2" maxlength="200" placeholder="${f.rsvp === 'no' ? 'We’ll miss you!' : 'Arriving late, a question…'}">${esc(f.note)}</textarea></label>` : ''}
    <p class="iv-err" id="iv-err" role="alert" hidden></p>
    <button class="btn iv-send" type="button" data-a="send" ${f.rsvp ? '' : 'disabled'}>${f.rsvp ? `${icon('send')}Send reply${f.rsvp !== 'no' && max > 1 ? ` · ${plural(f.coming, 'person', 'people')}` : ''}` : 'Choose a reply'}</button>
    ${h.reply ? `<button class="btn text" type="button" data-a="cancel-edit">Keep my earlier reply</button>` : ''}
  </section>`;
}
const mealLine = r => r && r.rsvp !== 'no' ? Object.entries(r.meals || {}).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ') : '';
const sumLine = (r, meals = true) => !r ? '' : r.rsvp === 'no' ? 'Can’t make it' : [RS[r.rsvp], plural(r.coming || 1, 'person', 'people'), meals ? mealLine(r) : ''].filter(Boolean).join(' · ');

/* ---------- contribution ---------- */
function moneyCard(){
  const m = data.money, h = data.household, ev = data.event;
  if(!m || (m.share <= 0 && m.paid <= 0 && !m.claims.length)) return '';
  const left = Math.max(0, m.due - m.awaiting), full = m.share > 0 && m.due <= 0;
  const p1 = m.share ? Math.min(1, m.paid / m.share) : 1, p2 = m.share ? Math.min(1 - p1, m.awaiting / m.share) : 0;
  const breakdown = m.waived ? 'Share waived' : m.custom ? 'Your share' : `${plural(m.people, 'person', 'people')} × ${inr(m.per)}`;
  const declined = h.status === 'no' && !m.waived && m.due > 0;
  const upi = m.upi, link = upi && left > 0 ? E.upiLink(upi.id, upi.name || ev.host, left, `${ev.name} contri`.slice(0, 50)) : '';
  return `<section class="iv-card plain iv-money" id="iv-money">
    <p class="iv-k">Your contri</p>
    ${!m.paid && !m.awaiting && !m.waived ? `<div class="iv-share"><b>${inr(m.share)}</b><span>${esc(m.custom ? 'Your share' : `${plural(m.people, 'person', 'people')} × ${inr(m.per)}`)}</span></div>` : `<div class="iv-ledger">
      <div><span>${esc(breakdown)}</span><b>${m.waived ? '—' : inr(m.share)}</b></div>
      ${m.paid ? `<div><span>Received by ${esc(first(ev.host))}</span><b class="good">${inr(m.paid)}</b></div>` : ''}
      ${m.awaiting ? `<div><span>Waiting for ${esc(first(ev.host))} to check</span><b class="warn">${inr(m.awaiting)}</b></div>` : ''}
    </div>`}
    ${m.share && (m.paid || m.awaiting) ? `<div class="iv-bar" role="img" aria-label="${inr(m.paid)} received of ${inr(m.share)}"><i style="width:${(p1 * 100).toFixed(1)}%"></i><i class="aw" style="width:${(p2 * 100).toFixed(1)}%"></i></div>` : ''}
    ${full ? `<p class="iv-paid">${icon('check_circle')}<span>Paid in full. Thank you!</span></p>`
      : declined ? `<p class="hint">${icon('info')}<span>You’ve said you can’t make it. ${esc(first(ev.host))} will let you know about your contri.</span></p>`
      : left > 0 ? `${m.paid || m.awaiting ? `<div class="iv-left"><span>Left to pay</span><b>${inr(left)}</b></div>` : ''}
        ${upi ? `${mobile ? `<a class="btn gold iv-pay" href="${esc(link)}">${icon('payments')}Pay ${inr(left)} in a UPI app</a>` : ''}
          <p class="iv-to">To <b>${esc(upi.name || ev.host)}</b> · <span class="num">${esc(upi.id)}</span></p>
          <div class="iv-chips"><button class="chip" type="button" data-a="copy-upi">${icon('content_copy')}UPI ID</button><button class="chip" type="button" data-a="copy-amt">${icon('content_copy')}Amount</button><button class="chip" type="button" data-a="qr" aria-expanded="${ui.qr}">${icon('qr_code_2')}${ui.qr ? 'Hide QR' : 'QR code'}</button></div>
          <div class="iv-qr" ${ui.qr ? '' : 'hidden'}><div class="qr">${E.qrSvg(link)}</div><small>Scan with any UPI app${mobile ? ' on another phone' : ''}</small></div>
          <p class="iv-hint">${mobile ? 'If the button doesn’t open your app, copy the UPI ID and amount instead. ' : ''}After paying, come back here and tell ${esc(first(ev.host))}.</p>`
        : `<p class="iv-hint">${esc(first(ev.host))} will share how to pay.</p>`}`
      : `<p class="iv-hint">Nothing more to pay once ${esc(first(ev.host))} checks your payment.</p>`}
    ${!full && !declined && m.due > 0 ? (ui.claim ? claimForm(left || m.due) : `<button class="btn ghost" type="button" data-a="claim-open">${icon('task_alt')}I’ve paid</button>`) : ''}
    ${m.claims.length ? `<div class="iv-claims">${m.claims.map(c => `<div class="iv-claim ${c.status}"><div><b>${inr(c.amount)}</b><small>${esc([c.date ? E.fmtShort(c.date) : '', c.ref ? (/^\d{9,}$/.test(c.ref) ? `UTR …${c.ref.slice(-4)}` : c.ref) : ''].filter(Boolean).join(' · '))}</small></div><span class="tag ${c.status === 'confirmed' ? 'good' : c.status === 'declined' ? 'bad' : 'warn'}">${c.status === 'confirmed' ? 'Confirmed' : c.status === 'declined' ? 'Not found yet' : 'Waiting to be checked'}</span>${c.status === 'pending' ? `<button class="btn text sm" type="button" data-a="unclaim" data-id="${esc(c.id)}">Remove</button>` : ''}</div>${c.status === 'declined' ? `<p class="iv-hint">${esc(first(ev.host))} couldn’t find this payment. ${ev.hostPhone ? 'Message them with the details.' : 'Check with them.'}</p>` : ''}`).join('')}</div>` : ''}
  </section>`;
}
const claimForm = amt => `<div class="iv-claim-f"><p class="iv-h3">Tell ${esc(first(data.event.host))} you’ve paid</p>
  <div class="iv-grid"><label class="iv-field"><span>Amount</span><div class="money-in"><input class="input" id="cl-amt" type="number" inputmode="numeric" min="1" value="${amt || ''}"></div></label><label class="iv-field"><span>Date</span><input class="input" id="cl-date" type="date" value="${esc(data.today)}" max="${esc(data.today)}"></label></div>
  <label class="iv-field"><span>UPI reference <em>optional</em></span><input class="input" id="cl-ref" maxlength="40" autocomplete="off" placeholder="The 12-digit UTR number, or a note"></label>
  <p class="iv-err" id="cl-err" role="alert" hidden></p>
  <div class="iv-row-b"><button class="btn text" type="button" data-a="claim-close">Cancel</button><button class="btn" type="button" data-a="claim-send">${icon('send')}Send</button></div></div>`;

/* ---------- the rest ---------- */
function noteCard(){
  const n = data.event.note; if(!n) return '';
  return `<section class="iv-card plain iv-note"><p class="iv-k">Good to know</p>${n.split(/\n{2,}|\n/).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('')}</section>`;
}
function photosCard(){
  const ev = data.event; if(!ev.gallery || phase() === 'before') return '';
  return `<section class="iv-card plain foil iv-photos"><span class="iv-seal">${icon('photo_library')}</span><div><p class="iv-k">Photo wall</p><h2 class="iv-h">${phase() === 'after' ? 'Add your photos from the night' : 'Share your photos tonight'}</h2><p class="sub">Everyone’s photos in one place, to see and download.</p></div><a class="btn gold" href="/g/?e=${encodeURIComponent(ev.gallery)}">${icon('add_photo_alternate')}Open the photo wall</a></section>`;
}
const hostBtn = text => { const ev = data.event; return ev.hostPhone ? `<a class="btn ghost" href="${esc(E.waLink(`Hi ${first(ev.host)}, about ${ev.name}: ${text || ''}`.trim(), ev.hostPhone))}" target="_blank" rel="noopener noreferrer">${icon('chat')}Message ${esc(first(ev.host))}</a>` : ''; };
function foot(full = true){
  const ev = data && data.event;
  return `<footer class="iv-foot">${full && ev ? `<p class="iv-priv">${icon('lock', false, 'xs')}<span>Only ${esc(ev.host)} sees your reply${data.money ? ' and contri' : ''}. It’s used just to plan this celebration. To change or remove it, ${ev.hostPhone ? 'message them' : 'ask them'}.</span></p>${ev.hostPhone ? hostBtn() : ''}` : ''}
    <p class="iv-mark"><svg aria-hidden="true"><use href="/assets/brand.svg#mark"/></svg><span>A celebration by Ekāya Events</span></p></footer>`;
}

function render(){
  const ev = data.event, ph = phase();
  document.title = `${ev.name} · Your invitation`;
  const focus = document.activeElement && document.activeElement.id, val = focus && document.activeElement.value;
  $('#iv').innerHTML = `${data.preview ? `<p class="iv-preview">${icon('visibility', false, 'xs')}<span>Preview of what a guest sees. Replies are off.</span></p>` : ''}${logo()}
    ${inviteCard()}${ph === 'after' ? photosCard() : ''}${replyCard()}${moneyCard()}${noteCard()}${ph !== 'after' ? photosCard() : ''}${foot()}`;
  if(focus){ const n = document.getElementById(focus); if(n){ if(val !== undefined && 'value' in n) n.value = val; n.focus({preventScroll:true}); } }
  drawArt();
}

/* artwork drawn at the size the card really is, like the app's cards */
let artAt = null;
function drawArt(force){
  const face = $('.iv-face[data-art]'); if(!face || data.event.cover) return;
  const w = Math.round(face.clientWidth), h = Math.round(face.clientHeight);
  if(!w || !h) return;
  if(!force && artAt && Math.abs(artAt[0] - w) < 24 && Math.abs(artAt[1] - h) < 24 && face.firstChild){ return; }
  artAt = [w, h]; const a = E.art(data.event, [w, h]); face.innerHTML = a.svg; face.dataset.tone = a.tone;
}
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => data && drawArt(), 200); });

/* ---------- calendar ---------- */
const pad = n => String(n).padStart(2, '0');
function span(ev){
  if(!ev.time) return null;
  const [y, mo, d] = ev.date.split('-').map(Number), [hh, mm] = ev.time.split(':').map(Number);
  const start = Date.UTC(y, mo - 1, d, hh, mm) - 5.5 * 3600e3;   // the event's time is India time
  const z = t => { const x = new Date(t); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00Z`; };
  return [z(start), z(start + 4 * 3600e3)];
}
const dayStr = (s, add = 0) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + add); return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`; };
const details = ev => [ev.dress ? `Dress code: ${ev.dress}` : '', ev.map ? `Directions: ${ev.map}` : '', `From ${ev.host}`].filter(Boolean).join('\n');
function gcal(ev){
  const s = span(ev), dates = s ? `${s[0]}/${s[1]}` : `${dayStr(ev.date)}/${dayStr(ev.date, 1)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.name)}&dates=${dates}&details=${encodeURIComponent(details(ev))}&location=${encodeURIComponent(ev.venue || '')}`;
}
function ics(ev){
  const s = span(ev), e = t => String(t).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ekaya Events//Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${ev.id}@ekaya-events`, `DTSTAMP:${now}`, ...(s ? [`DTSTART:${s[0]}`, `DTEND:${s[1]}`] : [`DTSTART;VALUE=DATE:${dayStr(ev.date)}`, `DTEND;VALUE=DATE:${dayStr(ev.date, 1)}`]),
    `SUMMARY:${e(ev.name)}`, ev.venue ? `LOCATION:${e(ev.venue)}` : '', `DESCRIPTION:${e(details(ev))}`, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
function addToCalendar(){
  const ev = data.event, text = ics(ev);
  if(iOS){ location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'text/calendar;charset=utf-8'})); a.download = `${E.slug(ev.name)}.ics`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- actions ---------- */
const showErr = (id, msg) => { const el = $('#' + id); if(el){ el.textContent = msg; el.hidden = !msg; } };
const previewOff = () => { if(data.preview){ toast('This is a preview. Guests send replies from their own link.', 'visibility'); return true; } return false; };
async function send(){
  if(sending || !form.rsvp || previewOff()) return;
  const btn = $('[data-a="send"]'); sending = true; if(btn) btn.disabled = true; showErr('iv-err', '');
  const note = $('#iv-note') ? $('#iv-note').value.trim() : form.note;
  try{
    data = await api('reply', {rsvp:form.rsvp, coming:form.rsvp === 'no' ? 0 : form.coming, meals:form.rsvp === 'no' ? {} : form.meals, note});
    const wasGoing = form.rsvp === 'going';
    startForm(); editing = false; render();
    const card = $('.iv-saved'); if(card){ card.scrollIntoView({block:'center', behavior:reduce.matches ? 'auto' : 'smooth'}); if(wasGoing) E.celebrate($('.iv-tick') || card, true); }
    toast('Your reply is saved', 'check_circle');
  }catch(e){ showErr('iv-err', e.message); if(btn) btn.disabled = false; }
  finally{ sending = false; }
}
async function claim(){
  if(sending || previewOff()) return;
  const amount = Math.round(+($('#cl-amt')?.value || 0)), date = $('#cl-date')?.value || data.today, ref = ($('#cl-ref')?.value || '').trim();
  if(!(amount > 0)){ showErr('cl-err', 'Enter the amount you paid.'); return; }
  sending = true; const btn = $('[data-a="claim-send"]'); if(btn) btn.disabled = true;
  try{ data = await api('claim', {amount, date, ref}); ui.claim = false; render(); toast(`Thanks! ${first(data.event.host)} will check and confirm.`, 'task_alt'); }
  catch(e){ showErr('cl-err', e.message); if(btn) btn.disabled = false; }
  finally{ sending = false; }
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if(!t || !data) return;
  const a = t.dataset.a, f = form;
  switch(a){
    case 'rsvp': f.rsvp = t.dataset.v; if(f.rsvp !== 'no' && !f.coming) f.coming = data.household.max; render(); break;
    case 'coming': { f.note = $('#iv-note')?.value ?? f.note; f.coming = Math.max(1, Math.min(data.household.max, f.coming + (+t.dataset.d)));
      // food counts can't add up to more people than are coming
      let over = Object.values(f.meals).reduce((x, n) => x + n, 0) - f.coming; for(const k of Object.keys(f.meals).reverse()){ if(over <= 0) break; const cut = Math.min(over, f.meals[k]); f.meals[k] -= cut; over -= cut; }
      render(); break; }
    case 'meal': { f.note = $('#iv-note')?.value ?? f.note; const k = t.dataset.k, used = Object.values(f.meals).reduce((x, n) => x + n, 0), d = +t.dataset.d;
      if(d > 0 && used >= f.coming) break; f.meals[k] = Math.max(0, (f.meals[k] || 0) + d); render(); break; }
    case 'send': send(); break;
    case 'edit': editing = true; render(); $('#iv-reply')?.scrollIntoView({block:'start', behavior:reduce.matches ? 'auto' : 'smooth'}); break;
    case 'cancel-edit': startForm(); editing = false; render(); break;
    case 'cal': ui.cal = !ui.cal; render(); break;
    case 'ics': addToCalendar(); break;
    case 'copy-upi': copy(data.money.upi.id, 'UPI ID'); break;
    case 'copy-amt': copy(Math.max(0, data.money.due - data.money.awaiting), 'Amount'); break;
    case 'qr': ui.qr = !ui.qr; render(); break;
    case 'claim-open': if(previewOff()) break; ui.claim = true; render(); $('#cl-amt')?.focus(); break;
    case 'claim-close': ui.claim = false; render(); break;
    case 'claim-send': claim(); break;
    case 'unclaim': if(previewOff() || sending) break; sending = true; try{ data = await api('unclaim', {id:t.dataset.id}); render(); toast('Removed', 'delete'); }catch(err){ toast(err.message, 'error'); } finally{ sending = false; } break;
  }
});
document.addEventListener('input', e => { if(e.target.id === 'iv-note' && form) form.note = e.target.value; });
// a reply sent from another phone in the family shows up when this one comes back to the page
document.addEventListener('visibilitychange', async () => {
  if(document.visibilityState !== 'visible' || !data || data.preview || editing || sending) return;
  try{ data = await api('me'); startForm(); render(); }catch(e){}
});
addEventListener('hashchange', () => location.reload());

$('#iv').innerHTML = skeleton();
load();
})();
