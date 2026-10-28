// Ekaya workspace API — shared, passcode-protected document store on Netlify Blobs.
//   GET    /api/data/status                 {setup, owner}
//   POST   /api/data/setup     {owner, passcode}         -> {token}   (first time only)
//   POST   /api/data/login     {passcode, device}        -> {token, owner}
//   POST   /api/data/logout                              (auth)
//   POST   /api/data/passcode  {current, next}           (auth) changes it and signs out other devices
//   POST   /api/data/sync      {cols: {path: {id: etag}}} (auth) -> changed docs + removed ids per collection
//   PUT    /api/data/doc?path=…  {data, ifMatch?}        (auth) -> {etag} or 409 {etag, data}
//   DELETE /api/data/doc?path=…                          (auth)
//   POST   /api/data/import    {docs: [{path, data}]}    (auth) bulk upload from a device (adds only missing docs)
//   POST   /api/data/img       (image body)              (auth) -> {id}
//   GET    /api/data/img/:id                             public, immutable
import { dataStore, json, sha, rid, hashPass, sameHex, workspace, newSession, session } from "../lib/auth.mjs";

const SEG = /^[A-Za-z0-9_.:@+~-]{1,120}$/;
const okPath = (p, even) => {
  if (typeof p !== "string" || p.length > 600) return false;
  const a = p.split("/");
  return a.length <= 15 && a.every(x => SEG.test(x) && x !== "." && x !== "..") && a[0] === "events" && (a.length % 2 === 0) === even;
};
const IMG = /^image\/(jpeg|png|webp)$/;
const MAX_DOC = 900_000;
// list() and header etags can differ in quoting; compare them loosely
const norm = e => String(e || "").replace(/^W\//, "").replace(/"/g, "");

async function rateLimited(s, ip) {
  if (!ip) return false;
  const key = `ws/fail/${(await sha(ip)).slice(0, 32)}`;
  const f = await s.get(key, { type: "json" });
  return !!(f && f.count >= 8 && Date.now() - f.at < 15 * 60e3);
}
async function noteFailure(s, ip) {
  if (!ip) return;
  const key = `ws/fail/${(await sha(ip)).slice(0, 32)}`;
  const f = (await s.get(key, { type: "json" })) || { count: 0, at: 0 };
  const fresh = Date.now() - f.at > 15 * 60e3;
  await s.setJSON(key, { count: fresh ? 1 : f.count + 1, at: Date.now() });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const [route, arg] = url.pathname.replace(/^\/api\/data\/?/, "").split("/").filter(Boolean);
  const s = dataStore();
  const body = async () => (req.headers.get("content-type") || "").includes("json") ? req.json().catch(() => ({})) : {};
  try {
    if (route === "img" && arg && req.method === "GET") {
      if (!/^[A-Za-z0-9]{12,32}$/.test(arg)) return new Response("Not found", { status: 404 });
      const r = await s.getWithMetadata(`img/${arg}`, { type: "arrayBuffer" });
      if (!r) return new Response("Not found", { status: 404 });
      return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
    }

    const meta = await workspace(s);
    if (route === "status") return json({ setup: !!meta, owner: meta?.owner || "" });

    if (route === "setup" && req.method === "POST") {
      if (meta) return json({ error: "This workspace is already set up. Sign in instead." }, 409);
      const b = await body();
      const pass = String(b.passcode || "");
      if (pass.length < 6) return json({ error: "Use at least 6 characters for the passcode." }, 400);
      const salt = rid(24);
      await s.setJSON("ws/meta", { owner: String(b.owner || "").trim().slice(0, 40) || "Ekaya", salt, iter: 210000, hash: await hashPass(pass, salt), createdAt: Date.now() }, { onlyIfNew: true });
      const check = await workspace(s);
      if (!check || check.salt !== salt) return json({ error: "This workspace is already set up. Sign in instead." }, 409);
      return json({ token: await newSession(s, b.device), owner: check.owner }, 201);
    }

    if (route === "login" && req.method === "POST") {
      if (!meta) return json({ error: "Set up the workspace first." }, 409);
      const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "";
      if (await rateLimited(s, ip)) return json({ error: "Too many tries. Wait 15 minutes and try again." }, 429);
      const b = await body();
      const ok = sameHex(await hashPass(String(b.passcode || ""), meta.salt, meta.iter), meta.hash);
      if (!ok) { await noteFailure(s, ip); return json({ error: "That passcode isn’t right." }, 401); }
      return json({ token: await newSession(s, b.device), owner: meta.owner });
    }

    // everything below needs a signed-in device
    const sess = meta ? await session(req, s) : null;
    if (!sess) return json({ error: "Please sign in again." }, 401);

    if (route === "logout" && req.method === "POST") { await s.delete(sess.key); return json({ ok: true }); }

    if (route === "passcode" && req.method === "POST") {
      const b = await body();
      if (!sameHex(await hashPass(String(b.current || ""), meta.salt, meta.iter), meta.hash)) return json({ error: "The current passcode isn’t right." }, 401);
      const next = String(b.next || "");
      if (next.length < 6) return json({ error: "Use at least 6 characters for the new passcode." }, 400);
      const salt = rid(24);
      await s.setJSON("ws/meta", { ...meta, salt, iter: 210000, hash: await hashPass(next, salt), changedAt: Date.now() });
      const { blobs } = await s.list({ prefix: "ws/sess/" });
      await Promise.all(blobs.filter(x => x.key !== sess.key).map(x => s.delete(x.key)));
      return json({ ok: true, signedOut: blobs.length - 1 });
    }

    if (route === "sync" && req.method === "POST") {
      const b = await body();
      const cols = Object.entries(b.cols || {}).slice(0, 16);
      const out = {};
      await Promise.all(cols.map(async ([col, known]) => {
        if (!okPath(col, false)) return;
        known = known && typeof known === "object" ? known : {};
        const prefix = `doc/${col}/`;
        const { blobs } = await s.list({ prefix, directories: true });
        const live = blobs.map(x => ({ id: x.key.slice(prefix.length), etag: x.etag })).filter(x => x.id && !x.id.includes("/"));
        const changed = live.filter(x => !x.etag || norm(known[x.id]) !== norm(x.etag));
        const docs = [];
        for (let i = 0; i < changed.length; i += 16) {
          const part = await Promise.all(changed.slice(i, i + 16).map(async x => {
            const r = await s.getWithMetadata(prefix + x.id, { type: "json" });
            return r ? { id: x.id, etag: r.etag || x.etag, data: r.data } : null;
          }));
          docs.push(...part.filter(Boolean));
        }
        const ids = new Set(live.map(x => x.id));
        out[col] = { docs, removed: Object.keys(known).filter(id => !ids.has(id)) };
      }));
      return json({ cols: out, at: Date.now() });
    }

    if (route === "doc") {
      const path = url.searchParams.get("path") || "";
      if (!okPath(path, true)) return json({ error: "Bad path" }, 400);
      const key = `doc/${path}`;
      if (req.method === "DELETE") { await s.delete(key); return json({ ok: true }); }
      if (req.method === "PUT") {
        const raw = await req.text();
        if (raw.length > MAX_DOC + 200) return json({ error: "That item is too large to save." }, 413);
        let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: "Bad data" }, 400); }
        if (!b || typeof b.data !== "object" || Array.isArray(b.data) || !b.data) return json({ error: "Bad data" }, 400);
        const opts = b.ifMatch ? { onlyIfMatch: b.ifMatch } : {};
        const r = await s.setJSON(key, b.data, opts);
        if (b.ifMatch && r && r.modified === false) {
          const cur = await s.getWithMetadata(key, { type: "json" });
          return json({ error: "Changed on another device", etag: cur?.etag || null, data: cur?.data || null }, 409);
        }
        const etag = r?.etag || (await s.getMetadata(key))?.etag || null;
        return json({ etag });
      }
      return json({ error: "Method not allowed" }, 405);
    }

    if (route === "import" && req.method === "POST") {
      const b = await body();
      const docs = Array.isArray(b.docs) ? b.docs.slice(0, 100) : [];
      let n = 0;
      for (const d of docs) {
        if (!okPath(d.path, true) || !d.data || typeof d.data !== "object" || JSON.stringify(d.data).length > MAX_DOC) continue;
        // only adds what's missing, so a device can never overwrite newer work in the workspace
        const r = await s.setJSON(`doc/${d.path}`, d.data, { onlyIfNew: true });
        if (!r || r.modified !== false) n++;
      }
      return json({ imported: n });
    }

    if (route === "img" && req.method === "POST") {
      const type = (req.headers.get("content-type") || "").split(";")[0].trim();
      if (!IMG.test(type)) return json({ error: "Use a JPG, PNG or WebP image." }, 415);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > 4_500_000) return json({ error: "That image is too large." }, 413);
      const id = rid(20);
      await s.set(`img/${id}`, buf, { metadata: { type } });
      return json({ id }, 201);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: ["/api/data", "/api/data/*"] };
