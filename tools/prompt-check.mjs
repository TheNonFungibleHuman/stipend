import fs from "node:fs";
const key = fs.readFileSync(".env","utf8").match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
const system = "You are a research analyst. Return 3 short bullets of decision-grade insight. No preamble.";
const user = `Goal: how should we price per call? Threads: "Launch HN: Human Layer" (354 pts), "Usage-based pricing isn't always best" (105 pts).`;
async function test(label, body) {
  const t0 = Date.now();
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${key}`},
    body: JSON.stringify({model:"deepseek-flash", temperature:0.3, messages:[{role:"system",content:system},{role:"user",content:user}], ...body}),
    signal: AbortSignal.timeout(60000)
  });
  const j = await r.json();
  const choice = j.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning_content ?? "";
  console.log(`${label}: status=${r.status} ${Date.now()-t0}ms finish=${choice?.finish_reason} contentLen=${content.length} reasoningLen=${reasoning.length} usage=${JSON.stringify(j.usage?.completion_tokens_details)}`);
  if (content) console.log("   ->", content.replace(/\n/g," | ").slice(0,180));
}
await test("A max_tokens=2500", { max_tokens: 2500 });
await test("B effort=low tokens=800", { max_tokens: 800, reasoning_effort: "low" });
await test("C effort=low tokens=2500", { max_tokens: 2500, reasoning_effort: "low" });
