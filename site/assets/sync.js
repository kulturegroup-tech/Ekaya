/* Ekaya sync: offline-first store backed by /api/data. Local cache + outbox; polls for changes from other devices. */
(() => {
'use strict';
const CK = 'ekaya-remote-v1', OK = 'ekaya-outbox-v1', TK = 'ekaya-token', OWN = 'ekaya-owner';
const ls = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
let cache = {docs:{}, etags:{}}, outbox = [];
const listeners = new Map();
const state = {online:true, syncing:false, lastSync:0, pending:0};
let timer = null, flushing = false, retryT = null, syncQueued = false, saveT = null, running = false;
const colOf = p => { const a = p.split('/'); return [a.slice(0, -1).join('/'), a[a.length - 1]]; };
const clone = o => JSON.parse(JSON.stringify(o));
const merge = (a, b) => { const o = {...a}; for(const k in b){ const v = b[k]; o[k] = (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], v) : v; } return o; };

function load(){
  try{ cache = JSON.parse(ls.get(CK) || 'null') || {docs:{}, etags:{}}; }catch(e){ cache = {docs:{}, etags:{}}; }
  cache.docs ||= {}; cache.etags ||= {}; cache.seen ||= {};
  try{ outbox = JSON.parse(ls.get(OK) || '[]') || []; }catch(e){ outbox = []; }
  outbox.forEach(o => { o.inflight = false; });
}
function persist(){ clearTimeout(saveT); saveT = setTimeout(() => { if(!ls.set(CK, JSON.stringify(cache))) console.warn('Ekaya: local cache is full'); }, 250); }
const persistOutbox = () => ls.set(OK, JSON.stringify(outbox));
const rows = col => Object.entries(cache.docs[col] || {}).map(([id, d]) => ({id, ...d}));
function emit(col){ const set = listeners.get(col); if(!set) return; const r = rows(col); set.forEach(cb => queueMicrotask(() => cb(r))); }
function setState(p){ Object.assign(state, p || {}); state.pending = outbox.length; E.onSyncState && E.onSyncState({...state}); }
const token = () => ls.get(TK);
const device = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Browser'; };

async function api(path, opts={}){
  const headers = Object.assign({}, opts.headers || {}); const t = token(); if(t) headers.authorization = 'Bearer ' + t;
  let body = opts.body; if(opts.json !== undefined){ headers['content-type'] = 'application/json'; body = JSON.stringify(opts.json); }
  const r = await fetch('/api/data/' + path, {method:opts.method || 'GET', headers, body});
  const data = await r.json().catch(() => ({}));
  if(r.status === 401 && t && path !== 'login' && path !== 'passcode') authLost();
  return {ok:r.ok, status:r.status, data};
}
function authLost(){ ls.del(TK); stop(); E.onAuthLost && E.onAuthLost(); }

/* ---------- writes (optimistic) ---------- */
function localPut(path, data){ const [c, id] = colOf(path); (cache.docs[c] ||= {})[id] = clone(data); cache.seen[c] ||= 1; emit(c); persist(); }
function localDel(path){ const [c, id] = colOf(path); if(cache.docs[c]) delete cache.docs[c][id]; delete cache.etags[path]; emit(c); persist(); }
function enqueue(op){
  if(op.op !== 'patch') outbox = outbox.filter(o => o.path !== op.path || o.inflight);
  outbox.push(op); persistOutbox(); touch(); setState(); flush();
}
async function flush(){
  if(flushing || !token() || !running) return;
  flushing = true;
  try{
    while(outbox.length){
      const op = outbox[0]; op.inflight = true;
      const [c, id] = colOf(op.path), url = 'doc?path=' + encodeURIComponent(op.path);
      let res;
      try{
        if(op.op === 'del') res = await api(url, {method:'DELETE'});
        else {
          const doc = cache.docs[c]?.[id];
          if(!doc){ outbox.shift(); persistOutbox(); continue; }
          const ifMatch = op.op === 'patch' ? cache.etags[op.path] : undefined;
          res = await api(url, {method:'PUT', json:{data:doc, ifMatch}});
          for(let tries = 0; res.status === 409 && tries < 3; tries++){
            let merged = merge((res.data && res.data.data) || {}, op.patch || {});
            outbox.slice(1).filter(o => o.path === op.path && o.patch).forEach(o => { merged = merge(merged, o.patch); });
            (cache.docs[c] ||= {})[id] = merged; emit(c);
            res = await api(url, {method:'PUT', json:{data:merged, ifMatch:(res.data && res.data.etag) || undefined}});
          }
        }
      }catch(e){ op.inflight = false; setState({online:false}); retry(); break; }
      if(res.status === 401){ op.inflight = false; break; }
      if(res.status >= 500){ op.inflight = false; setState({online:false}); retry(); break; }
      if(res.ok && res.data && res.data.etag) cache.etags[op.path] = res.data.etag;
      if(!res.ok && E.toast) E.toast((res.data && res.data.error) || 'One change couldn’t be saved.', 'warning');
      outbox.shift(); persistOutbox(); persist(); setState({online:true});
    }
  } finally { flushing = false; setState(); }
}
function retry(){ clearTimeout(retryT); retryT = setTimeout(flush, 6000); }

/* ---------- reads (polling) ---------- */
let warmCols = [], warmAt = 0, warming = false, polled = 0, active = Date.now();
const touch = () => { active = Date.now(); };
['pointerdown','keydown'].forEach(t => addEventListener(t, touch, {passive:true, capture:true}));
async function pull(cols){
  const pend = new Set(outbox.map(o => o.path)), body = {cols:{}};
  cols.forEach(c => { const known = {}; Object.keys(cache.docs[c] || {}).forEach(id => { const p = `${c}/${id}`; if(!pend.has(p)) known[id] = cache.etags[p] || '-'; }); body.cols[c] = known; });
  const r = await api('sync', {method:'POST', json:body});
  if(!r.ok){ const err = new Error('sync ' + r.status); err.status = r.status; throw err; }
  const pendNow = new Set(outbox.map(o => o.path));
  Object.entries(r.data.cols || {}).forEach(([c, res]) => {
    let changed = false; const bucket = (cache.docs[c] ||= {});
    (res.docs || []).forEach(d => { const p = `${c}/${d.id}`; if(pendNow.has(p)) return; bucket[d.id] = d.data; cache.etags[p] = d.etag; changed = true; });
    (res.removed || []).forEach(id => { const p = `${c}/${id}`; if(pendNow.has(p)) return; if(bucket[id]){ delete bucket[id]; delete cache.etags[p]; changed = true; } });
    if(changed || !cache.seen[c]){ if(changed) touch(); cache.seen[c] = 1; emit(c); }
  });
  persist();
}
const chunks = (a, n) => { const o = []; for(let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function sync(){
  syncQueued = false; polled = Date.now();
  if(!token() || !running || state.syncing) return;
  const cols = [...listeners.entries()].filter(([, s]) => s.size).map(([c]) => c);
  if(!cols.length) return;
  setState({syncing:true});
  try{ for(const part of chunks(cols, 16)) await pull(part); setState({online:true, lastSync:Date.now()}); }
  catch(e){ if(!e.status || e.status >= 500) setState({online:false}); release(cols); }
  finally{ setState({syncing:false}); }
  if(Date.now() - warmAt > 120000) warm();
}
/* keep every event's details on the device, so a venue with no signal still has the full guest list */
async function warm(){
  if(warming || !token() || !running || !navigator.onLine) return;
  const live = new Set([...listeners.entries()].filter(([, s]) => s.size).map(([c]) => c));
  const cols = warmCols.filter(c => !live.has(c));
  warmAt = Date.now(); if(!cols.length) return;
  warming = true;
  try{ for(const part of chunks(cols, 16)) await pull(part); }catch(e){}
  finally{ warming = false; }
}
/* if the first download fails, show what we have rather than a spinner forever */
function release(cols){ cols.forEach(c => { if(!cache.seen[c]){ cache.seen[c] = 1; emit(c); } }); }
function queueSync(){ if(syncQueued) return; syncQueued = true; setTimeout(sync, 60); }
function stop(){ running = false; clearInterval(timer); timer = null; }
document.addEventListener('visibilitychange', () => { if(running && document.visibilityState === 'visible'){ flush(); queueSync(); } });
window.addEventListener('online', () => { if(running){ setState({online:true}); flush(); queueSync(); } });
window.addEventListener('offline', () => { if(running) setState({online:false}); });

E.Remote = {
  token, device, state:() => ({...state}), owner:() => ls.get(OWN) || '',
  start(){
    load(); running = true; clearInterval(timer);
    // poll every 10 s while someone is working, every 30 s when the app sits idle; always on focus
    timer = setInterval(() => {
      if(document.visibilityState !== 'visible') return;
      const now = Date.now(), gap = now - active < 120000 ? 10000 : 30000;
      if(now - polled >= gap){ polled = now; flush(); sync(); }
    }, 2500);
    setState(); flush();
  },
  stop,
  syncNow(){ flush(); return sync(); },
  warm(cols){ const next = [...new Set(cols)].sort(); if(next.join() === warmCols.join()) return; warmCols = next; warmAt = 0; setTimeout(warm, 1500); },
  subscribe(col, cb){
    if(!listeners.has(col)) listeners.set(col, new Set()); listeners.get(col).add(cb);
    if(cache.seen[col] || cache.docs[col]) queueMicrotask(() => cb(rows(col)));
    if(!navigator.onLine) release([col]);
    queueSync(); return () => listeners.get(col)?.delete(cb);
  },
  set(path, data){ localPut(path, data); enqueue({op:'put', path}); return Promise.resolve(); },
  update(path, patch){
    const [c, id] = colOf(path), base = cache.docs[c]?.[id];
    if(!base) return Promise.reject(Object.assign(new Error('missing'), {code:'invalid_argument'}));
    localPut(path, merge(base, clone(patch))); enqueue({op:'patch', path, patch:clone(patch)}); return Promise.resolve();
  },
  remove(path){ localDel(path); enqueue({op:'del', path}); return Promise.resolve(); },
  async status(){ const r = await fetch('/api/data/status', {cache:'no-store'}); if(!r.ok) throw new Error('unavailable'); return r.json(); },
  async setup(owner, passcode){ const r = await api('setup', {method:'POST', json:{owner, passcode, device:device()}}); if(!r.ok) throw new Error(r.data.error || 'Couldn’t set up the workspace.'); ls.set(TK, r.data.token); ls.set(OWN, r.data.owner || owner); },
  async login(passcode){ const r = await api('login', {method:'POST', json:{passcode, device:device()}}); if(!r.ok) throw new Error(r.data.error || 'Couldn’t sign in.'); ls.set(TK, r.data.token); ls.set(OWN, r.data.owner || ''); },
  async changePasscode(current, next){ const r = await api('passcode', {method:'POST', json:{current, next}}); if(!r.ok) throw new Error(r.data.error || 'Couldn’t change the passcode.'); return r.data; },
  async logout(){ try{ await api('logout', {method:'POST'}); }catch(e){} stop(); ls.del(TK); ls.del(CK); ls.del(OK); cache = {docs:{}, etags:{}, seen:{}}; outbox = []; listeners.clear(); warmCols = []; setState({pending:0}); },
  async uploadImage(blob){ const r = await api('img', {method:'POST', body:blob, headers:{'content-type':blob.type || 'image/jpeg'}}); if(!r.ok) throw new Error(r.data.error || 'Upload failed.'); return r.data.id; },
  async importDocs(docs){ let n = 0; for(let i = 0; i < docs.length; i += 40){ const r = await api('import', {method:'POST', json:{docs:docs.slice(i, i + 40)}}); if(!r.ok) throw new Error(r.data.error || 'Upload failed.'); n += r.data.imported || 0; } return n; },
  authHeader(){ const t = token(); return t ? {authorization:'Bearer ' + t} : {}; }
};
})();
