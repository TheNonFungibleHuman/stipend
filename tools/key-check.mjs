import fs from "node:fs";
const key = fs.readFileSync(".env","utf8").match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
const r = await fetch("https://api.deepseek.com/chat/completions", {
  method:"POST",
  headers:{"Content-Type":"application/json", Authorization:`Bearer ${key}`},
  body: JSON.stringify({model:"deepseek-flash", max_tokens:40, messages:[{role:"user",content:"Say OK"}]})
});
console.log("status:", r.status);
const t = await r.text();
console.log(t.slice(0, 500));
