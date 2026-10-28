// Shared helpers for Ekaya functions: the workspace store, passcode hashing and sessions.
import { getStore } from "@netlify/blobs";
import { webcrypto as C, timingSafeEqual } from "node:crypto";

export const dataStore = () => getStore({ name: "ekaya-data", consistency: "strong" });
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const sha = async s => hex(await C.subtle.digest("SHA-256", enc.encode(s)));
export const token = (n = 32) => Buffer.from(C.getRandomValues(new Uint8Array(n))).toString("base64url");
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const rid = n => [...C.getRandomValues(new Uint8Array(n))].map(x => ALPHA[x % ALPHA.length]).join("");

export async function hashPass(pass, salt, iterations = 210000) {
  const key = await C.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await C.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256));
}
export const sameHex = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

export const workspace = (s = dataStore()) => s.get("ws/meta", { type: "json" });

const SESSION_DAYS = 180;
export async function newSession(s, label = "") {
  const t = token(32);
  await s.setJSON(`ws/sess/${await sha(t)}`, { createdAt: Date.now(), label: String(label).slice(0, 60) });
  return t;
}
export async function session(req, s = dataStore()) {
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (t.length < 20 || t.length > 200) return null;
  const key = `ws/sess/${await sha(t)}`;
  const sess = await s.get(key, { type: "json" });
  if (!sess) return null;
  if (Date.now() - sess.createdAt > SESSION_DAYS * 864e5) { await s.delete(key); return null; }
  return { key, ...sess };
}
