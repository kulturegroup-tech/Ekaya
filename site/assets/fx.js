/* Ekaya motion: light catching foil under the cursor, a gentle tilt on cards, numbers that count up the first
   time they appear (and roll to a new value when it changes), and view transitions between tabs.
   Everything stands down for reduced motion. */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- foil glint and tilt (mouse and trackpad only; touch gets press feedback in CSS) ---------- */
let cur = null, raf = 0, last = null;
const clear = el => { if(!el) return; el.classList.remove('fx-on'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
function apply(){
  raf = 0; const e = last; if(!e) return;
  const el = e.target && e.target.closest ? e.target.closest('.fx') : null;
  if(cur !== el){ clear(cur); cur = el; }
  if(!el || !el.isConnected) return;
  const r = el.getBoundingClientRect(); if(!r.width) return;
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  if(el.classList.contains('fx-tilt') && !reduce.matches){ const k = Math.min(1, 560 / r.width); el.style.setProperty('--rx', ((0.5 - y) * 5 * k).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((x - 0.5) * 6 * k).toFixed(2) + 'deg'); }
  el.classList.add('fx-on');
}
document.addEventListener('pointermove', e => { if(e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; last = e; if(!raf) raf = requestAnimationFrame(apply); }, {passive:true});
document.documentElement.addEventListener('mouseleave', () => { clear(cur); cur = null; });
addEventListener('blur', () => { clear(cur); cur = null; });

/* ---------- numbers: count up on arrival, roll when they change ---------- */
const shown = new Map();
const fmt = (el, v) => el.dataset.fmt === 'inr' ? E.inr(Math.round(v)) : String(Math.round(v));
function roll(el, from, to){
  if(reduce.matches || from === to){ el.textContent = fmt(el, to); return; }
  const t0 = performance.now(), dur = from === 0 ? 950 : 650;
  el.textContent = fmt(el, from);
  const step = now => { if(!el.isConnected) return; const k = Math.min(1, (now - t0) / dur), e2 = 1 - Math.pow(1 - k, 3); el.textContent = fmt(el, from + (to - from) * e2); if(k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/* section cards across the app catch the light as well; long lists glint without lifting */
const AUTO = [['.ov-col > *, .theme-card, .empty.plain, .attn', ''], ['.money-hero, .list-card, .settle-eq, .sum.stock', 'fx-flat']];
function dress(root){
  AUTO.forEach(([sel, extra]) => root.querySelectorAll(sel).forEach(el => {
    if(el.classList.contains('fx') || el.closest('.vz, .sheet, .fx')) return;
    el.classList.add('fx'); if(extra) el.classList.add(extra);
    if(getComputedStyle(el, '::before').content === 'none') el.classList.add('fx-edge');
  }));
}
/** after each render: dress cards, animate numbers and mark tiles that are new on screen so their rings and bars fill in */
function after(root, entered){
  if(entered) shown.clear();
  dress(root);
  root.querySelectorAll('[data-count]').forEach(el => {
    const host = el.closest('[data-ck], .tile, .ev-card, section') || root, i = [...host.querySelectorAll('[data-count]')].indexOf(el);
    const key = (host.dataset.ck || host.className.split(' ').slice(0, 2).join('.')) + ':' + i;
    const to = +el.dataset.count; if(!isFinite(to)) return;
    const was = shown.get(key);
    if(was === undefined){ roll(el, 0, to); host.classList.add('fresh'); }
    else if(was !== to) roll(el, was, to);
    shown.set(key, to);
  });
}

/* ---------- view transitions between tabs, sub-tabs and events ---------- */
let inVT = false;
function nav(fn){
  if(!document.startViewTransition || reduce.matches || document.querySelector('.vz.full, .v3d') || document.body.classList.contains('sheet-open')){ fn(); return; }
  const html = document.documentElement; html.classList.add('vt');
  try{ const t = document.startViewTransition(() => { inVT = true; try{ fn(); E.render(); } finally { inVT = false; } }); t.finished.finally(() => html.classList.remove('vt')); }
  catch(e){ inVT = false; html.classList.remove('vt'); fn(); }
}

E.fx = {after, nav, reduce:() => reduce.matches, inVT:() => inVT};
})();
