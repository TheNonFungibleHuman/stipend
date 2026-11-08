const q = encodeURIComponent("usage-based pricing AI observability");
const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5`;
const t0 = Date.now();
const r = await fetch(url, { headers: { "User-Agent": "stipend-demo/1.0" } });
const j = await r.json();
console.log("status", r.status, "ms", Date.now()-t0, "hits", j.hits?.length);
for (const h of (j.hits ?? []).slice(0,5)) console.log(`- ${h.title} | pts=${h.points} | ${h.created_at?.slice(0,10)} | ${h.url?.slice(0,60) ?? ""}`);
