/* Ekaya run sheet: the minute-by-minute plan for the day, with a Now / Next view for the night itself. */
(() => {
'use strict';
const {$, $$, esc, icon, uid, S, Store} = E;
const STARTERS = {
  diwali: [
    ['16:00', 'Décor team arrives: lights, rangoli, diyas', 'Decorator'],
    ['18:00', 'Food and drinks set up', 'Caterer'],
    ['18:45', 'Music and mic check', 'DJ'],
    ['19:00', 'Guests arrive · welcome drinks', 'Host'],
    ['19:45', 'Lakshmi puja and diya lighting', ''],
    ['20:15', 'Group photos · photo wall QR on the tables', 'Photographer'],
    ['20:30', 'Dinner opens', 'Caterer'],
    ['21:30', 'Cards and games', ''],
    ['22:15', 'Fireworks in the safe zone, water buckets ready', ''],
    ['23:30', 'Wrap up · settle vendor balances', 'Host']
  ],
  party: [
    ['17:00', 'Venue set-up and décor', 'Decorator'],
    ['18:30', 'Food and bar ready', 'Caterer'],
    ['19:00', 'Guests arrive', 'Host'],
    ['20:00', 'Toast and cake', ''],
    ['20:30', 'Dinner opens', 'Caterer'],
    ['21:30', 'Dance floor opens', 'DJ'],
    ['23:30', 'Wrap up · settle vendor balances', 'Host']
  ]
};
/* times after midnight belong to the same night */
const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if(!m) return 1e5; const v = +m[1] * 60 + +m[2]; return v < 300 ? v + 1440 : v; };
const nowMins = () => { const d = new Date(), v = d.getHours() * 60 + d.getMinutes(); return v < 300 ? v + 1440 : v; };
const sorted = () => [...S.run].sort((a, b) => mins(a.time) - mins(b.time) || (a.createdAt || 0) - (b.createdAt || 0));
const fmt = t => t ? E.fmtTime(t) : 'Any time';
let preview = false;

function nowNext(){
  const list = sorted().filter(x => !x.done), n = nowMins();
  const now = list.filter(x => mins(x.time) <= n).pop() || null;
  const next = list.find(x => mins(x.time) > n) || null;
  return {now, next};
}
function nowCard(ev, compact){
  if(!S.run.length) return '';
  const {now, next} = nowNext(), clock = new Date().toLocaleTimeString('en-IN', {hour:'numeric', minute:'2-digit'});
  const who = x => [x.who, x.phone].filter(Boolean).map(esc).join(' · ');
  const nowHtml = now ? `<div class="rn-now${now.delayed ? ' late' : ''}"><div class="grow"><span class="rn-t">${fmt(now.time)}${now.delayed ? ' · running late' : ''}</span><b>${esc(now.title)}</b>${who(now) ? `<small>${who(now)}</small>` : ''}</div>
      ${S.canWrite ? `<div class="rn-act"><button class="btn sm" data-act="run-done" data-id="${esc(now.id)}">${icon('check')}Done</button><button class="btn ghost sm" data-act="run-late" data-id="${esc(now.id)}">${icon('schedule')}${now.delayed ? 'On time' : 'Late'}</button>${now.phone ? `<a class="icon-btn" href="tel:${esc(now.phone)}" aria-label="Call ${esc(now.who || 'them')}">${icon('call')}</a>` : ''}</div>` : ''}</div>`
    : `<div class="rn-now idle"><b>${next ? 'Nothing running right now' : 'All done for the night'}</b>${next ? `<small>Next up at ${fmt(next.time)}</small>` : ''}</div>`;
  return `<section class="card plain run-now">
    <div class="card-h"><span class="eyebrow gold">${icon('schedule', false, 'sm')}Now · ${clock}</span>${compact ? `<button class="btn text sm" data-act="sub" data-tab="plan" data-sub="run">Run sheet${icon('chevron_right')}</button>` : (E.daysUntil(ev.date) === 0 ? '' : `<button class="btn text sm" data-act="run-preview">Hide preview</button>`)}</div>
    ${nowHtml}
    ${next ? `<div class="rn-next"><span>Next</span><b>${fmt(next.time)}</b><span class="grow">${esc(next.title)}</span>${next.who ? `<small>${esc(next.who)}</small>` : ''}</div>` : ''}
  </section>`;
}
function block(ev){
  const items = sorted(), today = E.daysUntil(ev.date) === 0, w = S.canWrite;
  const add = w ? `<form class="add-task run-add plain" id="addRun" autocomplete="off"><input class="input" type="time" id="runTime" aria-label="Time" required><input class="input" id="runText" placeholder="What happens" maxlength="120" aria-label="What happens"><input class="input" id="runWho" placeholder="Who" maxlength="40" aria-label="Who is responsible"><button class="add-btn" type="submit" aria-label="Add to run sheet">${icon('add')}</button></form>` : '';
  if(!items.length) return `<section class="empty plain"><span class="empty-ic">${icon('schedule')}</span><h3>Plan the day, hour by hour</h3><p>Who does what, and when: décor, food, puja, dinner, fireworks. On the day it turns into a Now / Next view that works without signal.</p>${w ? `<div class="chips"><button class="btn" data-act="run-starter">${icon('wand_stars')}Use the ${ev.type === 'diwali' ? 'Diwali' : 'party'} starter</button></div>` : ''}</section>${add}`;
  const {now} = nowNext();
  return `${today || preview ? nowCard(ev) : ''}
    ${add}
    <section class="list-card plain run-list">${items.map(x => `<div class="run-row${x.done ? ' done' : ''}${now && now.id === x.id && (today || preview) ? ' now' : ''}">
      <button class="run-main" data-act="run-edit" data-id="${esc(x.id)}"><span class="run-t">${x.time ? E.fmtTime(x.time) : '—'}</span><span class="row-main"><b>${esc(x.title)}</b><span class="row-sub">${esc([x.who, x.phone, x.note].filter(Boolean).join(' · ')) || 'Tap to add who and a phone number'}${x.delayed && !x.done ? ' <span class="tag warn">Running late</span>' : ''}</span></span></button>
      <button class="cb${x.done ? ' on' : ''}" data-act="run-done" data-id="${esc(x.id)}" aria-pressed="${!!x.done}" aria-label="${x.done ? 'Mark as not done' : 'Mark as done'}: ${esc(x.title)}" ${w ? '' : 'disabled'}><i>${icon('check')}</i></button></div>`).join('')}</section>
    <div class="chips"><button class="btn ghost sm" data-act="run-share">${icon('chat')}Share on WhatsApp</button>${!today ? `<button class="btn ghost sm" data-act="run-preview">${icon('visibility')}${preview ? 'Hide' : 'Preview'} the Now / Next view</button>` : ''}</div>`;
}
function shareText(ev){
  const mark = ev.type === 'diwali' ? '🪔' : '✨';
  return [`${mark} ${ev.name} · run sheet`, ev.date ? E.fmtLong(ev.date) : '', '', ...sorted().map(x => `${x.time ? E.fmtTime(x.time) : '—'}  ${x.title}${x.who ? ` (${x.who}${x.phone ? `, ${x.phone}` : ''})` : ''}`)].filter((l, i) => l !== '' || i === 2).join('\n');
}
function sheet(x){
  const w = S.canWrite;
  E.openSheet({id:'run', title:'Run sheet item', body:`
    <div class="grid2"><label class="field"><span>Time</span><input class="input" type="time" id="rs-time" value="${esc(x.time || '')}" ${w ? '' : 'disabled'}></label><label class="field"><span>Who</span><input class="input" id="rs-who" maxlength="40" value="${esc(x.who || '')}" placeholder="Caterer, DJ, Ekta…" ${w ? '' : 'disabled'}></label></div>
    <label class="field"><span>What happens</span><input class="input" id="rs-title" maxlength="120" value="${esc(x.title || '')}" ${w ? '' : 'disabled'}></label>
    <div class="grid2"><label class="field"><span>Phone</span><input class="input" type="tel" inputmode="tel" id="rs-phone" maxlength="16" value="${esc(x.phone || '')}" placeholder="Optional" ${w ? '' : 'disabled'}></label><label class="field"><span>Note</span><input class="input" id="rs-note" maxlength="120" value="${esc(x.note || '')}" placeholder="Optional" ${w ? '' : 'disabled'}></label></div>
    ${w ? `<div class="toggle"><div><b>Running late</b><div class="hint-s">Flags it on the Now / Next view.</div></div><button class="switch" type="button" role="switch" id="rs-late" aria-checked="${!!x.delayed}" aria-label="Running late"></button></div>
    <div class="sheet-foot"><button class="btn danger-text" type="button" id="rs-del">${icon('delete')}Delete</button><span class="grow"></span><button class="btn" type="button" id="rs-save">Save</button></div>` : ''}`,
  mount: b => {
    if(!w) return;
    let late = !!x.delayed;
    $('#rs-late', b).addEventListener('click', e => { late = !late; e.currentTarget.setAttribute('aria-checked', late); });
    $('#rs-save', b).addEventListener('click', async () => {
      const title = E.val(b, '#rs-title'); if(!title){ E.toast('Say what happens at this time.', 'info'); return; }
      if(await E.save(Store.update(E.evPath('run', x.id), {time:E.val(b, '#rs-time'), title, who:E.val(b, '#rs-who'), phone:E.val(b, '#rs-phone'), note:E.val(b, '#rs-note'), delayed:late}))){ E.closeSheet(); E.toast('Run sheet updated', 'schedule'); }
    });
    $('#rs-del', b).addEventListener('click', async () => { if(await E.save(Store.remove(E.evPath('run', x.id)))){ E.closeSheet(); E.toast('Removed from the run sheet', 'delete'); } });
  }});
}
async function starter(ev){
  const list = STARTERS[ev.type] || STARTERS.party, now = Date.now();
  let n = 0;
  for(const [time, title, who] of list){ if(await E.save(Store.set(E.evPath('run', 'k' + uid()), {time, title, who, phone:'', note:'', done:false, delayed:false, createdAt:now + n}))) n++; else break; }
  if(n) E.toast('Starter run sheet added. Tap any line to change it.', 'schedule');
}
function act(a, t, ev){
  const id = t.dataset.id, x = S.run.find(y => y.id === id);
  if(a === 'run-starter' && ev && S.canWrite) starter(ev);
  else if(a === 'run-edit' && x) sheet(x);
  else if(a === 'run-done' && x && S.canWrite){ E.save(Store.update(E.evPath('run', id), {done:!x.done, doneAt:x.done ? 0 : Date.now(), delayed:false})); E.vibrate(8); }
  else if(a === 'run-late' && x && S.canWrite) E.save(Store.update(E.evPath('run', id), {delayed:!x.delayed}));
  else if(a === 'run-share' && ev) E.messageSheet('Run sheet', shareText(ev));
  else if(a === 'run-preview'){ preview = !preview; E.render(); }
}
document.addEventListener('submit', async e => {
  if(e.target.id !== 'addRun') return; e.preventDefault();
  const tm = $('#runTime'), tx = $('#runText'), wh = $('#runWho'), title = tx.value.trim();
  if(!title || !S.cur){ tx.focus(); return; }
  const data = {time:tm.value, title, who:wh.value.trim(), phone:'', note:'', done:false, delayed:false, createdAt:Date.now()};
  tx.value = ''; wh.value = '';
  if(!(await E.save(Store.set(E.evPath('run', 'k' + uid()), data)))) tx.value = title; else tx.focus();
});
/* keep the Now / Next view current on the night */
setInterval(() => { if(S.cur && S.run.length && document.visibilityState === 'visible' && ((S.tab === 'plan' && S.sub.plan === 'run') || S.tab === 'overview') && !document.querySelector('#view input:focus')) E.render(); }, 60000);
E.run = {block, nowCard, nowNext, act, reset(){ preview = false; }};
})();
