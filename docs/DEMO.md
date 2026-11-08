# Demo script — spoken

Read this out loud once before recording. If a sentence feels stiff in your mouth, change it — the
words matter less than sounding like yourself.

---

## 1 · The hook — 10s

> "So, quick thing. Every time you ask your AI agent to do something — look something up, read a page,
> summarise a document — it's actually making a bunch of tiny purchases behind the scenes. Dozens of
> them, for one task. And right now, the only way to pay for any of that is a credit card you put on
> file for a human."

*[Landing page, top. Let it breathe for a second.]*

## 2 · The problem — 12s

> "Here's why that doesn't work. A card costs about thirty cents plus a percentage, every single
> transaction. So if a lookup costs four cents, the vendor loses money selling it to you. Which is why
> nobody sells you one lookup. They sell you a ninety-nine dollar a month plan instead. For something
> your agent needed once."

## 3 · Why Solana — 8s

> "That's the whole reason I built this on Solana. A transaction there costs a fraction of a cent. So a
> four-cent purchase is actually possible. This is Stipend."

*[Scroll a little so the dial is centred.]*

## 4 · What it is — 10s

> "Stipend gives your agent its own wallet, with its own budget — and a spending policy that's checked
> before anything gets signed. It never touches your card. Watch."

## 5 · The dial — 15s

> "Under the cap, it pays."

*[Drag the dial to $0.04, press Pay. Receipt stamps.]*

> "Over the cap…"

*[Drag to $5.00, press Pay.]*

> "…it refuses, tells you why, and nothing was signed. That's the part that matters — a mistake can't
> reach your money."

## 6 · The demo agent — 20s

> "So the fastest way to see it working is the demo agent. It buys three things it doesn't control."

*[Open the console, press Run pipeline. Let the steps land one at a time — don't talk over them.]*

> "A live search for four cents. Notes on what it found, six cents. A one-page memo, eight. Eighteen
> cents total. A card would have charged about ninety cents just to collect that."

*[Click one receipt link, show the explorer, come back.]*

> "And every one of those has a receipt on Solana. Anyone can open it."

## 7 · Your own agent — 20s

> "But the demo is my agent. Here's yours. You create one — name, a cap per call, a budget per day…"

*[Create your agent. Type a name, leave $1 / $5, press Create.]*

> "…and it gets its own wallet and twenty-five dollars of test money. Then there's one block of text
> you paste into whatever agent you already use — Claude Code, Cursor, anything."

*[Open Copy instructions, then switch to the agent window.]*

> "So I'll paste that in here, and just ask it a normal question."

*[Paste the prompt. Then type: "What are people saying about how AI observability tools should be
priced?" — let it call the tool.]*

> "It went and bought that itself. Four cents, from its own wallet."

*[Switch back to the console. The purchase is in the ledger.]*

> "And there it is — in my console, with the price and the receipt. That's the whole loop."

## 8 · Close — 10s

> "So: your agent gets a budget, not your keys. Every purchase is capped, every refusal is free, and
> every payment has a receipt. It's running on devnet right now, so it's test money — same code on
> mainnet with real USDC. Thanks for watching."

---

## Order of operations, and why

**Demo first, then create your own.** Three reasons:

1. The first twenty seconds have to *prove* something is real. The demo buys things immediately; a
   create form is setup, and setup is where people click away.
2. The demo agent is already funded and configured — it cannot fail on camera for a boring reason.
3. Building your own agent is the stronger story as a *climax*: you watch me make one, hand it to a
   real agent, and then see the receipt appear. It lands harder after the demo has already shown the
   mechanism.

Where the two overlap: the demo shows **the product buying**. Your own agent shows **your agent
buying**. That second one is the one a judge remembers, so it goes last.

## Recording checklist

- [ ] Browser zoom 100%, bookmarks bar hidden, one window per scene.
- [ ] Treasury footer shows SOL — anything above 0.1 is plenty.
- [ ] Demo agent has runway (meter shows budget remaining).
- [ ] Run the pipeline once silently to warm the serverless function, then reload.
- [ ] Close every other tab. Silence notifications.
- [ ] If the live site won't load on your network, record `pnpm start` on `127.0.0.1:4310` — identical
      UI, real devnet settlement. Say "running on devnet" once and it's still honest.

## The three lines that must land

- "It never touches your card."
- "The cap is checked before the signature, so a refusal costs nothing."
- "Every purchase has a receipt anyone can open."
