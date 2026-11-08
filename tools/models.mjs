import fs from "node:fs";
const key = fs.readFileSync(".env","utf8").match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
const r = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${key}` } });
const j = await r.json();
for (const m of j.data) console.log(`${m.id.padEnd(22)} ${m.name.padEnd(22)} ctx=${m.context_window}`);
