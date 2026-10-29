// Ekaya invitations: a private link for each household to reply, and to see and pay their contri.
// The link carries a random token in the URL fragment; the server keeps only its hash.
// Guests never send an event or guest id: everything is resolved from the token.
//
// Organiser (signed-in device, Bearer session):
//   POST /api/invite/links    {ev, guests:[id]}          -> {tokens:{guestId: token}}  (a new link revokes the old one)
//   POST /api/invite/revoke   {ev, guests:[id]} | {ev, all:true}
//   GET  /api/invite/preview?ev=…                         -> the guest view with a sample household
// Guest (header x-invite: token):
//   GET  /api/invite/me                                   -> invitation, their reply and contri
//   POST /api/invite/reply    {rsvp, coming, meals, note}
//   POST /api/invite/claim    {amount, date, ref}         -> "I've paid", for Ekta to confirm
//   POST /api/invite/unclaim  {id}                        -> withdraw a claim Ekta hasn't confirmed
//
// Replies and claims are stored as workspace documents (events/{ev}/replies/{guest}, events/{ev}/claims/{guest}~{id})
// so the app picks them up with its normal sync. Ekta's own edits to a guest are never overwritten here.
import { dataStore, sha, token, workspace, session } from "../lib/auth.mjs";

const HEAD = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEAD });
const ID = /^[A-Za-z0-9_.:@+-]{1,80}$/;
const TOK = /^[A-Za-z0-9_-]{40,60}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RSVPS = ["going", "maybe", "no"];
const DEFAULT_FOOD = ["Veg", "Non-veg", "Jain"];
const KEEP_DAYS = 30;          // links stop working this many days after the event
const MAX_PEOPLE = 20;
const MAX_PENDING_CLAIMS = 5;

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const int = v => (Number.isFinite(+v) ? Math.round(+v) : NaN);
const sum = (a, f = x => +x.amount || 0) => a.reduce((t, x) => t + f(x), 0);

/* ---------- shared rules (kept in step with core.js: E.applyReply and E.stats) ---------- */
const contriOn = ev => ev && (ev.contri ?? (+ev.perHead > 0 || ev.type === "diwali" || ev.type === "party"));
const hasCustom = p => p.expected !== null && p.expected !== undefined && p.expected !== "";
const maxPeople = p => Math.max(1, Math.min(MAX_PEOPLE, +p.maxPeople || 1 + (+p.plusOnes || 0)));
/** a guest's reply applies unless Ekta has changed the record herself since; then her call stands and the reply waits for review */
export function applyReply(p, r) {
  if (!r || !r.rev) return { ...p };
  const fromReply = { rsvp: r.rsvp, plusOnes: r.rsvp === "no" ? +p.plusOnes || 0 : Math.max(0, (+r.coming || 1) - 1) };
  const ovr = p.ovr === null || p.ovr === undefined ? -1 : +p.ovr;
  if (ovr >= r.rev) return { ...p };
  if (ovr >= 0) {
    const same = fromReply.rsvp === p.rsvp && (r.rsvp === "no" || fromReply.plusOnes === (+p.plusOnes || 0));
    return same ? { ...p } : { ...p, review: true };
  }
  return { ...p, ...fromReply };
}

/* ---------- storage ---------- */
const docKey = path => `doc/${path}`;
const getDoc = (s, path) => s.get(docKey(path), { type: "json" });
async function readCol(s, col, prefix = "") {
  const base = `doc/${col}/`;
  const { blobs } = await s.list({ prefix: base + prefix, directories: true });
  const keys = blobs.map(b => b.key).filter(k => !k.slice(base.length).includes("/"));
  const out = [];
  for (let i = 0; i < keys.length; i += 16) {
    const part = await Promise.all(keys.slice(i, i + 16).map(async k => { const d = await s.get(k, { type: "json" }); return d ? { id: k.slice(base.length), ...d } : null; }));
    out.push(...part.filter(Boolean));
  }
  return out;
}
/** counts requests in a fixed window; true when over the limit */
async function limited(s, key, max, windowMs) {
  const k = `inv/rl/${key}`, now = Date.now();
  const cur = (await s.get(k, { type: "json" })) || { n: 0, at: now };
  const fresh = now - cur.at > windowMs;
  const next = fresh ? { n: 1, at: now } : { n: cur.n + 1, at: cur.at };
  await s.setJSON(k, next);
  return next.n > max;
}

/* ---------- what a guest may see ---------- */
function publicEvent(ev, owner) {
  const inv = ev.invite || {};
  const pal = ((ev.theme && ev.theme.palette) || []).map(c => ({ hex: /^#[0-9a-fA-F]{6}$/.test(c && c.hex) ? c.hex : null })).filter(c => c.hex).slice(0, 8);
  return {
    id: ev.id, name: clean(ev.name, 80), type: ev.type || "party", date: DAY.test(ev.date || "") ? ev.date : "", time: /^\d{1,2}:\d{2}$/.test(ev.time || "") ? ev.time : "",
    venue: clean(ev.venue, 120), map: /^https:\/\/[^\s]{4,300}$/.test(inv.map || "") ? inv.map : "",
    dress: clean(ev.theme && ev.theme.dress, 80), theme: { name: clean(ev.theme && ev.theme.name, 40), palette: pal },
    note: String(inv.note || "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, 600),
    host: clean(inv.host || owner || "Ekaya", 40), hostPhone: String(inv.phone || "").replace(/[^\d+]/g, "").slice(0, 16),
    cover: ev.cover && ev.cover.img && /^[A-Za-z0-9]{12,32}$/.test(ev.cover.img) ? { img: ev.cover.img } : null,
    stock: ev.cover && ev.cover.stock ? String(ev.cover.stock).slice(0, 12) : "",
    gallery: ev.gallery && ev.gallery.id ? ev.gallery.id : "",
    rsvpBy: DAY.test(inv.rsvpBy || "") ? inv.rsvpBy : ""
  };
}
const foodOptions = ev => { const f = ev.invite && ev.invite.food; return Array.isArray(f) ? f.map(x => clean(x, 20)).filter(Boolean).slice(0, 6) : DEFAULT_FOOD; };
const repliesOpen = ev => { const t = istToday(), by = ev.invite && ev.invite.rsvpBy; return !(ev.date && t > ev.date) && !(by && DAY.test(by) && t > by); };

function household(p, reply) {
  const eff = applyReply(p, reply), max = maxPeople(p);
  const status = ["going", "maybe", "no", "invited"].includes(eff.rsvp) ? eff.rsvp : "invited";
  return {
    name: clean(p.name, 60), max,
    status, coming: status === "no" ? 0 : Math.min(max, 1 + (+eff.plusOnes || 0)),
    reply: reply && reply.rev ? { rsvp: reply.rsvp, coming: reply.coming, meals: reply.meals || {}, note: reply.note || "", at: reply.at } : null,
    review: !!eff.review
  };
}

async function contri(s, ev, p, reply, owner) {
  if (!contriOn(ev)) return null;
  const evId = ev.id, eff = applyReply(p, reply);
  const [payments, expenses, claims] = await Promise.all([
    readCol(s, `events/${evId}/payments`),
    readCol(s, `events/${evId}/expenses`),
    readCol(s, `events/${evId}/claims`, `${p.id}~`)
  ]);
  const mine = payments.filter(x => x.guestId === p.id);
  const receipts = (Array.isArray(p.payments) ? p.payments : []).concat(mine);
  const per = +ev.perHead || 0, people = 1 + (+eff.plusOnes || 0), custom = hasCustom(p);
  const base = custom ? +p.expected || 0 : per * people, share = p.waived ? 0 : base;
  const paid = sum(receipts) + sum(expenses.filter(x => x.paidBy === p.id));
  const confirmed = new Set(mine.map(x => x.claim).filter(Boolean));
  const list = claims.map(c => ({ id: c.id, amount: +c.amount || 0, date: c.date || "", ref: c.ref || "", at: c.at || 0,
    status: confirmed.has(c.id) || c.status === "confirmed" ? "confirmed" : c.status === "declined" ? "declined" : "pending" }))
    .sort((a, b) => b.at - a.at).slice(0, 12);
  const awaiting = sum(list.filter(c => c.status === "pending"));
  return {
    per, people, custom, waived: !!p.waived, share, paid, due: Math.max(0, share - paid), awaiting, claims: list,
    upi: ev.upi ? { id: clean(ev.upi, 80), name: clean(ev.upiName || (ev.invite && ev.invite.host) || owner || "", 40) } : null
  };
}

async function view(s, ev, p, reply, owner) {
  return {
    event: publicEvent(ev, owner), household: household(p, reply), food: foodOptions(ev), open: repliesOpen(ev),
    money: await contri(s, ev, p, reply, owner), today: istToday()
  };
}

/* ---------- resolving a guest's link ---------- */
async function resolve(s, req) {
  const t = (req.headers.get("x-invite") || "").trim();
  if (!TOK.test(t)) return { error: json({ error: "This invitation link isn’t complete. Open it again from the WhatsApp message." }, 400) };
  const hash = await sha(t);
  const rec = await s.get(`inv/k/${hash}`, { type: "json" });
  if (!rec) return { error: json({ error: "This invitation link isn’t active any more. Ask the host for a new one.", gone: true }, 404) };
  const [ev, p] = await Promise.all([getDoc(s, `events/${rec.ev}`), getDoc(s, `events/${rec.ev}/people/${rec.guest}`)]);
  if (!ev || !p) return { error: json({ error: "This invitation link isn’t active any more. Ask the host for a new one.", gone: true }, 404) };
  if (ev.date && DAY.test(ev.date) && istToday() > addDays(ev.date, KEEP_DAYS)) return { error: json({ error: "This celebration has ended, so its invitation link has closed.", gone: true }, 410) };
  return { hash, ev: { ...ev, id: rec.ev }, p: { ...p, id: rec.guest } };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/invite\/?/, "").split("/")[0];
  const s = dataStore();
  const body = async () => (req.headers.get("content-type") || "").includes("json") ? req.json().catch(() => ({})) : {};
  try {
    const meta = await workspace(s);
    if (!meta) return json({ error: "Invitations aren’t set up here." }, 404);
    const owner = meta.owner || "";
    const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "";
    const ipKey = ip ? "ip-" + (await sha(ip)).slice(0, 24) : "";

    /* ---------- organiser ---------- */
    if (["links", "revoke", "preview"].includes(route)) {
      if (!(await session(req, s))) return json({ error: "Please sign in again." }, 401);
      if (route === "preview" && req.method === "GET") {
        const evId = url.searchParams.get("ev") || "";
        if (!ID.test(evId)) return json({ error: "Bad event" }, 400);
        const ev = await getDoc(s, `events/${evId}`);
        if (!ev) return json({ error: "That event doesn’t exist." }, 404);
        const sample = { id: "preview", name: "The Sharma family", plusOnes: 3, maxPeople: 4, rsvp: "invited", expected: null };
        const out = await view(s, { ...ev, id: evId }, sample, null, owner);
        return json({ ...out, preview: true });
      }
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const b = await body();
      const evId = String(b.ev || "");
      if (!ID.test(evId) || !(await getDoc(s, `events/${evId}`))) return json({ error: "That event doesn’t exist." }, 404);
      if (route === "links") {
        const guests = (Array.isArray(b.guests) ? b.guests : []).map(String).filter(x => ID.test(x)).slice(0, 100);
        const tokens = {};
        for (const g of guests) {
          if (!(await getDoc(s, `events/${evId}/people/${g}`))) continue;
          const idx = `inv/g/${evId}/${g}`, old = await s.get(idx, { type: "json" });
          if (old && old.hash) await s.delete(`inv/k/${old.hash}`);
          const t = token(32), hash = await sha(t);
          await s.setJSON(`inv/k/${hash}`, { ev: evId, guest: g, at: Date.now() });
          await s.setJSON(idx, { hash, at: Date.now() });
          tokens[g] = t;
        }
        return json({ tokens });
      }
      // revoke
      let idxs;
      if (b.all === true) idxs = (await s.list({ prefix: `inv/g/${evId}/` })).blobs.map(x => x.key);
      else idxs = (Array.isArray(b.guests) ? b.guests : []).map(String).filter(x => ID.test(x)).slice(0, 200).map(g => `inv/g/${evId}/${g}`);
      let n = 0;
      for (const idx of idxs) {
        const old = await s.get(idx, { type: "json" });
        if (old && old.hash) { await s.delete(`inv/k/${old.hash}`); n++; }
        await s.delete(idx);
      }
      return json({ revoked: n });
    }

    /* ---------- guest ---------- */
    if (!["me", "reply", "claim", "unclaim"].includes(route)) return json({ error: "Not found" }, 404);
    const r = await resolve(s, req);
    if (r.error) return r.error;
    const { hash, ev, p } = r;
    const replyPath = `events/${ev.id}/replies/${p.id}`;

    if (route === "me" && req.method === "GET") {
      if (await limited(s, `r-${hash.slice(0, 32)}`, 40, 60e3)) return json({ error: "Too many requests. Wait a minute and try again." }, 429);
      return json(await view(s, ev, p, await getDoc(s, replyPath), owner));
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    // writes: a few a minute per household, and a ceiling per network so a forwarded link can't flood the list
    if (await limited(s, `w-${hash.slice(0, 32)}`, 6, 60e3)) return json({ error: "That’s a lot of changes at once. Wait a minute and try again." }, 429);
    if (await limited(s, `d-${hash.slice(0, 32)}`, 60, 864e5)) return json({ error: "This invitation has had too many changes today. Message the host instead." }, 429);
    if (ipKey && (await limited(s, ipKey, 60, 10 * 60e3))) return json({ error: "Too many requests from this network. Wait a few minutes and try again." }, 429);
    const b = await body();

    if (route === "reply") {
      if (!repliesOpen(ev)) return json({ error: "Replies have closed for this celebration. Message the host to change yours." }, 403);
      const rsvp = String(b.rsvp || "");
      if (!RSVPS.includes(rsvp)) return json({ error: "Choose Coming, Maybe or Can’t make it." }, 400);
      const max = maxPeople(p);
      let coming = rsvp === "no" ? 0 : int(b.coming);
      if (rsvp !== "no" && !(coming >= 1 && coming <= max)) return json({ error: `Choose between 1 and ${max} ${max === 1 ? "person" : "people"}.` }, 400);
      const opts = foodOptions(ev), meals = {};
      if (rsvp !== "no" && b.meals && typeof b.meals === "object") {
        for (const [k, v] of Object.entries(b.meals)) { const n = int(v); if (opts.includes(k) && n > 0) meals[k] = Math.min(n, coming); }
        if (sum(Object.values(meals), x => x) > coming) return json({ error: "The food counts add up to more people than are coming." }, 400);
      }
      const note = clean(b.note, 200);
      const key = docKey(replyPath);
      for (let tries = 0; tries < 4; tries++) {
        const cur = await s.getWithMetadata(key, { type: "json" });
        const prev = cur && cur.data;
        const rev = ((prev && +prev.rev) || 0) + 1;
        const history = [...((prev && prev.history) || []), ...(prev ? [{ rsvp: prev.rsvp, coming: prev.coming, at: prev.at }] : [])].slice(-6);
        const doc = { guestId: p.id, rsvp, coming, meals, note, at: Date.now(), rev, history };
        const res = await s.setJSON(key, doc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
        if (!res || res.modified !== false) return json(await view(s, ev, p, doc, owner));
      }
      return json({ error: "Couldn’t save your reply just now. Try again." }, 503);
    }

    if (route === "claim") {
      if (!contriOn(ev)) return json({ error: "This celebration doesn’t collect contributions." }, 400);
      const amount = int(b.amount);
      if (!(amount >= 1 && amount <= 500000)) return json({ error: "Enter the amount you paid." }, 400);
      const today = istToday(), date = DAY.test(b.date || "") ? b.date : today;
      if (date > addDays(today, 1) || date < addDays(today, -120)) return json({ error: "Check the payment date." }, 400);
      const mine = await readCol(s, `events/${ev.id}/claims`, `${p.id}~`);
      if (mine.filter(c => c.status !== "confirmed" && c.status !== "declined").length >= MAX_PENDING_CLAIMS) return json({ error: "The host still has to check your earlier payments. Message them if it’s urgent." }, 429);
      const id = `${p.id}~${Date.now().toString(36)}${hash.slice(0, 2)}${Math.random().toString(36).slice(2, 6)}`;
      await s.setJSON(docKey(`events/${ev.id}/claims/${id}`), { guestId: p.id, amount, date, ref: clean(b.ref, 40), at: Date.now(), status: "pending" }, { onlyIfNew: true });
      return json(await view(s, ev, p, await getDoc(s, replyPath), owner), 201);
    }

    if (route === "unclaim") {
      const id = String(b.id || "");
      if (!id.startsWith(`${p.id}~`) || !ID.test(id.replace("~", "-"))) return json({ error: "Not found" }, 404);
      const key = docKey(`events/${ev.id}/claims/${id}`);
      const cur = await s.getWithMetadata(key, { type: "json" });
      if (!cur) return json({ error: "Not found" }, 404);
      if (cur.data.status === "confirmed" || cur.data.status === "declined" || (await getDoc(s, `events/${ev.id}/payments/rc${id}`))) return json({ error: "The host has already checked this payment." }, 409);
      await s.delete(key);
      return json(await view(s, ev, p, await getDoc(s, replyPath), owner));
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: ["/api/invite", "/api/invite/*"] };
