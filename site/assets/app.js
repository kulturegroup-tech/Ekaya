/* Ekaya app: navigation, views and sheets. */
(() => {
'use strict';
const {$, $$, esc, icon, uid, inr, num, okHex, S, Store} = E;
const {toast, save, openSheet, closeSheet, val} = E;

/* ---------- render ---------- */
let lastKey = '';
const TABS = [['overview','space_dashboard','Overview'],['guests','groups','Guests'],['plan','architecture','Plan'],['budget','account_balance_wallet','Budget'],['photos','photo_library','Photos']];
const PLAN_SUB = [['venue','map','Venue'],['mood','auto_awesome_mosaic','Mood board'],['tasks','checklist','Checklist']];
const BUDGET_SUB = [['collect','payments','Collections'],['expenses','receipt_long','Expenses'],['settle','balance','Settle up']];

E.render = function render(){
  const ev = E.curEv();
  if(S.cur && S.evLoaded && !ev && S.cur !== S.justCreated){ goHome(); return; }
  document.body.classList.toggle('in-event', !!S.cur);
  renderTop(ev); renderDock(); renderSide(ev);
  let html;
  if(!S.cur) html = homeView();
  else if(!ev) html = `<div class="invite glass skel"></div>`;
  else html = ({overview:overviewView, guests:guestsView, plan:planView, budget:budgetView, photos:E.photos.view}[S.tab] || overviewView)(ev);
  const key = (S.cur || 'home') + ':' + S.tab + ':' + (S.sub[S.tab] || '');
  swapView(html, key !== lastKey);
  lastKey = key;
  afterRender(ev);
};
function swapView(html, enter){
  const v = $('#view'), a = document.activeElement;
  const host = $('#vz-host');
  let keep = null;
  if(a && a.id && v.contains(a) && !a.closest('.vz')) keep = {id:a.id, val:a.value, s:a.selectionStart, e:a.selectionEnd};
  v.innerHTML = `<div class="wrap${enter ? ' enter' : ''}">${html}</div>`;
  if(keep){ const n = document.getElementById(keep.id); if(n){ if(keep.val !== undefined && 'value' in n) n.value = keep.val; n.focus({preventScroll:true}); try{ if(keep.s != null) n.setSelectionRange(keep.s, keep.e); }catch(e){} } }
}
function afterRender(ev){
  const host = $('#vz-host');
  if(host && ev) E.venue.attach(host, ev.id, S.venue.find(v => v.id === 'main'));
  if(S.cur && S.tab === 'photos' && ev) E.photos.after(ev);
}
function syncChip(){
  if(Store.mode === 'loading') return `<span class="tag">Opening…</span>`;
  if(Store.mode === 'local') return `<span class="tag" title="Saved in this browser">${icon('mobile')}This device</span>`;
  if(!S.canWrite) return `<span class="tag">View only</span>`;
  return `<span class="tag good" title="Changes sync for everyone with edit access">${icon('cloud_done')}Live</span>`;
}
const themeIcon = () => ({auto:'contrast', light:'light_mode', dark:'dark_mode'})[E.getTheme()];
function renderTop(ev){
  const t = $('#topbar');
  if(!S.cur){ t.innerHTML = `<div class="brand"><span class="wordmark">ekaya</span><span class="brand-tag">Events</span></div><div class="grow"></div>${syncChip()}<button class="icon-btn" data-act="theme" aria-label="Change theme">${icon(themeIcon())}</button>`; return; }
  const n = ev ? E.daysUntil(ev.date) : null;
  t.innerHTML = `<button class="icon-btn" data-act="home" aria-label="All events">${icon('arrow_back')}</button>
    <div class="top-title"><b>${esc(ev ? ev.name : '')}</b>${ev && ev.date ? `<small>${n === 0 ? 'TODAY' : n > 0 ? `${n} ${n === 1 ? 'DAY' : 'DAYS'} TO GO` : E.fmtShort(ev.date).toUpperCase()}</small>` : ''}</div>
    ${S.canWrite && ev ? `<button class="icon-btn" data-act="edit-event" aria-label="Edit event">${icon('edit')}</button>` : ''}`;
}
function renderDock(){
  const d = $('#dock'); d.hidden = !S.cur; if(!S.cur) return;
  d.innerHTML = TABS.map(([k, ic, l]) => `<button class="dock-item" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, S.tab === k)}</span><span>${l}</span></button>`).join('');
}
function renderSide(ev){
  const s = $('#sidebar');
  if(!S.cur || !ev){ s.innerHTML = ''; return; }
  const n = E.daysUntil(ev.date), t = E.TYPES[ev.type] || E.TYPES.party;
  s.innerHTML = `<div class="brand"><span class="wordmark">ekaya</span><span class="brand-tag">Events</span></div>
    <button class="btn text sm" data-act="home" style="align-self:flex-start;margin-left:-12px">${icon('arrow_back')}All events</button>
    <div class="side-event"><span class="eyebrow gold">${icon(t.icon, false, 'sm')} ${esc(t.label)}</span><b>${esc(ev.name)}</b><span class="muted small">${ev.date ? `${E.fmtMed(ev.date)}${n != null && n >= 0 ? ` · ${n === 0 ? 'today' : `${n} ${n === 1 ? 'day' : 'days'} to go`}` : ''}` : 'Date not set'}</span></div>
    <nav class="side-nav" aria-label="Event sections">${TABS.map(([k, ic, l]) => `<button class="side-item" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${icon(ic, S.tab === k)}${l}</button>`).join('')}</nav>
    <div class="side-foot">${syncChip()}<span class="grow"></span>${S.canWrite ? `<button class="icon-btn" data-act="edit-event" aria-label="Edit event">${icon('edit')}</button>` : ''}<button class="icon-btn" data-act="theme" aria-label="Change theme">${icon(themeIcon())}</button></div>`;
}
const segBar = (tab, items) => `<div class="seg" role="tablist">${items.map(([k, ic, l]) => `<button role="tab" data-act="sub" data-tab="${tab}" data-sub="${k}" aria-selected="${S.sub[tab] === k}">${icon(ic)}${l}</button>`).join('')}</div>`;
const strip = e => { const p = e.theme?.palette || []; return p.length ? `<div class="strip" aria-hidden="true">${p.map(c => `<i style="--c:${okHex(c.hex)}"></i>`).join('')}</div>` : ''; };

/* ---------- home ---------- */
const byDate = (a, b) => { if(!a.date && !b.date) return (a.createdAt||0) - (b.createdAt||0); if(!a.date) return 1; if(!b.date) return -1; return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; };
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
function homeView(){
  const dateLine = new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'});
  const head = sub => `<section class="hello"><p class="eyebrow gold">${dateLine}</p><h1 class="display">${greeting()},<br><em>Ekta</em></h1><p class="sub">${sub}</p></section>`;
  if(Store.mode === 'loading') return head('Opening your events…') + `<div class="ev-list"><div class="invite glass skel"></div><div class="invite glass skel"></div></div>`;
  const evs = [...S.events].sort(byDate);
  const up = evs.filter(e => !e.date || E.daysUntil(e.date) >= 0), past = evs.filter(e => e.date && E.daysUntil(e.date) < 0).reverse();
  const next = up.find(e => e.date);
  const sub = up.length ? `${up.length} ${up.length === 1 ? 'celebration' : 'celebrations'} in the works${next ? ` · ${esc(next.name)} ${(n => n === 0 ? 'is today' : n === 1 ? 'is tomorrow' : `in ${n} days`)(E.daysUntil(next.date))}` : ''}.` : 'Nothing on the calendar yet.';
  return head(sub) + (up.length ? `<div class="ev-list">${up.map(invite).join('')}${S.canWrite ? newTile() : ''}</div>` : homeEmpty())
    + (past.length ? `<div class="section-label"><span class="eyebrow">Past events</span></div><div class="ev-list">${past.map(invite).join('')}</div>` : '');
}
function invite(e){
  const t = E.TYPES[e.type] || E.TYPES.party, n = E.daysUntil(e.date);
  const meta = [E.fmtTime(e.time), e.venue].filter(Boolean).map(esc).join(' · ');
  return `<button class="invite glass foil" data-act="open-event" data-id="${esc(e.id)}">
    <div class="invite-top"><span class="type-chip">${icon(t.icon)}${t.label}</span>${n == null ? '' : n === 0 ? `<div class="count"><b style="font-size:40px;font-style:italic">Today</b></div>` : n > 0 ? `<div class="count"><b>${n}</b><span>${n === 1 ? 'day to go' : 'days to go'}</span></div>` : ''}</div>
    <h3>${esc(e.name)}</h3>
    <div class="when">${e.date ? `<b>${E.fmtLong(e.date).replace(/, \d{4}$/, '')}</b>` : `<b>Date to be set</b>`}${meta ? `<span class="muted small">${meta}</span>` : ''}</div>
    ${strip(e)}</button>`;
}
const newTile = () => `<button class="invite glass" data-act="new-event" style="align-items:center;justify-content:center;text-align:center;border-style:dashed;border-color:var(--gold-line)"><span class="empty-ic">${icon('add')}</span><h3 style="font-size:32px">Plan a new event</h3><span class="muted small">Weddings, birthdays, Diwali, corporate…</span></button>`;
function homeEmpty(){
  if(!S.canWrite) return `<section class="empty glass"><span class="empty-ic">${icon('celebration')}</span><h3>No events yet</h3><p>Events appear here once they’re added.</p></section>`;
  return `<section class="empty glass foil"><span class="empty-ic">${icon('celebration')}</span><h3>Plan your first event</h3><p>Pick a type to start with a checklist, budget categories and a theme palette.</p>
    <div class="chips">${Object.entries(E.TYPES).map(([k, t]) => `<button class="chip" data-act="new-event" data-type="${k}">${icon(t.icon)}${t.label}</button>`).join('')}</div></section>`;
}

/* ---------- overview ---------- */
function overviewView(ev){
  const t = E.TYPES[ev.type] || E.TYPES.party, n = E.daysUntil(ev.date), st = E.stats(ev, S.people, S.expenses);
  let cd = '';
  if(n === 0) cd = `<b class="word">Today</b><span>It’s the day</span>`;
  else if(n === 1) cd = `<b>1</b><span>day to go</span>`;
  else if(n > 1) cd = `<b>${n}</b><span>days to go</span>`;
  else if(n < 0) cd = `<b class="word">Done</b><span>${-n} ${n === -1 ? 'day' : 'days'} ago</span>`;
  const meta = [
    `<li>${icon('calendar_month')}${ev.date ? `<span>${E.fmtLong(ev.date)}${ev.time ? ' · ' + E.fmtTime(ev.time) : ''}</span>` : `<span class="add">Add a date</span>`}</li>`,
    `<li>${icon('location_on')}${ev.venue ? `<span>${esc(ev.venue)}</span>` : `<span class="add">Add a venue</span>`}</li>`,
    ev.theme?.dress ? `<li>${icon('styler')}<span>${esc(ev.theme.dress)}</span></li>` : ''
  ].join('');
  const plan = S.venue.find(v => v.id === 'main');
  const seats = E.venue.seatCount(plan);
  const open = S.tasks.filter(x => !x.done).sort(taskSort), doneN = S.tasks.length - open.length;
  const imgs = S.mood.filter(m => m.kind === 'image').sort((a, b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 4);
  const pal = ev.theme?.palette || [];
  const hasContri = st.contri && st.sharers.length > 0, p = hasContri ? (st.target ? st.collected / st.target : 0) : (st.budget ? st.spent / st.budget : 0);
  const totalG = st.rows.length, rsvpP = totalG ? st.rsvp.going / totalG : 0;
  return `<section class="hero glass foil">
      <div class="card-h"><span class="type-chip">${icon(t.icon)}${t.label}</span>${S.canWrite ? `<button class="btn text sm" data-act="edit-event">${icon('edit')}Edit</button>` : ''}</div>
      <div class="hero-body"><div><h1 class="ev-title">${esc(ev.name)}</h1><ul class="meta">${meta}</ul></div>${cd ? `<div class="countdown">${cd}</div>` : ''}</div>
      ${strip(ev)}
    </section>
    <div class="tiles">
      <button class="card glass card-btn" data-act="tab" data-tab="guests">
        <div class="card-h"><span class="eyebrow">${icon('groups')}Guests</span>${icon('chevron_right')}</div>
        <div class="tile-big"><div class="ring-wrap">${E.ring(rsvpP, 72, 6, rsvpP >= 1 ? 'good' : '')}<b>${st.rsvp.going}</b></div><div><div class="big-amt">${st.headcount} coming</div><div class="muted small">${totalG ? `${totalG} invited · ${st.rsvp.maybe} maybe · ${st.rsvp.invited} not replied` : 'No guests added yet'}</div></div></div>
        ${st.contri && st.sharers.length ? `<div class="kv"><div><span>Contri paid in full</span><b>${st.paidCount} of ${st.sharers.length}</b></div></div>` : ''}
      </button>
      <button class="card glass card-btn" data-act="sub" data-tab="plan" data-sub="venue">
        <div class="card-h"><span class="eyebrow">${icon('map')}Venue layout</span>${icon('chevron_right')}</div>
        ${plan && plan.items && plan.items.length ? `<div class="mini-plan">${E.venue.staticSvg(plan, {pad:0.5, wall:1.5})}</div><div class="muted small">${esc(plan.name || 'Venue')} · ${plan.items.length} items · ${seats} seats</div>`
          : `<div class="mini-plan" style="display:grid;place-items:center;color:var(--ink-3)"><span class="small">${icon('architecture')} Map the venue: tables, bar, stage, lights</span></div>`}
      </button>
      <button class="card glass card-btn" data-act="tab" data-tab="budget">
        <div class="card-h"><span class="eyebrow">${icon('account_balance_wallet')}${hasContri ? 'Contri' : 'Budget'}</span>${icon('chevron_right')}</div>
        <div class="tile-big"><div class="ring-wrap">${E.ring(p, 72, 6, p >= 1 && hasContri ? 'good' : '')}<b>${Math.round(Math.min(p, 9.99) * 100)}%</b></div><div><div class="big-amt">${inr(hasContri ? st.collected : st.spent)}</div><div class="muted small">${hasContri ? (st.target ? `collected of ${inr(st.target)}` : 'collected so far') : (st.budget ? `spent of ${inr(st.budget)}` : 'spent so far')}</div></div></div>
        <div class="kv"><div><span>Spent</span><b>${inr(st.spent)}</b></div>${hasContri ? `<div><span>Still due</span><b>${inr(st.pending)}</b></div>` : ''}</div>
      </button>
      <button class="card glass card-btn" data-act="sub" data-tab="plan" data-sub="mood">
        <div class="card-h"><span class="eyebrow">${icon('palette')}Theme & mood</span>${icon('chevron_right')}</div>
        <div class="h2" style="font-style:italic;font-weight:500;font-size:32px">${esc(ev.theme?.name || 'Pick a theme')}</div>
        ${pal.length ? `<div class="swatches">${pal.slice(0, 6).map(c => `<div class="swatch"><i style="--c:${okHex(c.hex)}"></i><span>${esc(c.name || '')}</span></div>`).join('')}</div>` : ''}
        ${imgs.length ? `<div class="thumbs">${imgs.map(m => `<img src="${esc(E.imgSrc(m))}" alt="${esc(m.caption || 'Mood board photo')}" loading="lazy">`).join('')}</div>` : ''}
      </button>
      <button class="card glass card-btn" data-act="sub" data-tab="plan" data-sub="tasks">
        <div class="card-h"><span class="eyebrow">${icon('checklist')}Checklist</span>${icon('chevron_right')}</div>
        <div class="tile-big"><div class="ring-wrap">${E.ring(S.tasks.length ? doneN / S.tasks.length : 0, 72, 6, S.tasks.length && !open.length ? 'good' : '')}<b>${doneN}/${S.tasks.length}</b></div><div><div class="big-amt">${open.length ? `${open.length} to do` : S.tasks.length ? 'All done' : 'No tasks'}</div><div class="muted small">${doneN} done</div></div></div>
        ${open.length ? `<div class="kv">${open.slice(0, 3).map(x => `<div><span style="color:var(--ink)">${esc(x.text)}</span>${x.due ? `<b class="small">${E.fmtShort(x.due)}</b>` : ''}</div>`).join('')}</div>` : ''}
      </button>
      <button class="card glass card-btn" data-act="tab" data-tab="photos">
        <div class="card-h"><span class="eyebrow">${icon('photo_library')}Photo wall</span>${icon('chevron_right')}</div>
        ${E.photos.tile(ev)}
      </button>
    </div>`;
}

/* ---------- guests ---------- */
const RSVP = {going:['Coming','good'], maybe:['Maybe','warn'], no:['Not coming','bad'], invited:['Not replied','']};
const DIETS = ['Veg', 'Jain', 'Non-veg', 'Vegan'];
const GROUPS = ['Family', 'Friends', 'Work', 'Neighbours'];
function payTag(r){
  if(r.status === 'paid') return `<span class="tag good">${icon('check', false)}Paid</span>`;
  if(r.status === 'part') return `<span class="tag warn">${inr(r.due)} due</span>`;
  if(r.status === 'pending') return `<span class="tag bad">${inr(r.due)} due</span>`;
  return '';
}
function guestsView(ev){
  const st = E.stats(ev, S.people, S.expenses), total = st.rows.length;
  const tables = new Map(E.venue.tables().map(t => [t.id, t.label]));
  const q = S.query.trim().toLowerCase(), f = S.filter;
  const match = r => (!q || (r.name + ' ' + (r.group || '') + ' ' + (r.phone || '')).toLowerCase().includes(q)) &&
    (f === 'all' || (f === 'due' ? r.due > 0 : f === 'paid' ? r.status === 'paid' : r.rsvp === f));
  const list = st.rows.filter(match);
  const filters = [['all','All',total],['going','Coming',st.rsvp.going],['maybe','Maybe',st.rsvp.maybe],['invited','Not replied',st.rsvp.invited],['no','Not coming',st.rsvp.no]].concat(st.contri ? [['due','Payment due',st.pendingCount],['paid','Paid',st.paidCount]] : []);
  const pct = k => total ? st.rsvp[k] / total * 100 : 0;
  const head = `<section class="vhead"><p class="eyebrow gold">Guests</p><div class="vhead-row"><h1 class="h1">Who’s <em>coming</em></h1>
      <div class="chips">${S.canWrite ? `<button class="btn" data-act="add-guests">${icon('person_add')}Add guests</button>` : ''}<button class="btn ghost" data-act="invite-msg">${icon('chat')}Invite</button></div></div></section>
    <div class="stat-row"><div><span>Invited</span><b>${total}</b><small>${st.rows.reduce((a, r) => a + r.plusOnes, 0)} plus-ones</small></div><div><span>Headcount</span><b class="good">${st.headcount}</b><small>coming incl. plus-ones</small></div><div><span>Maybe</span><b class="gold">${st.rsvp.maybe}</b><small>${st.rsvp.invited} not replied</small></div>
      ${st.contri ? `<div><span>Contri</span><b class="${st.pending ? 'bad' : 'good'}">${st.paidCount}/${st.sharers.length}</b><small>${st.pending ? `${inr(st.pending)} still due` : 'all paid'}</small></div>` : `<div><span>Not coming</span><b>${st.rsvp.no}</b><small>declined</small></div>`}</div>
    ${total ? `<div class="glass card" style="gap:10px;padding:16px 18px"><div class="rsvp-bar">${['going','maybe','invited','no'].map(k => pct(k) ? `<i class="bg-${k}" style="width:${pct(k)}%"></i>` : '').join('')}</div><div class="rsvp-legend">${['going','maybe','invited','no'].map(k => `<span><i class="bg-${k}"></i>${RSVP[k][0]} ${st.rsvp[k]}</span>`).join('')}</div></div>` : ''}`;
  if(!total) return head + `<section class="empty glass"><span class="empty-ic">${icon('groups')}</span><h3>Start the guest list</h3><p>Add names in one go, track who’s coming and${st.contri ? ' who has paid their contri' : ' their food preferences'}.</p>${S.canWrite ? `<div class="chips"><button class="btn" data-act="add-guests">${icon('person_add')}Add guests</button>${'contacts' in navigator && 'ContactsManager' in window ? `<button class="btn ghost" data-act="pick-contacts">${icon('contacts')}From contacts</button>` : ''}</div>` : ''}</section>`;
  return head + `<div class="guest-tools"><label class="search">${icon('search')}<input class="input" id="g-search" type="search" placeholder="Search guests" value="${esc(S.query)}" aria-label="Search guests"></label>
      <div class="chips scroll">${filters.map(([k, l, c]) => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${f === k}">${l} <small>${c}</small></button>`).join('')}</div></div>
    <section class="list-card glass">${list.length ? list.map(r => {
      const bits = [r.group, r.plusOnes ? `+${r.plusOnes}` : '', r.diet, r.tableId && tables.get(r.tableId) ? `Table ${tables.get(r.tableId)}` : ''].filter(Boolean);
      return `<button class="row" data-act="guest" data-id="${esc(r.id)}"><span class="av ${E.avc(r.name)}">${esc(E.initials(r.name))}</span>
        <span class="row-main"><b>${esc(r.name)}</b><span class="row-sub">${bits.length ? bits.map(esc).join(' · ') : (st.contri && r.expected ? `${inr(r.contributed)} of ${inr(r.expected)}` : 'Tap to add details')}</span></span>
        <span class="row-end"><span class="tag ${RSVP[r.rsvp][1]}">${RSVP[r.rsvp][0]}</span>${st.contri ? payTag(r) : ''}</span></button>`;
    }).join('') : `<div class="row" style="cursor:default"><span class="row-main"><span class="row-sub">No guests match.</span></span></div>`}</section>`;
}
function addGuestsSheet(ev){
  const per = +ev.perHead, contri = E.contriOn(ev);
  let rsvp = 'going', group = '';
  openSheet({title:'Add guests', body:`
    <label class="field"><span>Names</span><textarea class="input" id="ag-names" rows="4" placeholder="Rohan Mehta, Simran, Kabir & family…" data-autofocus></textarea><small class="hint-s">Commas or new lines between names. Paste straight from a WhatsApp list.</small></label>
    <div class="field"><span>Group</span><div class="chips" id="ag-group">${GROUPS.map(g => `<button class="chip" type="button" data-g="${g}" aria-pressed="false">${g}</button>`).join('')}</div></div>
    <div class="field"><span>RSVP</span><div class="seg" id="ag-rsvp">${['going','maybe','invited'].map(k => `<button type="button" data-r="${k}" aria-selected="${k === rsvp}">${RSVP[k][0]}</button>`).join('')}</div></div>
    ${contri && !per ? `<label class="field"><span>Contri per head</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="ag-per" placeholder="e.g. 2000"></div><small class="hint-s">Optional. Everyone’s default share.</small></label>` : contri ? `<p class="hint">${icon('payments')}<span>Each person’s share: ${inr(per)}.</span></p>` : ''}
    <div class="sheet-foot">${'contacts' in navigator && 'ContactsManager' in window ? `<button class="btn ghost" type="button" id="ag-contacts">${icon('contacts')}From contacts</button><span class="grow"></span>` : ''}<button class="btn" type="button" id="ag-save">${icon('person_add')}Add</button></div>`,
  mount: b => {
    $('#ag-group', b).addEventListener('click', e => { const c = e.target.closest('[data-g]'); if(!c) return; group = group === c.dataset.g ? '' : c.dataset.g; $$('#ag-group .chip', b).forEach(x => x.setAttribute('aria-pressed', x.dataset.g === group)); });
    $('#ag-rsvp', b).addEventListener('click', e => { const c = e.target.closest('[data-r]'); if(!c) return; rsvp = c.dataset.r; $$('#ag-rsvp button', b).forEach(x => x.setAttribute('aria-selected', x.dataset.r === rsvp)); });
    $('#ag-contacts', b)?.addEventListener('click', () => pickContacts(ev, rsvp, group));
    $('#ag-save', b).addEventListener('click', async () => {
      const existing = new Set(S.people.map(p => p.name.trim().toLowerCase()));
      const names = [...new Set($('#ag-names', b).value.split(/[,\n]/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean))].filter(n => !existing.has(n.toLowerCase()));
      if(!names.length){ toast('Type at least one new name.', 'info'); return; }
      $('#ag-save', b).disabled = true;
      const perIn = $('#ag-per', b) ? num($('#ag-per', b).value) : 0;
      if(perIn) await save(Store.update(`events/${ev.id}`, {perHead:perIn}));
      await addPeople(names.map(n => ({name:n})), rsvp, group);
    });
  }});
}
async function addPeople(list, rsvp, group){
  let n = 0; const now = Date.now();
  for(const g of list){ if(await save(Store.set(E.evPath('people', 'p' + uid()), {name:g.name.slice(0, 60), phone:g.phone || '', expected:null, payments:[], rsvp, plusOnes:0, group:group || '', diet:'', tableId:'', note:'', createdAt:now + n}))) n++; else break; }
  closeSheet(); if(n) toast(`Added ${n} ${n === 1 ? 'guest' : 'guests'}`, 'person_add');
}
async function pickContacts(ev, rsvp='going', group=''){
  try{
    const res = await navigator.contacts.select(['name', 'tel'], {multiple:true});
    const existing = new Set(S.people.map(p => p.name.trim().toLowerCase()));
    const list = res.map(c => ({name:(c.name && c.name[0] || '').trim(), phone:(c.tel && c.tel[0] || '').trim()})).filter(c => c.name && !existing.has(c.name.toLowerCase()));
    if(list.length) await addPeople(list, rsvp, group);
  }catch(e){ if(e && e.name !== 'AbortError') toast('Couldn’t open contacts on this device.', 'info'); }
}
function guestSheet(pid){
  const ev = E.curEv(); if(!ev) return;
  const find = () => E.stats(E.curEv(), S.people, S.expenses).rows.find(x => x.id === pid);
  const raw = () => S.people.find(x => x.id === pid);
  let r = find(); if(!r) return;
  const contri = E.contriOn(ev), tables = E.venue.tables(), path = E.evPath('people', pid), w = S.canWrite;
  let mode = 'UPI';
  const sum = r => `<div style="display:flex;align-items:center;gap:14px"><span class="av lg ${E.avc(r.name)}">${esc(E.initials(r.name))}</span><div style="min-width:0;flex:1"><div class="h2" style="font-size:28px">${esc(r.name)}</div><div class="row-sub" style="margin-top:4px"><span class="tag ${RSVP[r.rsvp][1]}">${RSVP[r.rsvp][0]}</span>${contri ? payTag(r) : ''}</div></div></div>`;
  const pays = r => {
    const ps = (r.payments || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if(!ps.length && !r.directList.length) return `<p class="hint-s">No payments recorded yet.</p>`;
    return `<div class="mini-list">${ps.map(p => `<div class="mini-row"><div class="grow"><b>${inr(p.amount)}</b><small>${esc(p.mode || '')} · ${E.fmtShort(p.date)}</small></div>${w ? `<button class="icon-btn" data-del-pay="${esc(p.id)}" aria-label="Remove ${inr(p.amount)} payment">${icon('delete')}</button>` : ''}</div>`).join('')}
      ${r.directList.map(x => `<div class="mini-row"><div class="grow"><b>${inr(x.amount)}</b><small>Paid for ${esc(x.title || 'an expense')}</small></div></div>`).join('')}</div>`;
  };
  const contriPanel = r => !contri ? '' : `<div class="panel" id="gs-contri"><div class="card-h"><span class="eyebrow">Contri</span><span class="muted small num">${inr(r.contributed)}${r.expected ? ` of ${inr(r.expected)}` : ''}</span></div>${r.expected ? E.lin(r.contributed / r.expected, r.status === 'paid' ? 'good' : '') : ''}
    ${w ? `<div class="grid2"><label class="field"><span>Amount</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="pp-amt" value="${r.due || ''}"></div></label><label class="field"><span>Date</span><input class="input" type="date" id="pp-date" value="${E.today()}"></label></div>
      <div class="seg" id="pp-mode">${['UPI','Cash','Card'].map(m => `<button type="button" data-m="${m}" aria-selected="${m === mode}">${m}</button>`).join('')}</div>
      <button class="btn" type="button" id="pp-add">${icon('add')}Record payment</button>` : ''}
    <div id="gs-pays">${pays(r)}</div>
    ${r.due > 0 ? `<div class="chips" id="gs-remind"><a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(E.waLink(reminderText(ev, r), r.phone))}">${icon('chat')}Remind</a>${ev.upi ? `<button class="btn ghost sm" type="button" data-upi="${r.due}">${icon('qr_code_2')}UPI QR · ${inr(r.due)}</button>` : ''}</div>` : ''}</div>`;
  const body = `<div id="gs-sum">${sum(r)}</div>
    <div class="field"><span>RSVP</span><div class="seg" id="gs-rsvp">${['going','maybe','invited','no'].map(k => `<button type="button" data-r="${k}" aria-selected="${r.rsvp === k}" ${w ? '' : 'disabled'}>${RSVP[k][0]}</button>`).join('')}</div></div>
    <div class="grid2"><div class="field"><span>Plus-ones</span><div class="stepper"><button type="button" data-step="-1" aria-label="One fewer" ${w ? '' : 'disabled'}>${icon('remove')}</button><b id="gs-plus">${r.plusOnes}</b><button type="button" data-step="1" aria-label="One more" ${w ? '' : 'disabled'}>${icon('add')}</button></div></div>
      <label class="field"><span>Table</span><select class="input" id="gs-table" ${w ? '' : 'disabled'}><option value="">Not assigned</option>${tables.map(t => `<option value="${esc(t.id)}" ${r.tableId === t.id ? 'selected' : ''}>${esc(t.label)} · ${S.people.filter(p => p.tableId === t.id).length}/${t.seats}</option>`).join('')}</select></label></div>
    <div class="field"><span>Food</span><div class="chips" id="gs-diet">${DIETS.map(d => `<button class="chip" type="button" data-d="${d}" aria-pressed="${r.diet === d}" ${w ? '' : 'disabled'}>${d}</button>`).join('')}</div></div>
    ${contriPanel(r)}
    ${w ? `<div class="panel"><span class="eyebrow">Details</span>
      <label class="field"><span>Name</span><input class="input" id="gd-name" maxlength="60" value="${esc(r.name)}"></label>
      <div class="grid2"><label class="field"><span>Phone</span><input class="input" type="tel" inputmode="tel" id="gd-phone" maxlength="16" value="${esc(r.phone || '')}" placeholder="98xxxxxx10"></label>
      <label class="field"><span>Group</span><input class="input" id="gd-group" maxlength="30" value="${esc(r.group || '')}" placeholder="Family, Friends…" list="gd-groups"><datalist id="gd-groups">${GROUPS.map(g => `<option value="${g}">`).join('')}</datalist></label></div>
      ${contri ? `<label class="field"><span>Their contri share</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="gd-share" value="${(() => { const rp = raw(); return rp && rp.expected !== null && rp.expected !== undefined && rp.expected !== '' ? +rp.expected : ''; })()}" placeholder="${+ev.perHead ? 'Default ' + (+ev.perHead).toLocaleString('en-IN') : 'Not set'}"></div></label>` : ''}
      <label class="field"><span>Note</span><input class="input" id="gd-note" maxlength="120" value="${esc(r.note || '')}" placeholder="Arriving late, needs a ride…"></label>
      <div class="sheet-foot" id="gd-foot"><button class="btn danger-text" type="button" id="gd-del">${icon('delete')}Remove</button><span class="grow"></span><button class="btn" type="button" id="gd-save">Save details</button></div></div>` : ''}`;
  openSheet({title:'Guest', body, mount: b => {
    const upd = patch => save(Store.update(path, patch));
    $('#gs-rsvp', b).addEventListener('click', e => { const c = e.target.closest('[data-r]'); if(!c || !w) return; $$('#gs-rsvp button', b).forEach(x => x.setAttribute('aria-selected', x === c)); upd({rsvp:c.dataset.r}); E.vibrate(6); });
    b.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => { const v = Math.max(0, Math.min(20, (+$('#gs-plus', b).textContent) + (+btn.dataset.step))); $('#gs-plus', b).textContent = v; clearTimeout(b._pt); b._pt = setTimeout(() => upd({plusOnes:v}), 400); }));
    $('#gs-table', b).addEventListener('change', e => upd({tableId:e.target.value}));
    $('#gs-diet', b).addEventListener('click', e => { const c = e.target.closest('[data-d]'); if(!c || !w) return; const cur = c.getAttribute('aria-pressed') === 'true' ? '' : c.dataset.d; $$('#gs-diet .chip', b).forEach(x => x.setAttribute('aria-pressed', x.dataset.d === cur)); upd({diet:cur}); });
    if(w && contri){
      $('#pp-mode', b).addEventListener('click', e => { const c = e.target.closest('[data-m]'); if(!c) return; mode = c.dataset.m; $$('#pp-mode button', b).forEach(x => x.setAttribute('aria-selected', x.dataset.m === mode)); });
      $('#pp-add', b).addEventListener('click', async () => { const amount = num($('#pp-amt', b).value); if(!amount){ toast('Enter the amount received.', 'info'); return; } const p = raw(); if(!p) return; if(await upd({payments:[...(p.payments || []), {id:uid(), amount, mode, date:val(b, '#pp-date') || E.today()}]})){ $('#pp-amt', b).value = ''; toast(`${inr(amount)} from ${p.name} recorded`, 'payments'); } });
    }
    if(w){
      $('#gd-save', b).addEventListener('click', async () => { const name = val(b, '#gd-name'); if(!name){ toast('Name can’t be empty.', 'info'); return; } const patch = {name, phone:val(b, '#gd-phone'), group:val(b, '#gd-group'), note:val(b, '#gd-note')}; if($('#gd-share', b)){ const sh = val(b, '#gd-share'); patch.expected = sh === '' ? null : num(sh); } if(await upd(patch)) toast('Details saved'); });
      $('#gd-del', b).addEventListener('click', () => { const p = raw(); if(!p) return;
        $('#gd-foot', b).outerHTML = `<div class="confirm" id="gd-foot"><p>Remove ${esc(p.name)}${contri ? ' and their recorded payments' : ''}?</p><div class="sheet-foot"><button class="btn ghost" type="button" id="gd-keep">Keep</button><button class="btn danger" type="button" id="gd-yes">Remove</button></div></div>`;
        $('#gd-keep', b).addEventListener('click', () => { closeSheet(); guestSheet(pid); });
        $('#gd-yes', b).addEventListener('click', async () => { if(await save(Store.remove(path))){ closeSheet(); toast(`${p.name} removed`, 'delete'); } }); });
    }
    b.addEventListener('click', async e => {
      const d = e.target.closest('[data-del-pay]'); if(d){ const p = raw(); if(p) await upd({payments:(p.payments || []).filter(x => x.id !== d.dataset.delPay)}); return; }
      const u = e.target.closest('[data-upi]'); if(u){ upiSheet(E.curEv(), +u.dataset.upi, raw()?.name); }
    });
  }, refresh: b => {
    const rr = find(); if(!rr){ closeSheet(); return; }
    $('#gs-sum', b).innerHTML = sum(rr);
    const cp = $('#gs-contri', b); if(cp){ $('#gs-pays', b).innerHTML = pays(rr); const head = cp.querySelector('.card-h .muted'); if(head) head.textContent = `${inr(rr.contributed)}${rr.expected ? ` of ${inr(rr.expected)}` : ''}`; const bar = cp.querySelector('.lin i'); if(bar) bar.style.setProperty('--p', Math.round(Math.min(1, rr.expected ? rr.contributed / rr.expected : 0) * 100)); }
  }});
}
function reminderText(ev, r){ return `Hi ${r.name.split(' ')[0]}! Gentle reminder for the ${ev.name} contri: ${inr(r.due)} pending${r.contributed ? ` (${inr(r.contributed)} received, thank you)` : ''}.${ev.upi ? `\nUPI: ${ev.upi}` : ''}\nThank you!`; }
function inviteText(ev){
  const n = E.daysUntil(ev.date);
  return [`You’re invited to ${ev.name}${ev.type === 'diwali' ? ' 🪔' : ' ✨'}`, '', ev.date ? `${E.fmtLong(ev.date)}${ev.time ? `, ${E.fmtTime(ev.time)}` : ''}` : '', ev.venue ? `At ${ev.venue}` : '', ev.theme?.dress ? `Dress code: ${ev.theme.dress}` : '', '',
    E.contriOn(ev) && +ev.perHead ? `Contri: ${inr(ev.perHead)} per head${ev.upi ? ` to ${ev.upi}` : ''}` : '', 'Reply with Coming, Maybe or Can’t make it.'].filter((l, i, a) => l !== '' || (a[i - 1] && a[i - 1] !== '')).join('\n').trim();
}
function upiSheet(ev, amount, who){
  const link = E.upiLink(ev.upi, ev.name, amount, `${ev.name} contri`.slice(0, 50));
  openSheet({title:'Pay by UPI', body:`<div class="qr-card" style="aspect-ratio:auto"><span class="qe">Scan with any UPI app</span><h3>${amount ? inr(amount) : 'Any amount'}</h3><div class="qr">${E.qrSvg(link)}</div><p>${esc(who ? `${who} · ` : '')}${esc(ev.upi)}</p></div>
    <div class="sheet-foot" style="justify-content:center"><a class="btn" href="${esc(link)}">${icon('open_in_new')}Open UPI app</a><button class="btn ghost" type="button" id="upi-copy">${icon('content_copy')}Copy UPI ID</button></div>`,
  mount: b => $('#upi-copy', b).addEventListener('click', () => E.copyText(ev.upi)) });
}

/* ---------- budget ---------- */
function budgetView(ev){
  const st = E.stats(ev, S.people, S.expenses), hasContri = st.contri && st.sharers.length > 0;
  if(!st.contri && S.sub.budget === 'collect') S.sub.budget = 'expenses';
  const p = hasContri ? (st.target ? st.collected / st.target : 0) : (st.budget ? st.spent / st.budget : 0);
  const head = `<section class="vhead"><p class="eyebrow gold">Budget</p><div class="vhead-row"><h1 class="h1">Money, <em>sorted</em></h1>
      <div class="chips">${S.canWrite ? `<button class="btn" data-act="add-expense">${icon('add')}Expense</button><button class="btn ghost" data-act="edit-money">${icon('tune')}${st.contri ? (+ev.perHead ? `${inr(ev.perHead)} / head` : 'Contri settings') : 'Budget'}</button>` : ''}</div></div></section>
    <section class="money-hero glass foil">
      <span class="eyebrow">${hasContri ? 'Contri collected' : 'Spent so far'}</span>
      <div class="money-big"><b>${inr(hasContri ? st.collected : st.spent)}</b><span>${hasContri ? (st.target ? `of ${inr(st.target)} target` : 'set a per-head amount to see the target') : (st.budget ? `of ${inr(st.budget)} budget` : 'no budget set yet')}</span></div>
      ${E.lin(p, p >= 1 && hasContri ? 'good' : (!hasContri && p > 1 ? 'bad' : ''))}
      <div class="stat-row" style="grid-template-columns:repeat(3,minmax(0,1fr))">${hasContri
        ? `<div><span>Spent</span><b>${inr(st.spent)}</b><small>${st.budget ? `of ${inr(st.budget)}` : `${S.expenses.length} expenses`}</small></div><div><span>In the pot</span><b class="${st.inHand < 0 ? 'bad' : ''}">${inr(st.inHand)}</b><small>${st.inHand < 0 ? 'overspent' : 'cash in hand'}</small></div><div><span>Still due</span><b class="${st.pending > 0 ? 'bad' : 'good'}">${inr(st.pending)}</b><small>${st.pendingCount ? `${st.pendingCount} ${st.pendingCount === 1 ? 'person' : 'people'}` : 'all settled'}</small></div>`
        : `<div><span>Budget</span><b>${st.budget ? inr(st.budget) : '—'}</b><small>planned</small></div><div><span>Left</span><b class="${st.budget && st.budget - st.spent < 0 ? 'bad' : ''}">${st.budget ? inr(st.budget - st.spent) : '—'}</b><small>to spend</small></div><div><span>Expenses</span><b>${S.expenses.length}</b><small>logged</small></div>`}</div>
      ${hasContri ? `<div class="chips"><button class="btn tonal sm" data-act="group-msg">${icon('chat')}Group update</button>${ev.upi ? `<button class="btn tonal sm" data-act="upi-qr">${icon('qr_code_2')}UPI QR</button>` : ''}</div>` : ''}
    </section>`;
  const subs = st.contri ? BUDGET_SUB : BUDGET_SUB.filter(s => s[0] !== 'collect');
  const body = S.sub.budget === 'settle' ? settleBlock(ev, st) : S.sub.budget === 'collect' ? collectBlock(ev, st) : expensesBlock(ev, st);
  return head + segBar('budget', subs) + body;
}
function collectBlock(ev, st){
  if(!st.sharers.length) return `<section class="empty glass"><span class="empty-ic">${icon('payments')}</span><h3>No one is chipping in yet</h3><p>${+ev.perHead ? 'Add guests and each one gets the per-head share.' : 'Set a per-head amount, then everyone on the guest list gets a share to pay.'}</p>${S.canWrite ? `<div class="chips"><button class="btn" data-act="tab" data-tab="guests">${icon('groups')}Go to guests</button><button class="btn ghost" data-act="edit-money">${icon('tune')}Contri settings</button></div>` : ''}</section>`;
  const rows = [...st.sharers].sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  return `<section class="list-card glass"><div class="lc-head"><div><b>${st.paidCount} of ${st.sharers.length} paid in full</b><br><span>Tap someone to record a payment</span></div></div>
    ${rows.map(r => `<button class="row" data-act="guest" data-id="${esc(r.id)}"><span class="av ${E.avc(r.name)}">${esc(E.initials(r.name))}</span><span class="row-main"><b>${esc(r.name)}</b><span class="row-sub">${inr(r.contributed)}${r.expected ? ` of ${inr(r.expected)}` : ''}${r.direct ? ` · ${inr(r.direct)} paid directly` : ''}</span>${r.expected ? E.lin(r.contributed / r.expected, 'thin' + (r.status === 'paid' ? ' good' : '')) : ''}</span><span class="row-end">${payTag(r) || `<span class="tag">No share</span>`}</span></button>`).join('')}</section>`;
}
const catName = (ev, id) => (ev.categories || []).find(c => c.id === id)?.name || 'Other';
const payerName = id => { const p = S.people.find(x => x.id === id); return p ? `Paid by ${p.name}` : 'From the pot'; };
function expensesBlock(ev, st){
  const cats = ev.categories || [], by = {};
  S.expenses.forEach(x => { const k = cats.some(c => c.id === x.category) ? x.category : '_other'; by[k] = (by[k] || 0) + (+x.amount || 0); });
  const catRows = cats.map(c => ({name:c.name, planned:+c.planned || 0, spent:by[c.id] || 0})).concat(by._other ? [{name:'Other', planned:0, spent:by._other}] : []);
  const planned = cats.reduce((a, c) => a + (+c.planned || 0), 0);
  const catCard = catRows.length ? `<section class="list-card glass"><div class="lc-head"><div><b>By category</b><br><span>${planned ? `${inr(planned)} planned` : 'Add planned amounts to track each one'}</span></div>${S.canWrite ? `<button class="btn text sm" data-act="edit-plan">${icon('edit')}Plan</button>` : ''}</div>
    ${catRows.map(c => { const over = c.planned && c.spent > c.planned; return `<div class="cat"><span class="n">${esc(c.name)}</span><span class="v${over ? ' over' : ''}"><b>${inr(c.spent)}</b>${c.planned ? ` / ${inr(c.planned)}` : ''}</span>${E.lin(c.planned ? c.spent / c.planned : 0, 'thin' + (over ? ' bad' : ''))}</div>`; }).join('')}</section>` : '';
  const xs = [...S.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const list = xs.length ? `<section class="list-card glass"><div class="lc-head"><div><b>${xs.length} ${xs.length === 1 ? 'expense' : 'expenses'}</b><br><span>${inr(st.spent)} spent${st.contri ? ` · ${inr(st.potSpent)} from the pot` : ''}</span></div></div>
    ${xs.map(x => `<button class="row" data-act="expense" data-id="${esc(x.id)}"><span class="row-ic">${icon('receipt_long')}</span><span class="row-main"><b>${esc(x.title || 'Expense')}</b><span class="row-sub">${esc([catName(ev, x.category), st.contri ? payerName(x.paidBy) : '', x.vendor, E.fmtShort(x.date)].filter(Boolean).join(' · '))}</span></span><span class="row-amt">${inr(x.amount)}</span></button>`).join('')}</section>`
    : `<section class="empty glass"><span class="empty-ic">${icon('receipt_long')}</span><h3>No expenses yet</h3><p>Log each bill as you go: decorator, mithai, drinks.${st.contri ? ' If a friend pays for something directly, it counts towards their contri.' : ''}</p>${S.canWrite ? `<button class="btn" data-act="add-expense">${icon('add')}Add expense</button>` : ''}</section>`;
  return catCard + list;
}
function settleBlock(ev, st){
  if(!st.sharers.length) return `<section class="empty glass"><span class="empty-ic">${icon('groups')}</span><h3>Nobody to split with yet</h3><p>Add guests with a contri share first.</p></section>`;
  if(!st.spent) return `<section class="empty glass"><span class="empty-ic">${icon('balance')}</span><h3>Nothing spent yet</h3><p>Once expenses are in, this splits the actual spend equally and shows who gets money back and who still owes.</p></section>`;
  const rows = st.sharers.map(r => ({...r, bal:Math.round(r.contributed - st.fair)}));
  return `<section class="glass settle-eq"><div><b>${inr(st.spent)}</b><span>spent</span></div><span class="op">÷</span><div><b>${rows.length}</b><span>people</span></div><span class="op">=</span><div><b>${inr(st.fair)}</b><span>each</span></div></section>
    <section class="list-card glass"><div class="lc-head"><div><b>Final split</b><br><span>Based on what each person put in</span></div></div>
      ${rows.map(r => `<div class="row" style="cursor:default"><span class="av ${E.avc(r.name)}">${esc(E.initials(r.name))}</span><span class="row-main"><b>${esc(r.name)}</b><span class="row-sub">Put in ${inr(r.contributed)}</span></span>${Math.abs(r.bal) < 1 ? `<span class="tag">Settled</span>` : r.bal > 0 ? `<span class="tag good">Gets back ${inr(r.bal)}</span>` : `<span class="tag bad">Owes ${inr(-r.bal)}</span>`}</div>`).join('')}
      <div class="lc-foot"><span class="muted">In the pot: <b class="num" style="color:var(--ink)">${inr(st.inHand)}</b></span><button class="btn tonal sm" data-act="settle-msg">${icon('ios_share')}Share split</button></div></section>`;
}
function groupText(ev, st){
  const mark = ev.type === 'diwali' ? '🪔' : '✨', pend = st.sharers.filter(r => r.due > 0);
  return [`${mark} ${ev.name} · contri update`, ev.date ? E.fmtLong(ev.date) : '', '', `${+ev.perHead ? `Per head: ${inr(ev.perHead)} · ` : ''}${st.sharers.length} people`, `Collected: ${inr(st.collected)}${st.target ? ` of ${inr(st.target)}` : ''}`,
    pend.length ? `\nStill pending:\n${pend.map(r => `• ${r.name}: ${inr(r.due)}`).join('\n')}` : '\nEveryone has paid. Thank you all!', ev.upi ? `\nPay to UPI: ${ev.upi}` : ''].filter((l, i) => l !== '' || i === 2).join('\n').replace(/\n{3,}/g, '\n\n');
}
function settleText(ev, st){
  const rows = st.sharers.map(r => ({...r, bal:Math.round(r.contributed - st.fair)})), back = rows.filter(r => r.bal >= 1), owe = rows.filter(r => r.bal <= -1);
  return [`${ev.name} · final split`, `Total spent ${inr(st.spent)} ÷ ${rows.length} = ${inr(st.fair)} each`, '', owe.length ? `To pay:\n${owe.map(r => `• ${r.name}: ${inr(-r.bal)}`).join('\n')}` : 'Nobody owes anything.', back.length ? `\nGets back:\n${back.map(r => `• ${r.name}: ${inr(r.bal)}`).join('\n')}` : '', ev.upi && owe.length ? `\nUPI: ${ev.upi}` : ''].filter(Boolean).join('\n');
}
function moneySheet(ev){
  let contri = E.contriOn(ev);
  openSheet({title:'Budget settings', body:`
    <div class="toggle"><div><b>Guests chip in (contri)</b><div class="hint-s">For friends’ parties where everyone shares the cost.</div></div><button class="switch" type="button" role="switch" id="m-contri" aria-checked="${contri}" aria-label="Guests chip in"></button></div>
    <div id="m-cfields" ${contri ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:16px">
      <label class="field"><span>Contri per head</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="m-per" value="${ev.perHead || ''}" placeholder="e.g. 2000"></div></label>
      <label class="field"><span>UPI ID for payments</span><input class="input" id="m-upi" maxlength="80" autocapitalize="off" spellcheck="false" placeholder="name@okaxis" value="${esc(ev.upi || '')}"></label></div>
    <label class="field"><span>Total budget</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="m-budget" value="${ev.budget || ''}" placeholder="Optional"></div></label>
    <div class="sheet-foot"><button class="btn" type="button" id="m-save">Save</button></div>`,
  mount: b => {
    $('#m-contri', b).addEventListener('click', e => { contri = !contri; e.currentTarget.setAttribute('aria-checked', contri); $('#m-cfields', b).hidden = !contri; });
    $('#m-save', b).addEventListener('click', async () => { if(await save(Store.update(`events/${ev.id}`, {contri, perHead:num(val(b, '#m-per')), upi:val(b, '#m-upi'), budget:num(val(b, '#m-budget'))}))){ closeSheet(); toast('Budget settings saved'); } });
  }});
}
function expenseSheet(ev, x){
  const cats = ev.categories || [], contri = E.contriOn(ev);
  let cat = x ? x.category : (cats[0]?.id || '_other');
  const people = [...S.people].sort((a, b) => a.name.localeCompare(b.name));
  openSheet({title: x ? 'Expense' : 'Add expense', body:`
    <label class="field"><span>What was it for?</span><input class="input" id="x-title" maxlength="80" placeholder="Fairy lights, mithai, DJ advance…" value="${esc(x?.title || '')}" ${x ? '' : 'data-autofocus'}></label>
    <div class="grid2"><label class="field"><span>Amount</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="x-amt" value="${x?.amount || ''}"></div></label><label class="field"><span>Date</span><input class="input" type="date" id="x-date" value="${esc(x?.date || E.today())}"></label></div>
    <div class="field"><span>Category</span><div class="chips" id="x-cat">${cats.concat([{id:'_other', name:'Other'}]).map(c => `<button type="button" class="chip" data-c="${esc(c.id)}" aria-pressed="${c.id === cat}">${esc(c.name)}</button>`).join('')}</div></div>
    <div class="grid2">${contri ? `<label class="field"><span>Paid from</span><select class="input" id="x-by"><option value="pot">The contri pot</option>${people.map(p => `<option value="${esc(p.id)}" ${x?.paidBy === p.id ? 'selected' : ''}>${esc(p.name)} (directly)</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Vendor</span><input class="input" id="x-vendor" maxlength="60" placeholder="Optional" value="${esc(x?.vendor || '')}"></label></div>
    <div class="sheet-foot">${x ? `<button class="btn danger-text" type="button" id="x-del">${icon('delete')}Delete</button><span class="grow"></span>` : ''}<button class="btn" type="button" id="x-save">${x ? 'Save' : 'Add expense'}</button></div>`,
  mount: b => {
    $('#x-cat', b).addEventListener('click', e => { const c = e.target.closest('[data-c]'); if(!c) return; cat = c.dataset.c; $$('#x-cat .chip', b).forEach(y => y.setAttribute('aria-pressed', y.dataset.c === cat)); });
    $('#x-save', b).addEventListener('click', async () => {
      const amount = num($('#x-amt', b).value), title = val(b, '#x-title');
      if(!title){ toast('Add what the expense was for.', 'info'); return; } if(!amount){ toast('Enter the amount.', 'info'); return; }
      const data = {title, amount, category:cat, paidBy:$('#x-by', b)?.value || 'pot', vendor:val(b, '#x-vendor'), date:val(b, '#x-date'), createdAt:x?.createdAt || Date.now()};
      if(await save(Store.set(E.evPath('expenses', x ? x.id : 'x' + uid()), data))){ closeSheet(); toast(x ? 'Expense updated' : `${inr(amount)} added`, 'receipt_long'); }
    });
    if(x) $('#x-del', b).addEventListener('click', async () => { if(await save(Store.remove(E.evPath('expenses', x.id)))){ closeSheet(); toast('Expense deleted', 'delete'); } });
  }});
}
function planSheet(ev){
  let cats = (ev.categories || []).map(c => ({...c}));
  const rows = () => cats.map((c, i) => `<div class="pl-row"><input class="input" data-i="${i}" data-k="name" value="${esc(c.name)}" placeholder="Category" aria-label="Category name"><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" data-i="${i}" data-k="planned" value="${c.planned || ''}" placeholder="0" aria-label="Planned amount"></div><button class="icon-btn" type="button" data-rm="${i}" aria-label="Remove category">${icon('delete')}</button></div>`).join('');
  const total = () => `<span class="muted">Total planned</span><b class="num">${inr(cats.reduce((a, c) => a + (+c.planned || 0), 0))}</b>`;
  openSheet({title:'Budget plan', body:`<div id="pl-rows" style="display:flex;flex-direction:column;gap:10px">${rows()}</div><div><button class="btn text sm" type="button" id="pl-add">${icon('add')}Add category</button></div><div class="kv" id="pl-total"><div>${total()}</div></div><div class="sheet-foot"><button class="btn" type="button" id="pl-save">Save plan</button></div>`,
  mount: b => {
    const box = $('#pl-rows', b);
    box.addEventListener('input', e => { const i = e.target.dataset.i; if(i == null) return; const k = e.target.dataset.k; cats[i][k] = k === 'planned' ? num(e.target.value) : e.target.value; $('#pl-total', b).innerHTML = `<div>${total()}</div>`; });
    box.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if(!r) return; cats.splice(+r.dataset.rm, 1); box.innerHTML = rows(); $('#pl-total', b).innerHTML = `<div>${total()}</div>`; });
    $('#pl-add', b).addEventListener('click', () => { cats.push({id:'c' + uid(), name:'', planned:0}); box.innerHTML = rows(); $$('[data-k="name"]', box).pop().focus(); });
    $('#pl-save', b).addEventListener('click', async () => { const clean = cats.filter(c => String(c.name).trim()).map(c => ({id:c.id || E.slug(c.name), name:String(c.name).trim().slice(0, 40), planned:+c.planned || 0})); if(await save(Store.update(`events/${ev.id}`, {categories:clean}))){ closeSheet(); toast('Budget plan saved'); } });
  }});
}

/* ---------- plan: venue, mood, tasks ---------- */
function planView(ev){
  const sub = S.sub.plan;
  const head = `<section class="vhead"><p class="eyebrow gold">Plan</p><div class="vhead-row"><h1 class="h1">${sub === 'venue' ? 'The <em>space</em>' : sub === 'mood' ? 'The <em>look</em>' : 'The <em>to-do</em>'}</h1>${sub === 'mood' && S.canWrite ? `<button class="btn" data-act="add-mood">${icon('add_photo_alternate')}Add</button>` : ''}</div></section>`;
  const body = sub === 'mood' ? moodBlock(ev) : sub === 'tasks' ? tasksBlock(ev) : `<div id="vz-host"></div>`;
  return head + segBar('plan', PLAN_SUB) + body;
}
E.imgSrc = m => m.asset ? '/_blob/' + m.asset : (m.src || '');
function moodBlock(ev){
  const th = ev.theme || {}, palette = th.palette || [], items = [...S.mood].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return `<section class="theme-card glass foil"><div class="card-h"><div><p class="eyebrow">Theme</p><div class="theme-name">${esc(th.name || 'Untitled theme')}</div>${th.dress ? `<p class="dress">${icon('styler')}Dress code · ${esc(th.dress)}</p>` : ''}</div>${S.canWrite ? `<button class="btn text sm" data-act="edit-theme">${icon('edit')}Edit</button>` : ''}</div>
      ${palette.length ? `<div class="swatches">${palette.map(c => `<div class="swatch"><i style="--c:${okHex(c.hex)}"></i><span>${esc(c.name || c.hex)}</span></div>`).join('')}</div>` : `<p class="muted">No palette yet.</p>`}${strip(ev)}</section>
    ${items.length ? `<div class="board" id="board">${items.map(mtile).join('')}</div>` : `<section class="empty glass" id="board"><span class="empty-ic">${icon('auto_awesome_mosaic')}</span><h3>Start the mood board</h3><p>Décor references, outfits, table settings and notes for the decorator. You can also paste or drop images here.</p>${S.canWrite ? `<button class="btn" data-act="add-mood">${icon('add_photo_alternate')}Add to board</button>` : ''}</section>`}`;
}
function mtile(m){
  const id = esc(m.id);
  if(m.kind === 'image') return `<button class="mtile" data-act="mood" data-id="${id}"><img src="${esc(E.imgSrc(m))}" alt="${esc(m.caption || 'Mood board photo')}" loading="lazy">${m.caption ? `<span class="cap">${esc(m.caption)}</span>` : ''}</button>`;
  if(m.kind === 'color') return `<button class="mtile color" data-act="mood" data-id="${id}"><div class="sw" style="--c:${okHex(m.hex)}"></div><div class="meta"><b>${esc(m.label || 'Colour')}</b><span>${esc(okHex(m.hex))}</span></div></button>`;
  return `<button class="mtile note" data-act="mood" data-id="${id}">${icon('format_quote')}<p>${esc(m.text)}</p>${m.tag ? `<span class="tagline">${esc(m.tag)}</span>` : ''}</button>`;
}
const taskSort = (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.createdAt || 0) - (b.createdAt || 0);
function dueChip(t){ if(!t.due) return ''; const n = E.daysUntil(t.due), cls = t.done ? '' : n < 0 ? 'late' : n <= 2 ? 'soon' : ''; return `<span class="due ${cls}">${n === 0 && !t.done ? 'Today' : E.fmtShort(t.due)}</span>`; }
const taskRow = t => `<div class="task${t.done ? ' done' : ''}"><button class="cb${t.done ? ' on' : ''}" data-act="toggle-task" data-id="${esc(t.id)}" aria-pressed="${!!t.done}" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}: ${esc(t.text)}" ${S.canWrite ? '' : 'disabled'}><i>${icon('check')}</i></button><button class="task-text" data-act="task" data-id="${esc(t.id)}"><span>${esc(t.text)}</span>${dueChip(t)}</button></div>`;
function tasksBlock(ev){
  const open = S.tasks.filter(t => !t.done).sort(taskSort), done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), total = S.tasks.length, p = total ? done.length / total : 0;
  return `<section class="glass card" style="flex-direction:row;align-items:center"><div class="ring-wrap">${E.ring(p, 64, 6, total && !open.length ? 'good' : '')}<b>${Math.round(p * 100)}%</b></div><div style="min-width:0"><div class="big-amt" style="font-size:24px">${total ? `${done.length} of ${total} done` : 'No tasks yet'}</div><div class="muted small">${open[0] ? `Next: ${esc(open[0].text)}` : total ? 'Everything is ticked off.' : 'Add the first thing to sort out.'}</div></div></section>
    ${S.canWrite ? `<form class="add-task glass" id="addTask" autocomplete="off"><input class="input" id="taskText" placeholder="Add a task" maxlength="140" aria-label="New task"><input class="input" type="date" id="taskDue" aria-label="Due date"><button class="add-btn" type="submit" aria-label="Add task">${icon('add')}</button></form>` : ''}
    ${open.length ? `<section class="list-card glass">${open.map(taskRow).join('')}</section>` : ''}
    ${done.length ? `<button class="done-toggle" data-act="done-toggle" aria-expanded="${S.doneOpen}">${icon(S.doneOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down')}Done · ${done.length}</button>${S.doneOpen ? `<section class="list-card glass">${done.map(taskRow).join('')}</section>` : ''}` : ''}`;
}

/* ---------- event sheets ---------- */
function eventSheet(ev, presetType){
  const isNew = !ev; let type = ev ? ev.type : (presetType || 'diwali');
  openSheet({title: isNew ? 'New event' : 'Event details', body:`
    <label class="field"><span>Event name</span><input class="input" id="f-name" maxlength="80" value="${esc(ev ? ev.name : E.TYPES[type].name)}" ${isNew ? 'data-autofocus' : ''}></label>
    <div class="field"><span>Type</span><div class="chips" id="f-type">${Object.entries(E.TYPES).map(([k, t]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${k === type}">${icon(t.icon)}${t.label}</button>`).join('')}</div></div>
    <div class="grid2"><label class="field"><span>Date</span><input class="input" type="date" id="f-date" value="${esc(ev?.date || '')}"></label><label class="field"><span>Time</span><input class="input" type="time" id="f-time" value="${esc(ev?.time || '')}"></label></div>
    <label class="field"><span>Venue</span><input class="input" id="f-venue" maxlength="120" placeholder="Home, banquet, farmhouse…" value="${esc(ev?.venue || '')}"></label>
    <div class="grid2"><label class="field"><span>Expected guests</span><input class="input" type="number" inputmode="numeric" min="0" id="f-guests" value="${ev?.guests || ''}"></label><label class="field"><span>Total budget</span><div class="money-in"><input class="input" type="number" inputmode="numeric" min="0" id="f-budget" value="${ev?.budget || ''}" placeholder="Optional"></div></label></div>
    ${isNew ? `<p class="hint">${icon('wand_stars')}<span>Starts with a checklist, budget categories and a theme palette for this type.</span></p>` : ''}
    <div class="sheet-foot" id="f-foot">${ev ? `<button class="btn danger-text" type="button" id="f-del">${icon('delete')}Delete</button><span class="grow"></span>` : ''}<button class="btn" type="button" id="f-save">${isNew ? 'Create event' : 'Save'}</button></div>`,
  mount: b => {
    $('#f-type', b).addEventListener('click', e => { const c = e.target.closest('[data-type]'); if(!c) return; const prev = type; type = c.dataset.type; $$('#f-type .chip', b).forEach(x => x.setAttribute('aria-pressed', x.dataset.type === type)); const nm = $('#f-name', b); if(isNew && (!nm.value.trim() || nm.value === E.TYPES[prev].name)) nm.value = E.TYPES[type].name; });
    $('#f-save', b).addEventListener('click', async () => {
      const name = val(b, '#f-name'); if(!name){ toast('Give the event a name.', 'info'); return; }
      const f = {name, date:val(b, '#f-date'), time:val(b, '#f-time'), venue:val(b, '#f-venue'), guests:num(val(b, '#f-guests')), budget:num(val(b, '#f-budget'))};
      $('#f-save', b).disabled = true;
      if(isNew){ closeSheet(); await createEvent(type, f); }
      else if(await save(Store.update(`events/${ev.id}`, {...f, type}))){ closeSheet(); toast('Event updated'); } else $('#f-save', b).disabled = false;
    });
    if(ev) $('#f-del', b).addEventListener('click', () => {
      $('#f-foot', b).outerHTML = `<div class="confirm" id="f-foot"><p>Delete “${esc(ev.name)}” with its guests, budget, plan and mood board? This can’t be undone.</p><div class="sheet-foot"><button class="btn ghost" type="button" id="f-keep">Keep it</button><button class="btn danger" type="button" id="f-yes">Delete event</button></div></div>`;
      $('#f-keep', b).addEventListener('click', () => { closeSheet(); eventSheet(E.curEv()); });
      $('#f-yes', b).addEventListener('click', () => { closeSheet(); deleteEvent(ev); });
    });
  }});
}
async function createEvent(type, f){
  const id = E.slug(f.name).slice(0, 28) + '-' + uid().slice(-5), now = Date.now();
  S.justCreated = id;
  if(!(await save(Store.set(`events/${id}`, E.eventFromTemplate(type, {...f, createdAt:now}))))){ S.justCreated = null; return; }
  openEvent(id, 'overview'); toast(`${f.name} is ready`, 'celebration');
  for(const t of E.tasksFromTemplate(type, now)) if(!(await save(Store.set(`events/${id}/tasks/${t.id}`, t.data)))) break;
}
async function deleteEvent(ev){
  const id = ev.id, subs = {people:S.people, expenses:S.expenses, mood:S.mood, tasks:S.tasks, venue:S.venue};
  goHome();
  for(const [k, list] of Object.entries(subs)) for(const d of list){ if(k === 'mood' && d.asset && S.assets){ try{ await S.assets.delete(d.asset); }catch(e){} } await save(Store.remove(`events/${id}/${k}/${d.id}`)); }
  if(await save(Store.remove(`events/${id}`))) toast(`${ev.name} deleted`, 'delete');
}
function themeSheet(ev){
  const th = JSON.parse(JSON.stringify(ev.theme || {name:'', dress:'', palette:[]})); th.palette = th.palette || [];
  const rows = () => th.palette.map((c, i) => `<div class="pal-row"><input type="color" value="${okHex(c.hex)}" data-i="${i}" data-k="hex" aria-label="Colour ${i + 1}"><input class="input" data-i="${i}" data-k="name" maxlength="30" value="${esc(c.name || '')}" placeholder="Name" aria-label="Colour name"><span class="hex">${okHex(c.hex)}</span><button class="icon-btn" type="button" data-rm="${i}" aria-label="Remove colour">${icon('delete')}</button></div>`).join('');
  openSheet({title:'Theme', body:`
    <label class="field"><span>Theme name</span><input class="input" id="t-name" maxlength="50" value="${esc(th.name || '')}" placeholder="Marigold Night"></label>
    <label class="field"><span>Dress code</span><input class="input" id="t-dress" maxlength="80" value="${esc(th.dress || '')}" placeholder="Festive Indian"></label>
    <div class="field"><span>Start from a palette</span><div class="chips" id="t-presets">${Object.keys(E.PALETTES).map(n => `<button type="button" class="preset" data-p="${esc(n)}"><span class="dots">${E.PALETTES[n].map(([h]) => `<i style="--c:${h}"></i>`).join('')}</span>${esc(n)}</button>`).join('')}</div></div>
    <div class="field"><span>Palette</span><div id="t-rows" style="display:flex;flex-direction:column;gap:10px">${rows()}</div></div>
    <div><button class="btn text sm" type="button" id="t-add">${icon('add')}Add colour</button></div>
    <div class="sheet-foot"><button class="btn" type="button" id="t-save">Save theme</button></div>`,
  mount: b => {
    const box = $('#t-rows', b);
    box.addEventListener('input', e => { const i = e.target.dataset.i; if(i == null) return; const k = e.target.dataset.k; th.palette[i][k] = k === 'hex' ? e.target.value.toUpperCase() : e.target.value; if(k === 'hex') e.target.parentElement.querySelector('.hex').textContent = e.target.value.toUpperCase(); });
    box.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if(!r) return; th.palette.splice(+r.dataset.rm, 1); box.innerHTML = rows(); });
    $('#t-add', b).addEventListener('click', () => { if(th.palette.length >= 8){ toast('Eight colours is the limit.', 'info'); return; } th.palette.push({hex:'#C9A24B', name:''}); box.innerHTML = rows(); });
    $('#t-presets', b).addEventListener('click', e => { const p = e.target.closest('[data-p]'); if(!p) return; th.palette = E.pal(p.dataset.p); $('#t-name', b).value = p.dataset.p; box.innerHTML = rows(); });
    $('#t-save', b).addEventListener('click', async () => { const theme = {name:val(b, '#t-name'), dress:val(b, '#t-dress'), palette:th.palette.map(c => ({hex:okHex(c.hex).toUpperCase(), name:String(c.name || '').trim()}))}; if(await save(Store.update(`events/${ev.id}`, {theme}))){ closeSheet(); toast('Theme saved', 'palette'); } });
  }});
}
function addMoodSheet(){
  openSheet({title:'Add to the board', body:`<div class="opt-grid">
      <button class="opt" type="button" id="am-photo">${icon('add_photo_alternate')}<b>Photos</b><span>Décor, outfits, venue shots</span></button>
      <button class="opt" type="button" id="am-note">${icon('sticky_note_2')}<b>Note</b><span>An idea or a brief for a vendor</span></button>
      <button class="opt" type="button" id="am-color">${icon('palette')}<b>Colour</b><span>A shade you want in the room</span></button></div>`,
  mount: b => { $('#am-photo', b).addEventListener('click', () => { closeSheet(); $('#filePick').click(); }); $('#am-note', b).addEventListener('click', () => { closeSheet(); noteSheet(); }); $('#am-color', b).addEventListener('click', () => { closeSheet(); colorSheet(); }); }});
}
function noteSheet(m){
  openSheet({title: m ? 'Note' : 'Add a note', body:`<label class="field"><span>Note</span><textarea class="input" id="n-text" maxlength="400" placeholder="Marigold strings over the entrance, brass urlis with floating diyas" ${m ? '' : 'data-autofocus'}>${esc(m?.text || '')}</textarea></label>
    <label class="field"><span>Tag</span><input class="input" id="n-tag" maxlength="24" placeholder="Decor, Food, Outfits…" value="${esc(m?.tag || '')}"></label>
    <div class="sheet-foot">${m ? `<button class="btn danger-text" type="button" id="n-del">${icon('delete')}Delete</button><span class="grow"></span>` : ''}<button class="btn" type="button" id="n-save">${m ? 'Save' : 'Add note'}</button></div>`,
  mount: b => { $('#n-save', b).addEventListener('click', async () => { const text = val(b, '#n-text'); if(!text) return; if(await save(Store.set(E.evPath('mood', m ? m.id : 'm' + uid()), {kind:'note', text, tag:val(b, '#n-tag'), createdAt:m?.createdAt || Date.now()}))){ closeSheet(); toast(m ? 'Note saved' : 'Note added', 'sticky_note_2'); } }); if(m) $('#n-del', b).addEventListener('click', () => deleteMood(m)); }});
}
function colorSheet(m){
  openSheet({title: m ? 'Colour' : 'Add a colour', body:`<div class="mi-color" id="c-prev" style="--c:${okHex(m?.hex || '#D9A441')}"></div>
    <div class="pal-row"><input type="color" id="c-hex" value="${okHex(m?.hex || '#D9A441')}" aria-label="Pick a colour"><input class="input" id="c-name" maxlength="30" placeholder="Haldi, Rani pink…" value="${esc(m?.label || '')}" aria-label="Colour name"></div>
    <div class="sheet-foot">${m ? `<button class="btn danger-text" type="button" id="c-del">${icon('delete')}Delete</button><span class="grow"></span>` : ''}<button class="btn" type="button" id="c-save">${m ? 'Save' : 'Add colour'}</button></div>`,
  mount: b => { $('#c-hex', b).addEventListener('input', e => $('#c-prev', b).style.setProperty('--c', e.target.value)); $('#c-save', b).addEventListener('click', async () => { if(await save(Store.set(E.evPath('mood', m ? m.id : 'm' + uid()), {kind:'color', hex:okHex($('#c-hex', b).value).toUpperCase(), label:val(b, '#c-name'), createdAt:m?.createdAt || Date.now()}))){ closeSheet(); toast(m ? 'Colour saved' : 'Colour added', 'palette'); } }); if(m) $('#c-del', b).addEventListener('click', () => deleteMood(m)); }});
}
function photoSheet(m){
  openSheet({title:'Photo', body:`<img class="mi-img" src="${esc(E.imgSrc(m))}" alt="${esc(m.caption || 'Mood board photo')}">
    ${S.canWrite ? `<label class="field"><span>Caption</span><input class="input" id="ph-cap" maxlength="60" placeholder="Entrance décor, mehendi outfit…" value="${esc(m.caption || '')}"></label><div class="sheet-foot"><button class="btn danger-text" type="button" id="ph-del">${icon('delete')}Delete</button><span class="grow"></span><button class="btn" type="button" id="ph-save">Save</button></div>` : ''}`,
  mount: b => { if(!S.canWrite) return; $('#ph-save', b).addEventListener('click', async () => { if(await save(Store.update(E.evPath('mood', m.id), {caption:val(b, '#ph-cap')}))){ closeSheet(); toast('Caption saved'); } }); $('#ph-del', b).addEventListener('click', () => deleteMood(m)); }});
}
async function deleteMood(m){ if(await save(Store.remove(E.evPath('mood', m.id)))){ if(m.asset && S.assets){ try{ await S.assets.delete(m.asset); }catch(e){} } closeSheet(); toast('Removed from the board', 'delete'); } }
function taskSheet(t){
  if(!S.canWrite) return;
  openSheet({title:'Task', body:`<label class="field"><span>Task</span><textarea class="input" id="tk-text" maxlength="140" style="min-height:76px">${esc(t.text)}</textarea></label><label class="field"><span>Due date</span><input class="input" type="date" id="tk-due" value="${esc(t.due || '')}"></label>
    <div class="sheet-foot"><button class="btn danger-text" type="button" id="tk-del">${icon('delete')}Delete</button><span class="grow"></span><button class="btn" type="button" id="tk-save">Save</button></div>`,
  mount: b => { $('#tk-save', b).addEventListener('click', async () => { const text = val(b, '#tk-text'); if(!text) return; if(await save(Store.update(E.evPath('tasks', t.id), {text, due:val(b, '#tk-due')}))){ closeSheet(); toast('Task saved'); } }); $('#tk-del', b).addEventListener('click', async () => { if(await save(Store.remove(E.evPath('tasks', t.id)))){ closeSheet(); toast('Task deleted', 'delete'); } }); }});
}

/* mood photos */
async function addPhotos(files){
  files = [...files].filter(f => f.type.startsWith('image/'));
  if(!files.length || !S.cur || !S.canWrite) return;
  toast(`Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`, 'upload');
  let ok = 0;
  for(const f of files){
    try{
      const item = {kind:'image', caption:'', createdAt:Date.now()};
      if(S.assets){ let blob = f; if(f.size > 2.5e6 || !/^image\/(png|jpeg|gif|webp)$/.test(f.type)) blob = await E.toBlob(await E.scaled(f, 2000), 0.86); item.asset = (await S.assets.upload(blob, {type:blob.type || 'image/jpeg'})).id; }
      else { const cloud = Store.mode === 'cloud'; let d = (await E.scaled(f, cloud ? 1100 : 820)).toDataURL('image/jpeg', cloud ? 0.74 : 0.66); if(d.length > 230000) d = (await E.scaled(f, 680)).toDataURL('image/jpeg', 0.6); item.src = d; }
      if(await save(Store.set(E.evPath('mood', 'm' + uid()), item))) ok++; else break;
    }catch(e){ console.warn(e); toast('Couldn’t add that photo. Try a JPG or PNG.', 'warning'); }
  }
  if(ok) toast(ok === 1 ? 'Photo added to the board' : `${ok} photos added to the board`, 'add_photo_alternate');
}

/* ---------- navigation & data ---------- */
let subUnsubs = [];
const NAVKEY = 'ekaya-nav-v2';
const saveNav = () => { try{ localStorage.setItem(NAVKEY, JSON.stringify({cur:S.cur, tab:S.tab, sub:S.sub})); }catch(e){} };
const loadNav = () => { try{ return JSON.parse(localStorage.getItem(NAVKEY) || 'null'); }catch(e){ return null; } };
function stopEventSubs(){ subUnsubs.forEach(u => { try{ u(); }catch(e){} }); subUnsubs = []; }
function openEvent(id, tab){
  if(S.cur !== id || !subUnsubs.length){
    stopEventSubs(); E.venue.reset(); E.photos.reset();
    S.cur = id; S.people = []; S.expenses = []; S.mood = []; S.tasks = []; S.venue = []; S.loaded = {}; S.filter = 'all'; S.query = '';
    ['people','expenses','mood','tasks','venue'].forEach(k => subUnsubs.push(Store.subscribe(`events/${id}/${k}`, rows => { if(S.cur !== id) return; S[k] = rows; S.loaded[k] = true; render(); E.refreshSheet(); E.venue.refreshHud(); }, onSubErr)));
  }
  if(tab) S.tab = tab;
  saveNav(); render(); window.scrollTo(0, 0);
}
const render = (() => { let raf = 0; const go = () => { if(raf) return; raf = requestAnimationFrame(() => { raf = 0; if(E.venue.busy() && S.tab === 'plan'){ setTimeout(go, 300); return; } E.render(); }); }; return go; })();
function goHome(){ stopEventSubs(); E.venue.reset(); S.cur = null; S.people = []; S.expenses = []; S.mood = []; S.tasks = []; S.venue = []; closeSheet(); saveNav(); E.render(); window.scrollTo(0, 0); }
function onSubErr(e){ console.warn(e); if(e && e.code === 'revoked'){ S.canWrite = false; toast('Access to this page changed. Reload to continue.', 'info'); render(); } }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if(!t) return;
  const act = t.dataset.act, id = t.dataset.id, ev = E.curEv();
  switch(act){
    case 'close-sheet': closeSheet(); break;
    case 'home': goHome(); break;
    case 'theme': { const order = ['auto', 'light', 'dark'], nx = order[(order.indexOf(E.getTheme()) + 1) % 3]; E.setTheme(nx); toast(nx === 'auto' ? 'Theme follows your device' : nx === 'light' ? 'Ivory theme' : 'Noir theme', themeIcon()); E.render(); break; }
    case 'open-event': openEvent(id, 'overview'); break;
    case 'new-event': if(S.canWrite) eventSheet(null, t.dataset.type); break;
    case 'edit-event': if(ev && S.canWrite) eventSheet(ev); break;
    case 'tab': S.tab = t.dataset.tab; saveNav(); E.render(); window.scrollTo(0, 0); break;
    case 'sub': S.tab = t.dataset.tab; S.sub[t.dataset.tab] = t.dataset.sub; saveNav(); E.render(); if(!t.closest('.seg')) window.scrollTo(0, 0); break;
    case 'filter': S.filter = t.dataset.f; E.render(); break;
    case 'guest': guestSheet(id); break;
    case 'add-guests': if(ev && S.canWrite) addGuestsSheet(ev); break;
    case 'pick-contacts': if(ev && S.canWrite) pickContacts(ev); break;
    case 'invite-msg': if(ev) E.messageSheet('Invite message', inviteText(ev)); break;
    case 'edit-money': if(ev && S.canWrite) moneySheet(ev); break;
    case 'group-msg': if(ev) E.messageSheet('Group update', groupText(ev, E.stats(ev, S.people, S.expenses))); break;
    case 'settle-msg': if(ev) E.messageSheet('Final split', settleText(ev, E.stats(ev, S.people, S.expenses))); break;
    case 'upi-qr': if(ev && ev.upi) upiSheet(ev, +ev.perHead || 0); break;
    case 'add-expense': if(ev && S.canWrite) expenseSheet(ev); break;
    case 'expense': { const x = S.expenses.find(y => y.id === id); if(ev && x && S.canWrite) expenseSheet(ev, x); break; }
    case 'edit-plan': if(ev && S.canWrite) planSheet(ev); break;
    case 'edit-theme': if(ev && S.canWrite) themeSheet(ev); break;
    case 'add-mood': if(S.canWrite) addMoodSheet(); break;
    case 'mood': { const m = S.mood.find(y => y.id === id); if(!m) break; if(m.kind === 'image') photoSheet(m); else if(S.canWrite) (m.kind === 'color' ? colorSheet : noteSheet)(m); break; }
    case 'toggle-task': { const k = S.tasks.find(y => y.id === id); if(k && S.canWrite){ save(Store.update(E.evPath('tasks', id), {done:!k.done, doneAt:k.done ? 0 : Date.now()})); E.vibrate(6); } break; }
    case 'task': { const k = S.tasks.find(y => y.id === id); if(k) taskSheet(k); break; }
    case 'done-toggle': S.doneOpen = !S.doneOpen; E.render(); break;
    default: if(act.startsWith('wall-') || act === 'photo') E.photos.act(act, t, ev);
  }
});
document.addEventListener('input', e => { if(e.target.id === 'g-search'){ S.query = e.target.value; E.render(); } });
document.addEventListener('submit', async e => {
  if(e.target.id !== 'addTask') return; e.preventDefault();
  const tx = $('#taskText'), du = $('#taskDue'), text = tx.value.trim(); if(!text || !S.cur) return;
  const order = S.tasks.reduce((a, t) => Math.max(a, +t.order || 0), 0) + 1; tx.value = ''; const due = du.value; du.value = '';
  if(!(await save(Store.set(E.evPath('tasks', 't' + uid()), {text, done:false, due, order, createdAt:Date.now()})))) tx.value = text;
});
$('#scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });
$('#filePick').addEventListener('change', e => { addPhotos(e.target.files).finally(() => { e.target.value = ''; }); });
document.addEventListener('error', e => { const im = e.target; if(im && im.tagName === 'IMG'){ const tl = im.closest('.mtile'); if(tl) tl.classList.add('broken'); else im.style.visibility = 'hidden'; } }, true);
document.addEventListener('paste', e => { if(S.tab !== 'plan' || S.sub.plan !== 'mood' || !S.cur || !S.canWrite || !$('#sheet').hidden) return; const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if(files.length){ e.preventDefault(); addPhotos(files); } });
['dragover','dragleave','drop'].forEach(type => document.addEventListener(type, e => {
  if(S.tab !== 'plan' || S.sub.plan !== 'mood' || !S.cur || !S.canWrite) return; const board = $('#board'); if(!board) return;
  if(type === 'dragover'){ if([...(e.dataTransfer?.types || [])].includes('Files')){ e.preventDefault(); board.classList.add('board-drop'); } }
  else { board.classList.remove('board-drop'); if(type === 'drop' && e.dataTransfer?.files?.length){ e.preventDefault(); addPhotos(e.dataTransfer.files); } }
}));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => E.render());

/* ---------- boot ---------- */
async function boot(){
  E.render();
  let db = null, user = null, assets = null;
  if(window.claude && typeof window.claude.use === 'function'){ try{ [db, user, assets] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('assets')]); }catch(e){ console.warn(e); } }
  Store.init(db); S.assets = assets;
  if(db){ let can = null; try{ can = user ? await user.can('data.write') : null; }catch(e){} S.canWrite = can !== false; }
  else {
    let seeded = true; try{ seeded = !!localStorage.getItem('ekaya-seeded-v1'); }catch(e){}
    if(!seeded && E.today() <= '2026-11-08'){ try{ localStorage.setItem('ekaya-seeded-v1', '1'); const now = Date.now(); await Store.set('events/diwali-party', E.eventFromTemplate('diwali', {name:'Diwali Party', date:'2026-11-08', createdAt:now})); for(const t of E.tasksFromTemplate('diwali', now)) await Store.set(`events/diwali-party/tasks/${t.id}`, t.data); }catch(e){ console.warn(e); } }
  }
  Store.subscribe('events', rows => { S.events = rows; S.evLoaded = true; if(S.justCreated && rows.some(r => r.id === S.justCreated)) S.justCreated = null; render(); E.refreshSheet(); }, onSubErr);
  const nav = loadNav();
  if(nav && nav.cur){ S.sub = Object.assign(S.sub, nav.sub || {}); openEvent(nav.cur, nav.tab || 'overview'); } else render();
}
E.openEvent = openEvent;
boot();
})();
