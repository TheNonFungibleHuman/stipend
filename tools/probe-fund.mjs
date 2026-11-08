import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
const book = JSON.parse(fs.readFileSync("C:/Users/User/solana-hack/.devnet/wallets.json","utf8"));
const treasury = Keypair.fromSecretKey(bs58.decode(book.treasury));
const addr = treasury.publicKey.toBase58();
console.log("TREASURY ADDRESS:", addr);
const rpc = async (url, method, params=[]) => {
  const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  return [r.status, await r.text()];
};
for (const url of ["https://api.devnet.solana.com","https://api.testnet.solana.com"]) {
  const [s,t] = await rpc(url,"requestAirdrop",[addr, 500000000]);
  console.log(url, "->", s, t.slice(0,160));
}
try {
  const r = await fetch("https://faucet.solana.com/api/request", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:addr,amount:1,network:"devnet"})});
  console.log("faucet.solana.com ->", r.status, (await r.text()).slice(0,200));
} catch(e) { console.log("faucet api err", e.message); }
