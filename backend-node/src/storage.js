// Penyimpanan foto lapak (Emergent Object Storage) — sama seperti backend Python.
const BASE = `${(process.env.INTEGRATION_PROXY_URL || "https://integrations.emergentagent.com").replace(/\/$/, "")}/objstore/api/v1/storage`;
let key = null;

async function init(force = false) {
  if (key && !force) return key;
  const r = await fetch(`${BASE}/init`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emergent_key: process.env.EMERGENT_LLM_KEY }) });
  if (!r.ok) throw new Error(`storage init ${r.status}`);
  key = (await r.json()).storage_key;
  return key;
}

export async function putObject(path, data, type) {
  const send = async (force) => fetch(`${BASE}/objects/${path}`, { method: "PUT", headers: { "X-Storage-Key": await init(force), "Content-Type": type }, body: data });
  let r = await send(false);
  if (r.status === 404) r = await send(true); // key kedaluwarsa → minta baru
  if (!r.ok) throw new Error(`storage put ${r.status}`);
  return r.json();
}

export async function getObject(path) {
  const r = await fetch(`${BASE}/objects/${path}`, { headers: { "X-Storage-Key": await init() } });
  if (!r.ok) throw new Error(`storage get ${r.status}`);
  return { data: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "application/octet-stream" };
}
