// Ekaya weather — a small, polite proxy for MET Norway's free Locationforecast API.
//   GET /api/weather?lat=26.45&lon=80.33   -> {place, updated, now, hours[], days[], series[]}
// MET's terms ask every app to identify itself, keep coordinates to a few decimals and
// respect Expires / If-Modified-Since. This function does all three and caches each location
// in Netlify Blobs, so every phone opening the app costs MET one request per half hour at most.
// Data: MET Norway, CC BY 4.0 (credited in the app).
import { getStore } from "@netlify/blobs";

const UA = "EkayaEvents/1.0 https://ekaya-events.netlify.app";
const MET = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const store = () => getStore({ name: "ekaya-weather", consistency: "strong" });
const json = (data, status = 200, maxAge = 600) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` }
});
const r2 = n => Math.round(n * 100) / 100;

/* keep only what the app shows: hourly for two days, then 6-hourly, plus daily highs and lows */
function trim(met) {
  const ts = met?.properties?.timeseries || [];
  const series = ts.map(t => {
    const d = t.data || {}, i = d.instant?.details || {};
    const n1 = d.next_1_hours, n6 = d.next_6_hours;
    return {
      t: t.time,
      temp: i.air_temperature,
      hum: i.relative_humidity,
      wind: i.wind_speed,
      sym: n1?.summary?.symbol_code || n6?.summary?.symbol_code || d.next_12_hours?.summary?.symbol_code || "",
      rain: n1?.details?.precipitation_amount ?? n6?.details?.precipitation_amount ?? 0,
      span: n1 ? 1 : n6 ? 6 : 12
    };
  }).filter(x => typeof x.temp === "number").slice(0, 120);
  return { updated: met?.properties?.meta?.updated_at || null, series };
}

export default async (req) => {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "26.45"), lon = parseFloat(url.searchParams.get("lon") || "80.33");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: "Bad location" }, 400, 0);
  const la = r2(lat), lo = r2(lon), key = `w/${la},${lo}`;
  const s = store();
  let cached = null;
  try { cached = await s.get(key, { type: "json" }); } catch (e) {}
  const now = Date.now();
  if (cached && cached.expires > now) return json({ ...cached.data, cached: true });

  const headers = { "User-Agent": UA, "Accept": "application/json" };
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
  try {
    const r = await fetch(`${MET}?lat=${la}&lon=${lo}`, { headers });
    const exp = Date.parse(r.headers.get("expires") || "") || now + 30 * 60e3;
    if (r.status === 304 && cached) {
      cached.expires = Math.max(exp, now + 10 * 60e3);
      await s.setJSON(key, cached);
      return json({ ...cached.data, cached: true });
    }
    if (r.ok) {
      const data = trim(await r.json());
      const entry = { data, expires: Math.max(exp, now + 10 * 60e3), lastModified: r.headers.get("last-modified") || "" };
      await s.setJSON(key, entry);
      return json(data);
    }
    if (cached) return json({ ...cached.data, stale: true }, 200, 120);
    return json({ error: "Weather is unavailable right now." }, 502, 0);
  } catch (e) {
    console.error(e);
    if (cached) return json({ ...cached.data, stale: true }, 200, 120);
    return json({ error: "Weather is unavailable right now." }, 502, 0);
  }
};

export const config = { path: "/api/weather" };
