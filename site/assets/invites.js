/* Ekaya invitations (organiser side): a private link for each household, the details guests see,
   sending the links one after another on WhatsApp, and what comes back: replies, replies to review
   and payments to confirm. Talks to /api/invite; replies and claims arrive through normal sync. */
(() => {
'use strict';
const {$, $$, esc, icon, inr, S, Store} = E;
const {toast, save, openSheet, closeSheet, val} = E;
const FOOD = ['Veg', 'Non-veg', 'Jain', 'Vegan', 'No onion-garlic'];
const DEFAULT_FOOD = ['Veg', 'Non-veg', 'Jain'];
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const hello = n => /\b(family|parivar|fam)\b|&| and /i.test(n || '') ? String(n).trim() : first(n);

const ready = () => Store.mode === 'remote' && E.onNetlify() && !!E.Remote;
async function api(path, json){
  const r = await fetch('/api/invite/' + path, {method:'POST', headers:{'content-type':'application/json', ...E.Remote.authHeader()}, body:JSON.stringify(json)});
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(j.error || 'Couldn’t reach the server. Check your connection.');
  return j;
}
const linkOf = p => p && p.invite && p.invite.t ? `${location.origin}/i/#${p.invite.t}` : '';
const rawP = id => S.people.find(p => p.id === id);
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-IN', {day:'numeric', month:'short'}); };
const RS = {going:'Coming', maybe:'Maybe', no:'Can’t make it'};
const replyLine = r => !r ? '' : r.rsvp === 'no' ? 'Can’t make it' : `${RS[r.rsvp]} · ${r.coming} ${r.coming === 1 ? 'person' : 'people'}`;
const mealsLine = m => Object.entries(m || {}).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ');
const foodOf = ev => Array.isArray(ev.invite?.food) ? ev.invite.food : DEFAULT_FOOD;
const hostOf = ev => ev.invite?.host || E.Remote?.owner() || 'Ekaya';
const openMore = new Set();   // guest cards with the New link / Turn off row open, kept across re-renders

/* ---------- links ---------- */
async function createLinks(ev, ids){
  const {tokens} = await api('links', {ev:ev.id, guests:ids});
  const at = Date.now();
  for(const [pid, t] of Object.entries(tokens)){
    const p = rawP(pid); if(!p) continue;
    await save(Store.update(`events/${ev.id}/people/${pid}`, {invite:{t, at, sent:0}, maxPeople:E.maxPeople(p)}));
  }
  return Object.keys(tokens).length;
}
async function revoke(ev, ids){
  await api('revoke', {ev:ev.id, guests:ids});
  for(const pid of ids) if(rawP(pid)) await save(Store.update(`events/${ev.id}/people/${pid}`, {invite:null}));
}
function message(ev, p){
  const when = [ev.date ? E.fmtMed(ev.date) : '', ev.time ? E.fmtTime(ev.time) : ''].filter(Boolean).join(', ');
  const max = E.maxPeople(p);
  return [`Hi ${hello(p.name)}! ${ev.type === 'diwali' ? '🪔' : '✨'}`, `You’re invited to ${ev.name}${when ? ` on ${when}` : ''}${ev.venue ? ` at ${ev.venue}` : ''}.`, '',
    `Your personal invitation (tap to reply${E.contriOn(ev) && +ev.perHead ? ' and see your contri' : ''}):`, linkOf(p), '',
    max > 1 ? 'This link is just for your family, so please don’t forward it.' : 'This link is just for you, so please don’t forward it.', `– ${hostOf(ev)}`].join('\n');
}
const waHref = (ev, p) => E.waLink(message(ev, p), p.phone);
const markSent = (ev, pid) => { const p = rawP(pid); if(p && p.invite) save(Store.update(`events/${ev.id}/people/${pid}`, {invite:{sent:Date.now()}})); };

/* ---------- claims: "I've paid" from the guest page, confirmed by Ekta into exactly one receipt ---------- */
const claimState = c => S.payments.some(x => x.id === 'rc' + c.id) || c.status === 'confirmed' ? 'confirmed' : c.status === 'declined' ? 'declined' : 'pending';
const pendingClaims = (pid) => S.claims.filter(c => (!pid || c.guestId === pid) && claimState(c) === 'pending' && S.people.some(p => p.id === c.guestId)).sort((a, b) => (b.at || 0) - (a.at || 0));
async function confirmClaim(ev, c){
  // the receipt id comes from the claim, so a second tap or a second phone writes the same receipt
  const ok = await save(Store.set(`events/${ev.id}/payments/rc${c.id}`, {guestId:c.guestId, amount:+c.amount || 0, mode:'UPI', date:c.date || E.today(), ref:c.ref || '', createdAt:Date.now(), claim:c.id}));
  if(ok) await save(Store.update(`events/${ev.id}/claims/${c.id}`, {status:'confirmed', doneAt:Date.now()}));
  return ok;
}
function dupWarn(c){
  const t = Date.parse(c.date || '') || c.at || 0;
  const near = S.payments.find(x => x.guestId === c.guestId && x.id !== 'rc' + c.id && +x.amount === +c.amount && Math.abs((Date.parse(x.date || '') || x.createdAt || 0) - t) < 4 * 864e5);
  return near ? `<p class="inv-warn">${icon('warning', false, 'xs')}<span>${inr(near.amount)} on ${esc(E.fmtShort(near.date))} is already recorded. Check it isn’t the same payment.</span></p>` : '';
}
const claimRow = (c, withName) => { const p = rawP(c.guestId); return `<div class="inv-claim" data-claim="${esc(c.id)}"><div class="grow"><b>${withName && p ? `${esc(p.name)} · ` : ''}${inr(c.amount)}</b><small>Says they paid${c.date ? ` on ${esc(E.fmtShort(c.date))}` : ''}${c.ref ? ` · ref ${esc(c.ref)}` : ''} · ${ago(c.at || Date.now())}</small>${dupWarn(c)}</div>
  ${S.canWrite ? `<div class="chips"><button class="btn ghost sm" type="button" data-act="inv-decline" data-id="${esc(c.id)}">Not received</button><button class="btn sm" type="button" data-act="inv-confirm" data-id="${esc(c.id)}">${icon('check')}Confirm</button></div>` : ''}</div>`; };
/** pending "I've paid" claims for one guest, shown at the top of their contri panel */
function claimsHtml(r){
  const list = pendingClaims(r.id), declined = S.claims.filter(c => c.guestId === r.id && claimState(c) === 'declined');
  if(!list.length && !declined.length) return '';
  return `<div class="inv-claims"><p class="smallcaps">To confirm</p>${list.map(c => claimRow(c, false)).join('')}${declined.slice(0, 2).map(c => `<div class="inv-claim muted"><div class="grow"><b>${inr(c.amount)}</b><small>Marked not received${c.date ? ` · ${esc(E.fmtShort(c.date))}` : ''}</small></div>${S.canWrite ? `<button class="btn text sm" type="button" data-act="inv-confirm" data-id="${esc(c.id)}">Confirm anyway</button>` : ''}</div>`).join('')}</div>`;
}

/* ---------- the invitation panel in a guest's card ---------- */
function statusOf(r){
  const p = rawP(r.id) || r;
  if(r.reply) return `Replied ${ago(r.reply.at)}`;
  if(!p.invite || !p.invite.t) return 'Not sent yet';
  return p.invite.sent ? `Sent ${ago(p.invite.sent)}` : 'Link ready to send';
}
function panel(ev, r){
  if(!ready()) return '';
  const p = rawP(r.id) || r, link = linkOf(p), w = S.canWrite, max = E.maxPeople(p);
  const reply = r.reply && !r.review ? `<div class="inv-reply"><b>${esc(replyLine(r.reply))}</b>${mealsLine(r.reply.meals) ? `<small>${esc(mealsLine(r.reply.meals))}</small>` : ''}${r.reply.note ? `<q>${esc(r.reply.note)}</q>` : ''}</div>` : '';
  const review = r.review ? `<div class="confirm soft inv-review"><p><b>New reply: ${esc(replyLine(r.reply))}.</b> You’d set ${esc(({going:'Coming', maybe:'Maybe', no:'Not coming', invited:'Not replied'})[p.rsvp] || 'Not replied')}${p.rsvp !== 'no' ? `, ${1 + (+p.plusOnes || 0)} ${(+p.plusOnes || 0) ? 'people' : 'person'}` : ''}.</p>${w ? `<div class="sheet-foot"><button class="btn ghost" type="button" data-act="inv-keep" data-id="${esc(r.id)}">Keep mine</button><button class="btn" type="button" data-act="inv-use" data-id="${esc(r.id)}">Use their reply</button></div>` : ''}</div>` : '';
  const actions = !link ? (w ? `<p class="hint-s">A private link for ${esc(first(r.name))} to reply${E.contriOn(ev) ? ' and see their contri' : ''}. No app or sign-in.</p><div class="chips"><button class="btn sm" type="button" data-act="inv-create" data-id="${esc(r.id)}">${icon('link')}Create link</button></div>` : '')
    : `<div class="inv-for"><span>Invited for</span><div class="stepper sm"><button type="button" data-act="inv-max" data-id="${esc(r.id)}" data-d="-1" aria-label="One fewer" ${w && max > 1 ? '' : 'disabled'}>${icon('remove')}</button><b>${max}</b><button type="button" data-act="inv-max" data-id="${esc(r.id)}" data-d="1" aria-label="One more" ${w && max < 20 ? '' : 'disabled'}>${icon('add')}</button></div></div>
      <div class="chips"><a class="btn sm" target="_blank" rel="noopener" href="${esc(waHref(ev, p))}" data-inv-sent="${esc(r.id)}">${icon('chat')}${p.invite.sent ? 'Send again' : 'Send on WhatsApp'}</a><button class="btn ghost sm" type="button" data-act="inv-copy" data-id="${esc(r.id)}">${icon('content_copy')}Copy link</button>
      ${w ? `<button class="btn text sm" type="button" data-act="inv-more" data-id="${esc(r.id)}" aria-expanded="${openMore.has(r.id)}">${icon('more_horiz')}<span class="sr-only">More</span></button>` : ''}</div>
      <div class="inv-more" id="inv-more-${esc(r.id)}" ${openMore.has(r.id) ? '' : 'hidden'}><p class="hint-s">A new link stops the old one working. Turning it off stops this household replying.</p><div class="chips"><button class="btn ghost sm" type="button" data-act="inv-reissue" data-id="${esc(r.id)}">${icon('autorenew')}New link</button><button class="btn ghost sm danger-text" type="button" data-act="inv-off" data-id="${esc(r.id)}">${icon('link_off')}Turn off</button></div></div>`;
  return `<div class="card-h"><span class="eyebrow">Invitation</span><span class="muted small">${esc(statusOf(r))}</span></div>${review}${reply}${actions}`;
}

/* ---------- activity on the Guests tab ---------- */
const SEEN = id => 'ekaya-inv-seen:' + id;
const seenAt = id => { try{ return +localStorage.getItem(SEEN(id)) || 0; }catch(e){ return 0; } };
function activity(ev, st){
  if(!ready()) return '';
  const claims = pendingClaims(), reviews = st.rows.filter(r => r.review), seen = seenAt(ev.id);
  const recent = st.rows.filter(r => r.reply && !r.review && r.reply.at > Math.max(seen, Date.now() - 14 * 864e5)).sort((a, b) => b.reply.at - a.reply.at);
  const fresh = recent.filter(r => r.reply.at > seen).length;
  if(!claims.length && !reviews.length && !recent.length) return '';
  const parts = [claims.length ? `${claims.length} ${claims.length === 1 ? 'payment' : 'payments'} to confirm` : '', reviews.length ? `${reviews.length} ${reviews.length === 1 ? 'reply' : 'replies'} to review` : '', fresh ? `${fresh} new ${fresh === 1 ? 'reply' : 'replies'}` : ''].filter(Boolean);
  return `<section class="card plain inv-act"><div class="inv-act-h"><span class="eyebrow">From invitations</span><b>${parts.join(' · ') || 'All caught up'}</b></div>
    ${claims.map(c => claimRow(c, true)).join('')}
    ${reviews.map(r => `<button class="inv-row" type="button" data-act="guest" data-id="${esc(r.id)}">${icon('rule')}<span class="grow"><b>${esc(r.name)}</b><small>Now says ${esc(replyLine(r.reply))} · review</small></span>${icon('chevron_right')}</button>`).join('')}
    ${recent.slice(0, 6).map(r => `<button class="inv-row" type="button" data-act="guest" data-id="${esc(r.id)}">${r.reply.at > seen ? '<i class="dot" aria-label="New"></i>' : icon('mark_email_read')}<span class="grow"><b>${esc(r.name)}</b><small>${esc(replyLine(r.reply))}${mealsLine(r.reply.meals) ? ` · ${esc(mealsLine(r.reply.meals))}` : ''} · ${ago(r.reply.at)}</small></span>${icon('chevron_right')}</button>`).join('')}
    ${fresh ? `<div class="inv-act-foot"><button class="btn text sm" type="button" data-act="inv-seen">Mark replies as read</button></div>` : ''}</section>`;
}
/** lines for the overview's "Needs attention" card */
function attention(ev, st){
  if(!ready()) return [];
  const out = [], c = pendingClaims();
  if(c.length) out.push(['payments', `${c.length} ${c.length === 1 ? 'payment' : 'payments'} to confirm`, inr(c.reduce((a, x) => a + (+x.amount || 0), 0)), 'data-act="tab" data-tab="guests"', 'bad']);
  if(st.review) out.push(['rule', `${st.review} ${st.review === 1 ? 'reply' : 'replies'} to review`, '', 'data-act="tab" data-tab="guests"']);
  const n = E.daysUntil(ev.date), unsent = st.rows.filter(r => !r.reply && !(rawP(r.id)?.invite?.sent)).length;
  if(n !== null && n >= 1 && n <= 21 && unsent && st.rows.length) out.push(['mail', `${unsent} ${unsent === 1 ? 'invitation' : 'invitations'} not sent yet`, '', 'data-act="inv-sheet"']);
  return out;
}

/* ---------- the Invitations sheet: details, then send one after another ---------- */
function sheet(ev){
  if(!ready()){
    openSheet({title:'Invitations', body:`<p class="muted">Personal invitation links need sync turned on, so guests’ replies can reach the app.</p>${E.onNetlify() ? `<div class="sheet-foot"><button class="btn" data-act="turn-on-sync">${icon('cloud_sync')}Turn on sync</button></div>` : ''}`});
    return;
  }
  const body = () => {
    const st = E.stats(ev, S.people, S.expenses), rows = st.rows;
    const noLink = rows.filter(r => !rawP(r.id)?.invite?.t), linked = rows.length - noLink.length;
    const sent = rows.filter(r => rawP(r.id)?.invite?.sent).length, replied = rows.filter(r => r.reply).length;
    const order = r => { const p = rawP(r.id); return !p?.invite?.t ? 0 : r.reply ? 3 : p.invite.sent ? 2 : 1; };
    const list = [...rows].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    return `<div class="inv-sum"><div><b>${rows.length}</b><span>households</span></div><div><b>${sent}</b><span>sent</span></div><div><b>${replied}</b><span>replied</span></div></div>
      <div class="chips"><button class="btn ghost sm" type="button" data-act="inv-settings">${icon('tune')}Invitation details</button><a class="btn ghost sm" href="/i/#preview=${esc(ev.id)}" target="_blank" rel="noopener">${icon('visibility')}Preview</a><button class="btn ghost sm" type="button" data-act="invite-msg">${icon('forum')}Group message</button></div>
      ${S.canWrite && !ev.invite ? `<p class="hint">${icon('lightbulb')}<span>Before sending, add your WhatsApp number and a Maps link in <b>Invitation details</b>, so guests can find the venue and reach you.</span></p>` : ''}
      ${noLink.length && S.canWrite ? `<div class="confirm soft"><p><b>${noLink.length === rows.length ? `Create links for all ${rows.length} households` : `${noLink.length} ${noLink.length === 1 ? 'household has' : 'households have'} no link yet`}</b><br><span class="hint-s">Each family gets its own private link to reply${st.contri ? ' and see their contri' : ''}.</span></p><div class="sheet-foot"><button class="btn" type="button" data-act="inv-create-all">${icon('link')}Create ${noLink.length} ${noLink.length === 1 ? 'link' : 'links'}</button></div></div>` : ''}
      ${linked ? `<p class="hint-s">Tap <b>Send</b> to open WhatsApp with each family’s own message, then come back for the next one.</p>` : ''}
      <div class="inv-list">${list.map(r => { const p = rawP(r.id) || r, has = !!p.invite?.t;
        return `<div class="inv-li"><span class="av ${E.avc(r.name)}">${esc(E.initials(r.name))}</span><span class="grow"><b>${esc(r.name)}${E.maxPeople(p) > 1 ? ` <small>· ${E.maxPeople(p)}</small>` : ''}</b><small>${esc(r.reply ? replyLine(r.reply) : statusOf(r))}${has && !p.phone ? ' · no number saved' : ''}</small></span>
          ${has ? `<a class="btn ${p.invite.sent || r.reply ? 'ghost' : ''} sm" target="_blank" rel="noopener" href="${esc(waHref(ev, p))}" data-inv-sent="${esc(r.id)}">${icon(p.invite.sent ? 'check' : 'chat')}${p.invite.sent ? 'Sent' : 'Send'}</a>` : `<span class="tag">No link</span>`}</div>`; }).join('')}</div>
      ${linked && S.canWrite ? `<div class="inv-danger"><button class="btn text sm danger-text" type="button" data-act="inv-off-all">${icon('link_off')}Turn off all links</button></div>` : ''}`;
  };
  openSheet({id:'invites', title:'Invitations', body:`<div id="inv-sheet">${body()}</div>`, refresh:b => { const h = $('#inv-sheet', b); if(h) h.innerHTML = body(); }});
}

function settings(ev){
  const inv = ev.invite || {}, contri = E.contriOn(ev);
  let food = foodOf(ev).slice();
  openSheet({id:'inv-settings', title:'Invitation details', body:`<p class="muted">What guests see on their invitation, besides the date, time, venue and dress code.</p>
    <div class="grid2"><label class="field"><span>From</span><input class="input" id="is-host" maxlength="40" value="${esc(inv.host || '')}" placeholder="${esc(E.Remote.owner() || 'Ekta')}"></label>
      <label class="field"><span>Your WhatsApp <em class="opt-l">optional</em></span><input class="input" id="is-phone" type="tel" inputmode="tel" maxlength="16" value="${esc(inv.phone || '')}" placeholder="98xxxxxx10"></label></div>
    <label class="field"><span>Google Maps link <em class="opt-l">optional</em></span><input class="input" id="is-map" type="url" inputmode="url" maxlength="300" value="${esc(inv.map || '')}" placeholder="Paste from Google Maps › Share"><small class="hint-s">Without one, Directions searches for the venue name.</small></label>
    <label class="field"><span>Note for guests <em class="opt-l">optional</em></span><textarea class="input" id="is-note" rows="3" maxlength="600" placeholder="Parking, the gate to use, what to bring…">${esc(inv.note || '')}</textarea></label>
    <label class="field"><span>Reply by <em class="opt-l">optional</em></span><input class="input" id="is-by" type="date" value="${esc(inv.rsvpBy || '')}"></label>
    <div class="toggle"><div><b>Ask about food</b><div class="hint-s">Guests say how many of each, for the caterer.</div></div><button class="switch" type="button" role="switch" id="is-food" aria-checked="${food.length > 0}" aria-label="Ask about food"></button></div>
    <div class="chips" id="is-foods" ${food.length ? '' : 'hidden'}>${FOOD.map(f => `<button class="chip" type="button" data-f="${esc(f)}" aria-pressed="${food.includes(f)}">${esc(f)}</button>`).join('')}</div>
    ${contri ? `<label class="field"><span>Name on your UPI account</span><input class="input" id="is-upiname" maxlength="40" value="${esc(ev.upiName || '')}" placeholder="${esc(inv.host || E.Remote.owner() || 'As your bank shows it')}"><small class="hint-s">Shown in the guest’s UPI app${ev.upi ? ` with ${esc(ev.upi)}` : '. Add your UPI ID in Money settings'}.</small></label>` : ''}
    <p class="hint">${icon('lock')}<span>Guests see only their own reply and contri. Links stop working 30 days after the event.</span></p>
    <div class="sheet-foot"><button class="btn" type="button" id="is-save">Save</button></div>`,
  mount: b => {
    $('#is-food', b).addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', on); $('#is-foods', b).hidden = !on; food = on ? (food.length ? food : DEFAULT_FOOD.slice()) : []; $$('#is-foods .chip', b).forEach(c => c.setAttribute('aria-pressed', food.includes(c.dataset.f))); });
    $('#is-foods', b).addEventListener('click', e => { const c = e.target.closest('[data-f]'); if(!c) return; const f = c.dataset.f; food = food.includes(f) ? food.filter(x => x !== f) : FOOD.filter(x => x === f || food.includes(x)); c.setAttribute('aria-pressed', food.includes(f)); });
    $('#is-save', b).addEventListener('click', async () => {
      const map = val(b, '#is-map');
      if(map && !/^https:\/\//.test(map)){ toast('Paste the full Maps link, starting with https://', 'info'); return; }
      const patch = {invite:{host:val(b, '#is-host'), phone:val(b, '#is-phone').replace(/[^\d+]/g, ''), map, note:$('#is-note', b).value.trim(), rsvpBy:val(b, '#is-by'), food}};
      if($('#is-upiname', b)) patch.upiName = val(b, '#is-upiname');
      if(await save(Store.update(`events/${ev.id}`, patch))){ toast('Invitation details saved'); sheet(E.curEv() || ev); }
    });
  }});
}

/* ---------- actions ---------- */
async function act(a, t, ev){
  if(!ev) return;
  const id = t.dataset.id, busy = async fn => { t.disabled = true; try{ await fn(); }catch(e){ toast(e.message, 'warning'); } finally { t.disabled = false; } };
  switch(a){
    case 'inv-sheet': sheet(ev); break;
    case 'inv-settings': if(S.canWrite) settings(ev); break;
    case 'inv-create': busy(async () => { if(await createLinks(ev, [id])) toast('Link ready. Send it on WhatsApp.', 'link'); }); break;
    case 'inv-create-all': busy(async () => { const ids = S.people.filter(p => !p.invite?.t).map(p => p.id); let n = 0; for(let i = 0; i < ids.length; i += 50) n += await createLinks(ev, ids.slice(i, i + 50)); toast(`${n} ${n === 1 ? 'link' : 'links'} ready`, 'link'); }); break;
    case 'inv-reissue': openMore.delete(id); busy(async () => { await createLinks(ev, [id]); toast('New link made. The old one no longer works.', 'autorenew'); }); break;
    case 'inv-off': openMore.delete(id); busy(async () => { await revoke(ev, [id]); toast('Link turned off', 'link_off'); }); break;
    case 'inv-off-all': {
      if(!t.classList.contains('armed')){ t.classList.add('armed'); t.innerHTML = `${icon('link_off')}Tap again to turn off every link`; setTimeout(() => { if(document.contains(t)){ t.classList.remove('armed'); t.innerHTML = `${icon('link_off')}Turn off all links`; } }, 4000); break; }
      busy(async () => { await api('revoke', {ev:ev.id, all:true}); for(const p of S.people.filter(x => x.invite)) await save(Store.update(`events/${ev.id}/people/${p.id}`, {invite:null})); toast('All invitation links turned off', 'link_off'); });
      break;
    }
    case 'inv-copy': { const p = rawP(id); if(p && linkOf(p)) E.copyText(linkOf(p)); break; }
    case 'inv-more': { const m = $(`#inv-more-${CSS.escape(id)}`); if(openMore.has(id)) openMore.delete(id); else openMore.add(id); if(m){ m.hidden = !openMore.has(id); t.setAttribute('aria-expanded', openMore.has(id)); } break; }
    case 'inv-max': { const p = rawP(id); if(!p || !S.canWrite) break; const v = Math.max(1, Math.min(20, E.maxPeople(p) + (+t.dataset.d))); save(Store.update(`events/${ev.id}/people/${id}`, {maxPeople:v})); break; }
    case 'inv-use': save(Store.update(`events/${ev.id}/people/${id}`, {ovr:null})).then(ok => ok && toast('Using their reply', 'check_circle')); break;
    case 'inv-keep': { const r = S.replies.find(x => (x.guestId || x.id) === id); if(r) save(Store.update(`events/${ev.id}/people/${id}`, {ovr:r.rev})).then(ok => ok && toast('Kept your record', 'check_circle')); break; }
    case 'inv-confirm': { const c = S.claims.find(x => x.id === id); if(c && S.canWrite) busy(async () => { if(await confirmClaim(ev, c)){ E.vibrate(12); E.celebrate(t, false); toast(`${inr(c.amount)} from ${first(rawP(c.guestId)?.name)} confirmed`, 'payments'); } }); break; }
    case 'inv-decline': { const c = S.claims.find(x => x.id === id); if(c && S.canWrite) save(Store.update(`events/${ev.id}/claims/${c.id}`, {status:'declined', doneAt:Date.now()})).then(ok => ok && toast('Marked as not received. They’ll see it on their invitation.', 'info')); break; }
    case 'inv-seen': try{ localStorage.setItem(SEEN(ev.id), String(Date.now())); }catch(e){} E.render(); break;
  }
}
// WhatsApp links open in a new tab; note the send without getting in the way of the link
document.addEventListener('click', e => { const a = e.target.closest('[data-inv-sent]'); if(a){ const ev = E.curEv(); if(ev) setTimeout(() => markSent(ev, a.dataset.invSent), 300); } }, true);

/** when Ekta changes a guest's RSVP or headcount herself after they replied, her values stand from then on */
E.inv = {ready, panel, claimsHtml, activity, attention, sheet, settings, act, pendingClaims, revoke, revokeAll:ev => api('revoke', {ev:ev.id, all:true}),
  overridePatch:(r, patch) => r && r.reply ? {rsvp:r.rsvp, plusOnes:r.plusOnes, ...patch, ovr:r.reply.rev} : patch};
})();
