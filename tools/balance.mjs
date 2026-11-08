import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const address = new PublicKey('5qgRDGNrgqx9gzvsYzVgMaFsgfjPQ3thDDBt3syH4Ton');
const balance = await connection.getBalance(address);
console.log('treasury SOL:', balance / LAMPORTS_PER_SOL);
