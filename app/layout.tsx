import type { Metadata } from 'next';
import { Archivo, Martian_Mono } from 'next/font/google';
import './globals.css';

/** Silkscreen plate face: labels, body, the operating legend. */
const plate = Archivo({ subsets: ['latin'], variable: '--font-plate', display: 'swap' });

/** Counter face: every monetary value, wide and mechanical like a price wheel. */
const meter = Martian_Mono({ subsets: ['latin'], variable: '--font-meter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Stipend — a budget for your agent, on Solana',
  description:
    'An AI agent with its own wallet and a spending policy enforced before every signature. It buys what it needs, one call at a time, and the receipts settle on Solana in about half a second.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plate.variable} ${meter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
