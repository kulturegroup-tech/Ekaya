/* Ekaya photo wall (organiser side): QR card, gallery, upload controls. Talks to /api/gallery. */
(() => {
'use strict';
const {$, esc, icon, okHex, S, Store} = E;
const P = {id:null, data:null, loading:false, err:null, at:0, timer:null};
const api = (path, opts={}) => fetch('/api/gallery' + path, {...opts, headers:{...(opts.headers || {}), ...(E.Remote ? E.Remote.authHeader() : {})}}).then(async r => { const j = await r.json().catch(() => ({})); if(!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), {status:r.status}); return j; });
const guestUrl = id => `${location.origin}/g/?e=${encodeURIComponent(id)}`;
const thumb = (id, k) => `/api/gallery/${id}/photos/${k}?s=t`;
const full = (id, k) => `/api/gallery/${id}/photos/${k}`;

async function load(ev){
  const id = ev.gallery.id;
  if(P.loading) return; P.loading = true;
  try{ const d = await api('/' + encodeURIComponent(id)); P.id = id; P.data = d; P.err = null; }
  catch(e){ P.id = id; P.err = e.status === 404 ? 'missing' : 'offline'; }
  finally{ P.loading = false; P.at = Date.now(); E.render(); }
}
function qrCard(ev, id){
  const pal = (ev.theme?.palette || []).map(c => okHex(c.hex));
  return `<div class="qr-card"><span class="qe">Photo wall</span><h3>${esc(ev.name)}</h3><div class="qr">${E.qrSvg(guestUrl(id))}</div><p>Scan to add your photos</p>${ev.date ? `<span class="qe" style="color:#6e6156">${esc(E.fmtLong(ev.date))}</span>` : ''}${pal.length ? `<div class="strip">${pal.map(h => `<i style="--c:${h}"></i>`).join('')}</div>` : ''}</div>`;
}
function view(ev){
  const head = `<section class="vhead"><p class="eyebrow gold">${esc(ev.name)}</p><div class="vhead-row"><h1 class="h1">Photo wall</h1></div></section>`;
  const signedOut = E.Store.mode === 'local' && P.needSignIn;
  if(!E.onNetlify()) return head + `<section class="empty glass"><span class="empty-ic">${icon('qr_code_2')}</span><h3>Open Ekāya on its website</h3><p>The QR photo wall needs the Netlify site, where guests can upload without an account.</p></section>`;
  if(!ev.gallery) return head + `<section class="wall-hero glass foil"><div style="display:flex;flex-direction:column;gap:16px">
      <p class="sub" style="font-size:17px">Put one QR code on the tables. Guests scan it, add their photos from the party, and everyone can see and download the whole gallery. No app, no login.</p>
      <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:var(--ink-2)"><li>Create the wall and print the QR card</li><li>Guests scan and upload from their phones</li><li>Everyone browses and saves the photos</li></ol>
      ${signedOut ? `<p class="hint">${icon('lock')}<span>Sign in to your Ekāya workspace to create a shareable photo wall. You can preview the card here.</span></p><div><button class="btn gold" data-act="turn-on-sync">${icon('login')}Sign in</button></div>`
        : S.canWrite ? `<div><button class="btn gold" data-act="wall-create">${icon('qr_code_2')}Create photo wall</button></div>` : ''}</div>
      <div class="qr-card preview" style="opacity:.9"><span class="pv-tag">Preview</span><span class="qe">Photo wall</span><h3>${esc(ev.name)}</h3><div class="qr ph">${icon('qr_code_2', false, 'lg')}</div><p>Scan to add your photos</p></div></section>`;
  const id = ev.gallery.id, d = P.id === id ? P.data : null, url = guestUrl(id);
  if(P.id === id && P.err === 'missing') return head + `<section class="empty glass"><span class="empty-ic">${icon('error')}</span><h3>This photo wall was removed</h3><p>Create a new one to get a fresh QR code.</p>${S.canWrite ? `<button class="btn" data-act="wall-create">${icon('qr_code_2')}Create a new wall</button>` : ''}</section>`;
  const open = d ? d.open : true, photos = d ? d.photos : [];
  return head + `<section class="wall-hero glass foil"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="stat-row" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>Photos</span><b class="gold">${d ? d.count : '…'}</b><small>${d && d.count ? `latest ${timeAgo(photos[0].t)}` : 'none yet'}</small></div><div><span>Uploads</span><b class="${open ? 'good' : 'bad'}">${open ? 'Open' : 'Closed'}</b><small>${open ? 'guests can add' : 'browse only'}</small></div></div>
      <div class="link-box"><code>${esc(url.replace(/^https?:\/\//, ''))}</code><button class="icon-btn" data-act="wall-copy" aria-label="Copy link">${icon('content_copy')}</button></div>
      <div class="chips"><button class="btn gold" data-act="wall-card">${icon('download')}Download QR card</button><button class="btn ghost" data-act="wall-share">${icon('ios_share')}Share link</button><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">${icon('open_in_new')}Guest view</a></div>
      ${S.canWrite && ev.gallery.key ? `<div class="toggle" style="border-top:1px solid var(--line);padding-top:14px"><div><b>Guests can upload</b><div class="hint-s">Turn off after the event to keep the gallery as it is.</div></div><button class="switch" role="switch" data-act="wall-toggle" aria-checked="${open}" aria-label="Guests can upload"></button></div>` : ''}
    </div>${qrCard(ev, id)}</section>
    <div class="section-label"><span class="eyebrow">Gallery</span><span class="grow"></span><button class="btn text sm" data-act="wall-upload">${icon('add_photo_alternate')}Add photos</button><button class="icon-btn" data-act="wall-refresh" aria-label="Refresh">${icon('refresh')}</button></div>
    ${!d ? `<div class="pgrid">${'<button disabled></button>'.repeat(6)}</div>` : photos.length ? `<div class="pgrid">${photos.map(p => `<button data-act="photo" data-k="${esc(p.k)}" aria-label="Open photo"><img src="${esc(thumb(id, p.k))}" alt="" loading="lazy"></button>`).join('')}</div>`
      : `<section class="empty glass"><span class="empty-ic">${icon('photo_camera')}</span><h3>No photos yet</h3><p>Once guests scan the QR and upload, their photos appear here.</p></section>`}
    ${P.err === 'offline' ? `<p class="hint-s">Couldn’t reach the photo wall just now. It retries every 30 seconds.</p>` : ''}`;
}
function timeAgo(t){ if(!t) return ''; const m = Math.round((Date.now() - t) / 60000); if(m < 1) return 'just now'; if(m < 60) return `${m} min ago`; const h = Math.round(m / 60); if(h < 24) return `${h} h ago`; return new Date(t).toLocaleDateString('en-IN', {day:'numeric', month:'short'}); }
function tile(ev){
  if(!ev.gallery) return `<div class="tile-big"><span class="empty-ic" style="width:72px;height:72px">${icon('qr_code_2', false, 'lg')}</span><div><div class="big-amt" style="font-size:24px">QR photo wall</div><div class="muted small">Guests scan, upload and share the party photos</div></div></div>`;
  const d = P.id === ev.gallery.id ? P.data : null;
  return `<div class="tile-big"><span style="width:72px;height:72px;border-radius:12px;background:#fff;padding:5px;display:block;flex:none">${E.qrSvg(guestUrl(ev.gallery.id))}</span><div><div class="big-amt">${d ? `${d.count} photos` : 'Photo wall'}</div><div class="muted small">${d ? (d.open ? 'Uploads open' : 'Uploads closed') : 'Ready to share'}</div></div></div>
    ${d && d.photos.length ? `<div class="thumbs">${d.photos.slice(0, 4).map(p => `<img src="${esc(thumb(ev.gallery.id, p.k))}" alt="" loading="lazy">`).join('')}</div>` : ''}`;
}
function after(ev){
  if(!E.onNetlify() || !ev.gallery) return;
  if((P.id !== ev.gallery.id || Date.now() - P.at > 30000) && !P.loading) load(ev);
  if(!P.timer) P.timer = setInterval(() => { const e = E.curEv(); if(e && e.gallery && S.tab === 'photos' && document.visibilityState === 'visible') load(e); }, 30000);
}

async function compressPair(file){
  const big = await E.scaled(file, 2048), small = await E.scaled(file, 480);
  let fullB = await E.toBlob(big, 0.85); if(fullB.size > 3.8e6) fullB = await E.toBlob(await E.scaled(file, 1600), 0.8);
  return {full:fullB, thumb:await E.toBlob(small, 0.78)};
}
async function upload(ev, files){
  files = [...files].filter(f => f.type.startsWith('image/')); if(!files.length) return;
  E.toast(`Uploading ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`, 'upload'); let ok = 0;
  for(const f of files){
    try{ const {full:fb, thumb:tb} = await compressPair(f); const fd = new FormData(); fd.append('full', fb, 'photo.jpg'); fd.append('thumb', tb, 'thumb.jpg'); fd.append('name', 'Ekta');
      await api(`/${ev.gallery.id}/photos`, {method:'POST', body:fd, headers:ev.gallery.key ? {'x-admin-key':ev.gallery.key} : {}}); ok++; }
    catch(e){ E.toast(e.message || 'Upload failed. Try again.', 'warning'); }
  }
  if(ok){ E.toast(`${ok} ${ok === 1 ? 'photo' : 'photos'} added`, 'photo_library'); P.at = 0; load(ev); }
}
function lightbox(ev, k){
  const id = ev.gallery.id, list = (P.data?.photos || []); let i = list.findIndex(p => p.k === k);
  const body = () => { const p = list[i]; return `<img class="mi-img" id="lb-img" src="${esc(full(id, p.k))}" alt="Photo from ${esc(ev.name)}"><div class="card-h"><span class="muted small" id="lb-meta">${esc(timeAgo(p.t))}</span><span class="muted small">${i + 1} of ${list.length}</span></div>
    <div class="sheet-foot"><button class="icon-btn" type="button" data-lb="-1" aria-label="Previous" ${i === 0 ? 'disabled' : ''}>${icon('chevron_left')}</button><button class="icon-btn" type="button" data-lb="1" aria-label="Next" ${i >= list.length - 1 ? 'disabled' : ''}>${icon('chevron_right')}</button><span class="grow"></span>
    ${S.canWrite && ev.gallery.key ? `<button class="btn danger-text" type="button" id="lb-del">${icon('delete')}Remove</button>` : ''}<a class="btn ghost" href="${esc(full(id, p.k))}?dl=1" download>${icon('download')}Save</a></div>`; };
  const meta = b => { const p = list[i]; fetch(`${full(id, p.k)}?meta=1`).then(r => r.json()).then(m => { const el = $('#lb-meta', b); if(el && list[i] === p) el.textContent = `${m.n ? `Added by ${m.n} · ` : ''}${timeAgo(m.t)}`; }).catch(() => {}); };
  E.openSheet({title:'Photo', body:body(), mount: b => {
    meta(b);
    b.addEventListener('click', async e => {
      const n = e.target.closest('[data-lb]'); if(n){ i = Math.max(0, Math.min(list.length - 1, i + (+n.dataset.lb))); b.innerHTML = body(); meta(b); return; }
      if(e.target.closest('#lb-del')){ try{ await api(`/${id}/photos/${list[i].k}`, {method:'DELETE', headers:{'x-admin-key':ev.gallery.key}}); E.closeSheet(); E.toast('Photo removed', 'delete'); P.at = 0; load(ev); }catch(err){ E.toast(err.message, 'warning'); } }
    });
    let sx = null; b.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true}); b.addEventListener('touchend', e => { if(sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 50){ const ni = Math.max(0, Math.min(list.length - 1, i + (dx < 0 ? 1 : -1))); if(ni !== i){ i = ni; b.innerHTML = body(); meta(b); } } });
  }});
}
async function card(ev){
  const id = ev.gallery.id, url = guestUrl(id);
  try{
    await Promise.all([document.fonts.load('600 90px "Cormorant Garamond"'), document.fonts.load('italic 500 56px "Cormorant Garamond"'), document.fonts.load('650 28px "Google Sans Flex"')]).catch(() => {});
    const W = 1200, H = 1680, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#FBF6EE'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(176,132,58,.55)'; x.lineWidth = 3; x.strokeRect(40, 40, W - 80, H - 80); x.lineWidth = 1.5; x.strokeRect(58, 58, W - 116, H - 116);
    x.textAlign = 'center'; x.fillStyle = '#9C7637'; x.font = '650 28px "Google Sans Flex", system-ui, sans-serif'; if('letterSpacing' in x) x.letterSpacing = '10px'; x.fillText('PHOTO WALL', W / 2, 190); if('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = '#1C1611'; let fs = 108; x.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`; while(x.measureText(ev.name).width > W - 220 && fs > 56){ fs -= 4; x.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`; } x.fillText(ev.name, W / 2, 320);
    if(ev.date){ x.fillStyle = '#6E6156'; x.font = '500 34px "Google Sans Flex", system-ui, sans-serif'; x.fillText(E.fmtLong(ev.date), W / 2, 385); }
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); const n = qr.getModuleCount(), size = 660, cell = size / (n + 4), ox = (W - size) / 2, oy = 460;
    x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect ? x.roundRect(ox - 20, oy - 20, size + 40, size + 40, 28) : x.rect(ox - 20, oy - 20, size + 40, size + 40); x.fill();
    x.fillStyle = '#1C1611'; for(let r = 0; r < n; r++) for(let q = 0; q < n; q++) if(qr.isDark(r, q)) x.fillRect(Math.floor(ox + (q + 2) * cell), Math.floor(oy + (r + 2) * cell), Math.ceil(cell), Math.ceil(cell));
    x.fillStyle = '#1C1611'; x.font = 'italic 500 64px "Cormorant Garamond", Georgia, serif'; x.fillText('Scan to add your photos', W / 2, 1250);
    x.fillStyle = '#6E6156'; x.font = '500 30px "Google Sans Flex", system-ui, sans-serif'; x.fillText('and see everyone’s from the night', W / 2, 1310);
    x.fillStyle = '#A29486'; x.font = '500 24px "Google Sans Flex", system-ui, sans-serif'; x.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1385);
    const pal = (ev.theme?.palette || []).map(p => okHex(p.hex)); if(pal.length){ const sw = (W - 116) / pal.length; pal.forEach((h, i) => { x.fillStyle = h; x.fillRect(58 + i * sw, H - 58 - 22, sw + 1, 22); }); }
    const logo = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '/assets/brand/lockup-maroon.svg'; });
    if(logo){ const lh = 132, lw = lh * 1208 / 1066; x.drawImage(logo, (W - lw) / 2, H - 92 - lh, lw, lh); }
    else { x.fillStyle = '#682127'; x.font = '600 40px "Cormorant Garamond", Georgia, serif'; x.fillText('EKĀYA', W / 2, H - 130); }
    const blob = await E.toBlob(c, 0.95, 'image/png'), file = new File([blob], `${E.slug(ev.name)}-photo-wall-qr.png`, {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:`${ev.name} photo wall`}); return; }catch(e){ if(e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    E.toast('QR card saved. Print it for the tables.', 'download');
  }catch(e){ console.warn(e); E.toast('Couldn’t make the card. Try again.', 'warning'); }
}
async function act(a, el, ev){
  if(!ev) return;
  if(a === 'wall-create'){
    if(!S.canWrite) return; el.disabled = true;
    try{ const r = await api('', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title:ev.name, date:ev.date, palette:(ev.theme?.palette || []).map(c => c.hex)})});
      if(await E.save(Store.update(`events/${ev.id}`, {gallery:{id:r.id, key:r.key}}))){ P.id = r.id; P.data = {open:true, count:0, photos:[]}; P.err = null; P.at = Date.now(); E.toast('Photo wall ready. Download the QR card next.', 'qr_code_2'); } }
    catch(e){
      el.disabled = false;
      if(e.status === 401){ P.needSignIn = true; E.render(); E.toast('Sign in to your workspace to create a photo wall.', 'lock'); }
      else E.toast(!navigator.onLine || !e.status ? 'You’re offline. Connect to the internet to create the photo wall.' : (e.message || 'Couldn’t create the wall. Try again.'), 'warning');
    }
  }
  else if(a === 'wall-copy') E.copyText(guestUrl(ev.gallery.id));
  else if(a === 'wall-share') E.share({title:`${ev.name} photo wall`, text:`Add your photos from ${ev.name} and see everyone’s:`, url:guestUrl(ev.gallery.id)}, guestUrl(ev.gallery.id));
  else if(a === 'wall-card') card(ev);
  else if(a === 'wall-refresh'){ P.at = 0; load(ev); }
  else if(a === 'wall-toggle'){ const next = !(P.data ? P.data.open : true); try{ const m = await api(`/${ev.gallery.id}`, {method:'PATCH', headers:{'content-type':'application/json', 'x-admin-key':ev.gallery.key}, body:JSON.stringify({open:next})}); if(P.data) P.data.open = m.open; E.render(); E.toast(m.open ? 'Uploads opened' : 'Uploads closed', m.open ? 'lock_open' : 'lock'); }catch(e){ E.toast(e.message, 'warning'); } }
  else if(a === 'wall-upload'){ let inp = $('#wallPick'); if(!inp){ inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'wallPick'; inp.hidden = true; document.body.appendChild(inp); inp.addEventListener('change', () => { const e2 = E.curEv(); if(e2 && e2.gallery) upload(e2, inp.files).finally(() => { inp.value = ''; }); }); } inp.click(); }
  else if(a === 'photo') lightbox(ev, el.dataset.k);
}
E.photos = {view, tile, after, act, reset(){ clearInterval(P.timer); P.timer = null; P.id = null; P.data = null; P.at = 0; P.err = null; }};
})();
