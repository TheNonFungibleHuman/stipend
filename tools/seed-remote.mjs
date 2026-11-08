import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (name) => env.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("KV_REST_API_URL");
const token = get("KV_REST_API_TOKEN");
if (!url || !token) { console.log("no kv creds"); process.exit(1); }

async function kv(cmd) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      return j.result;
    } catch (e) {
      last = e;
      console.log(`  retry ${attempt}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
  throw last;
}

const files = [
  ["wallets", ".devnet/wallets.json"],
  ["state", ".devnet/state.json"],
  ["agents", ".devnet/agents.json"],
  ["ledger", ".devnet/ledger.json"],
];

for (const [key, path] of files) {
  if (!fs.existsSync(path)) { console.log(`${key}: missing locally, skipped`); continue; }
  const raw = fs.readFileSync(path, "utf8");
  await kv(["SET", `stipend:${key}`, raw]);
  console.log(`${key}: seeded (${raw.length} bytes)`);
}

const wallets = JSON.parse(fs.readFileSync(".devnet/wallets.json", "utf8"));
const { Keypair } = await import("@solana/web3.js");
const bs58 = (await import("bs58")).default;
const treasury = Keypair.fromSecretKey(bs58.decode(wallets.treasury)).publicKey.toBase58();
console.log("treasury:", treasury);
