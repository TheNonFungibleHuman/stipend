import fs from "node:fs";
const env = fs.readFileSync(".env","utf8");
const key = env.match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.log("NO KEY"); process.exit(1); }
console.log("key length:", key.length, "prefix:", key.slice(0,3));
const r = await fetch("https://api.deepseek.com/chat/completions", {
  method:"POST",
  headers:{"Content-Type":"application/json", Authorization:`Bearer ${key}`},
  body: JSON.stringify({model:"deepseek-chat", max_tokens:60, messages:[
    {role:"system", content:"Reply with exactly: ENGINE OK"},
    {role:"user", content:"test"}
  ]})
});
const t = await r.text();
console.log("status:", r.status);
try { const j = JSON.parse(t); console.log("model:", j.model, "| reply:", j.choices?.[0]?.message?.content); }
catch { console.log(t.slice(0,200)); }
