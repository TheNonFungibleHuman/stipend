import fs from "node:fs";
const book = JSON.parse(fs.readFileSync("C:/Users/User/solana-hack/.devnet/wallets.json","utf8"));
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
const treasury = Keypair.fromSecretKey(bs58.decode(book.treasury)).publicKey.toBase58();
const r = await fetch("https://api.devnet.solana.com",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getBalance",params:[treasury,{commitment:"confirmed"}]})});
const j = await r.json();
console.log("treasury:", treasury);
console.log("lamports:", j.result?.value, "=> SOL:", (j.result?.value ?? 0)/1e9);
