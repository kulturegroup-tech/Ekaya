// Ekaya photo wall API — stores guest photos in Netlify Blobs.
// Routes:
//   POST   /api/gallery                      create a wall -> {id, key}
//   GET    /api/gallery/:id                  wall info + photo list
//   PATCH  /api/gallery/:id                  (admin) open/close uploads, rename
//   POST   /api/gallery/:id/photos           upload (multipart: full, thumb, name)
//   GET    /api/gallery/:id/photos/:k        image (?s=t thumbnail, ?dl=1 download, ?meta=1 info)
//   DELETE /api/gallery/:id/photos/:k        (admin) remove a photo
import { getStore } from "@netlify/blobs";
import { webcrypto } from "node:crypto";
import { workspace, session } from "../lib/auth.mjs";

const store = () => getStore({ name: "ekaya-gallery", consistency: "strong" });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rid = n => [...webcrypto.getRandomValues(new Uint8Array(n))].map(x => ALPHA[x % ALPHA.length]).join("");
const sha = async s => [...new Uint8Array(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const ID = /^[A-Za-z0-9]{8,24}$/;
const PK = /^[a-z0-9]{6,12}-[A-Za-z0-9]{4,8}$/;
const IMG = /^image\/(jpeg|png|webp)$/;
const publicMeta = m => ({ title: m.title, date: m.date, palette: m.palette || [], open: m.open !== false });

export default async (req) => {
  const url = new URL(req.url);
  const [id, sub, pk] = url.pathname.replace(/^\/api\/gallery\/?/, "").split("/").filter(Boolean);
  const s = store();
  try {
    if (!id) {
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if ((await workspace()) && !(await session(req))) return json({ error: "Sign in to your Ekaya workspace to create a photo wall." }, 401);
      const body = await req.json().catch(() => ({}));
      const gid = rid(12), key = rid(28);
      const meta = {
        title: String(body.title || "Our celebration").slice(0, 80),
        date: /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : "",
        palette: Array.isArray(body.palette) ? body.palette.filter(h => /^#[0-9a-fA-F]{6}$/.test(h)).slice(0, 8) : [],
        open: true, createdAt: Date.now(), keyHash: await sha(key)
      };
      await s.setJSON(`g/${gid}/meta`, meta);
      return json({ id: gid, key }, 201);
    }
    if (!ID.test(id)) return json({ error: "This photo wall doesn’t exist." }, 404);
    const meta = await s.get(`g/${id}/meta`, { type: "json" });
    if (!meta) return json({ error: "This photo wall doesn’t exist." }, 404);
    const isAdmin = async () => { const k = req.headers.get("x-admin-key") || ""; return !!k && (await sha(k)) === meta.keyHash; };

    if (!sub) {
      if (req.method === "GET") {
        const prefix = `g/${id}/p/`;
        const { blobs } = await s.list({ prefix });
        const photos = blobs.map(b => b.key.slice(prefix.length)).filter(k => PK.test(k)).sort().reverse()
          .map(k => ({ k, t: parseInt(k.split("-")[0], 36) || 0 }));
        return json({ ...publicMeta(meta), count: photos.length, photos });
      }
      if (req.method === "PATCH") {
        if (!(await isAdmin())) return json({ error: "Only the organiser can change this." }, 403);
        const body = await req.json().catch(() => ({}));
        if (typeof body.open === "boolean") meta.open = body.open;
        if (body.title) meta.title = String(body.title).slice(0, 80);
        if (body.date !== undefined && (/^\d{4}-\d{2}-\d{2}$/.test(body.date) || body.date === "")) meta.date = body.date;
        if (Array.isArray(body.palette)) meta.palette = body.palette.filter(h => /^#[0-9a-fA-F]{6}$/.test(h)).slice(0, 8);
        await s.setJSON(`g/${id}/meta`, meta);
        return json(publicMeta(meta));
      }
      return json({ error: "Method not allowed" }, 405);
    }

    if (sub !== "photos") return json({ error: "Not found" }, 404);
    if (!pk) {
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (meta.open === false && !(await isAdmin())) return json({ error: "Uploads are closed for this event." }, 403);
      const form = await req.formData();
      const full = form.get("full"), thumb = form.get("thumb");
      if (!full || typeof full.arrayBuffer !== "function" || !thumb || typeof thumb.arrayBuffer !== "function") return json({ error: "No photo received." }, 400);
      if (!IMG.test(full.type) || !IMG.test(thumb.type)) return json({ error: "Use a JPG, PNG or WebP photo." }, 415);
      if (full.size > 4_500_000 || thumb.size > 700_000) return json({ error: "That photo is too large." }, 413);
      const name = String(form.get("name") || "").replace(/[^\p{L}\p{N} .'&-]/gu, "").trim().slice(0, 30);
      const k = `${Date.now().toString(36)}-${rid(6)}`;
      await s.set(`g/${id}/t/${k}`, await thumb.arrayBuffer(), { metadata: { type: thumb.type } });
      await s.set(`g/${id}/p/${k}`, await full.arrayBuffer(), { metadata: { type: full.type, name, at: Date.now() } });
      return json({ k, t: Date.now() }, 201);
    }
    if (!PK.test(pk)) return json({ error: "Not found" }, 404);
    if (req.method === "GET") {
      if (url.searchParams.get("meta")) {
        const m = await s.getMetadata(`g/${id}/p/${pk}`);
        if (!m) return json({ error: "Not found" }, 404);
        return json({ n: m.metadata?.name || "", t: m.metadata?.at || parseInt(pk.split("-")[0], 36) });
      }
      const thumbReq = url.searchParams.get("s") === "t";
      const res = await s.getWithMetadata(`g/${id}/${thumbReq ? "t" : "p"}/${pk}`, { type: "arrayBuffer" });
      if (!res) return new Response("Not found", { status: 404 });
      const headers = { "content-type": res.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" };
      if (url.searchParams.get("dl")) headers["content-disposition"] = `attachment; filename="${(meta.title || "photo").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${pk}.jpg"`;
      return new Response(res.data, { headers });
    }
    if (req.method === "DELETE") {
      if (!(await isAdmin())) return json({ error: "Only the organiser can remove photos." }, 403);
      await s.delete(`g/${id}/p/${pk}`);
      await s.delete(`g/${id}/t/${pk}`);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: ["/api/gallery", "/api/gallery/*"] };
