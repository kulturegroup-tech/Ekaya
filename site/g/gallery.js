/* Ekaya photo wall — guest page. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (n, cls='') => `<svg class="ms ${cls}" aria-hidden="true"><use href="/assets/icons.svg#${n}"/></svg>`;
const id = new URLSearchParams(location.search).get('e') || '';
const NAME_KEY = 'ekaya-guest-name';
let data = null, busy = false, lbIndex = -1, timer = null;

try{ const t = localStorage.getItem('ekaya-theme'); if(t && t !== 'auto') document.documentElement.setAttribute('data-theme', t); }catch(e){}
let toastT; const toast = (m, ic='check_circle') => { const s = $('#snack'); s.innerHTML = `${icon(ic, 'sm')}<span>${esc(m)}</span>`; s.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => s.classList.remove('show'), 3200); };
const fmtDate = s => { if(!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long', year:'numeric'}); };
const thumb = k => `/api/gallery/${id}/photos/${k}?s=t`, full = k => `/api/gallery/${id}/photos/${k}`;
const getName = () => { try{ return localStorage.getItem(NAME_KEY) || ''; }catch(e){ return ''; } };

async function load(){
  try{
    const r = await fetch(`/api/gallery/${encodeURIComponent(id)}`); const j = await r.json().catch(() => ({}));
    if(!r.ok){ notFound(j.error); return; }
    const first = !data; data = j; if(first || !$('#g-gal')) render(); else refreshParts();
  }catch(e){ if(!data) notFound('Couldn’t reach the gallery. Check your connection and try again.'); }
}
function notFound(msg){
  $('#g').innerHTML = `<section class="g-head glass foil"><span class="eyebrow gold">Photo wall</span><h1 class="display">Hmm, <em>no gallery</em> here</h1><p class="sub">${esc(msg || 'This link may be incomplete. Scan the QR code again.')}</p><span class="g-brand">ekaya</span></section>`;
}
function render(){
  const pal = (data.palette || []);
  const up = $('#g-up-name') ? $('#g-up-name').value : getName();
  $('#g').innerHTML = `<section class="g-head glass foil"><span class="eyebrow gold">Photo wall</span><h1 class="display">${esc(data.title)}</h1>${data.date ? `<p class="sub">${esc(fmtDate(data.date))}</p>` : ''}<span class="tag gold" id="g-count">${icon('photo_library')}${data.count} ${data.count === 1 ? 'photo' : 'photos'}</span>${pal.length ? `<div class="strip">${pal.map(h => `<i style="--c:${esc(h)}"></i>`).join('')}</div>` : ''}</section>
    ${data.open ? `<section class="g-up glass"><label class="field"><span>Your name (optional)</span><input class="input" id="g-up-name" maxlength="30" placeholder="So people know who took it" value="${esc(up)}" autocomplete="name"></label>
      <button class="btn gold" id="g-add" type="button">${icon('add_photo_alternate')}Add your photos</button><div class="g-prog" id="g-prog"></div><p class="hint-s">Photos are shared with everyone who has this link.</p></section>`
      : `<section class="g-up glass"><p class="sub">${icon('lock', 'sm')} Uploads are closed. You can still browse and save every photo.</p></section>`}
    <div class="section-label"><span class="eyebrow">Gallery</span></div>
    <div id="g-gal">${galHtml()}</div>
    <p class="hint-s" style="text-align:center;margin-top:12px"><span class="g-brand" style="font-size:18px">ekaya</span></p>`;
  $('#g-add')?.addEventListener('click', () => $('#gPick').click());
  $('#g-up-name')?.addEventListener('change', e => { try{ localStorage.setItem(NAME_KEY, e.target.value.trim()); }catch(x){} });
}
function galHtml(){
  return data.photos.length ? `<div class="g-grid">${data.photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="Open photo ${i + 1}"><img src="${esc(thumb(p.k))}" alt="" loading="lazy"></button>`).join('')}</div>`
    : `<section class="empty glass"><span class="empty-ic">${icon('photo_camera')}</span><h3>Be the first</h3><p>No photos yet. Add yours and they’ll show up here for everyone.</p></section>`;
}
let lastSig = '';
function refreshParts(){
  const sig = data.photos.map(p => p.k).join(',') + data.open;
  if(sig === lastSig) return; lastSig = sig;
  if(!!$('#g-add') !== !!data.open){ render(); return; }
  $('#g-count').innerHTML = `${icon('photo_library')}${data.count} ${data.count === 1 ? 'photo' : 'photos'}`;
  $('#g-gal').innerHTML = galHtml();
}
function scaled(file, max){
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('That image couldn’t be read. Try a JPG or PNG.')); }; im.src = u; });
}
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function uploadAll(files){
  files = [...files].filter(f => f.type.startsWith('image/')); if(!files.length || busy) return;
  busy = true; const name = ($('#g-up-name')?.value || '').trim(); try{ localStorage.setItem(NAME_KEY, name); }catch(e){}
  const prog = $('#g-prog'); let ok = 0;
  for(let i = 0; i < files.length; i++){
    if(prog) prog.innerHTML = `<div class="row-sub">${icon('upload', 'sm')} Uploading ${i + 1} of ${files.length}…</div><div class="lin"><i style="--p:${Math.round(i / files.length * 100)}"></i></div>`;
    try{
      let big = await toBlob(await scaled(files[i], 2048), 0.85); if(big.size > 3.8e6) big = await toBlob(await scaled(files[i], 1600), 0.8);
      const small = await toBlob(await scaled(files[i], 480), 0.78);
      const fd = new FormData(); fd.append('full', big, 'photo.jpg'); fd.append('thumb', small, 'thumb.jpg'); fd.append('name', name);
      const r = await fetch(`/api/gallery/${encodeURIComponent(id)}/photos`, {method:'POST', body:fd}); const j = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(j.error || 'Upload failed. Try again.');
      ok++;
    }catch(e){ toast(e.message || 'Upload failed. Try again.', 'warning'); }
  }
  busy = false;
  if(prog) prog.innerHTML = '';
  if(ok){ toast(ok === 1 ? 'Your photo is on the wall. Thank you!' : `${ok} photos added. Thank you!`, 'favorite'); await load(); }
}
$('#gPick').addEventListener('change', e => { uploadAll(e.target.files).finally(() => { e.target.value = ''; }); });

/* lightbox */
function openLb(i){
  lbIndex = i; const p = data.photos[i]; if(!p) return;
  let lb = $('.lb'); if(!lb){ lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Photo'); document.body.appendChild(lb); document.body.classList.add('sheet-open'); bindLb(lb); }
  lb.innerHTML = `<div class="lb-top"><button class="icon-btn" data-x="close" aria-label="Close">${icon('close')}</button><span class="lb-meta" id="lb-meta">${i + 1} of ${data.photos.length}</span><span style="width:42px"></span></div>
    <div class="lb-img"><img src="${esc(full(p.k))}" alt="Photo ${i + 1}"></div>
    <div class="lb-foot"><button class="icon-btn" data-x="prev" aria-label="Previous" ${i === 0 ? 'disabled' : ''}>${icon('chevron_left')}</button><a class="btn" href="${esc(full(p.k))}?dl=1" download>${icon('download')}Save</a>${navigator.share ? `<button class="btn" data-x="share">${icon('ios_share')}Share</button>` : ''}<button class="icon-btn" data-x="next" aria-label="Next" ${i >= data.photos.length - 1 ? 'disabled' : ''}>${icon('chevron_right')}</button></div>`;
  fetch(`${full(p.k)}?meta=1`).then(r => r.json()).then(m => { const el = $('#lb-meta'); if(el && lbIndex === i && m.n) el.textContent = `${m.n} · ${i + 1} of ${data.photos.length}`; }).catch(() => {});
}
function closeLb(){ $('.lb')?.remove(); document.body.classList.remove('sheet-open'); lbIndex = -1; }
function bindLb(lb){
  lb.addEventListener('click', async e => {
    const b = e.target.closest('[data-x]'); if(!b) return; const x = b.dataset.x;
    if(x === 'close') closeLb(); else if(x === 'prev') openLb(Math.max(0, lbIndex - 1)); else if(x === 'next') openLb(Math.min(data.photos.length - 1, lbIndex + 1));
    else if(x === 'share'){ try{ const r = await fetch(full(data.photos[lbIndex].k)); const blob = await r.blob(); const file = new File([blob], 'photo.jpg', {type:blob.type || 'image/jpeg'}); if(navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({files:[file], title:data.title}); else await navigator.share({title:data.title, url:location.href}); }catch(err){} }
  });
  let sx = null;
  lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
  lb.addEventListener('touchend', e => { if(sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 50) openLb(Math.max(0, Math.min(data.photos.length - 1, lbIndex + (dx < 0 ? 1 : -1)))); });
}
document.addEventListener('click', e => { const t = e.target.closest('.g-grid [data-i]'); if(t) openLb(+t.dataset.i); });
document.addEventListener('keydown', e => { if(lbIndex < 0) return; if(e.key === 'Escape') closeLb(); if(e.key === 'ArrowRight') openLb(Math.min(data.photos.length - 1, lbIndex + 1)); if(e.key === 'ArrowLeft') openLb(Math.max(0, lbIndex - 1)); });

if(!/^[A-Za-z0-9]{8,24}$/.test(id)) notFound();
else { load(); timer = setInterval(() => { if(document.visibilityState === 'visible' && !busy && lbIndex < 0) load(); }, 20000); }
})();
