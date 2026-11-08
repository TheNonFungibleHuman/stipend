/**
 * Everything a person needs to hand to their own agent, in one place.
 *
 * Two forms of the same thing: a sentence they can paste into an agent that can
 * configure itself, and a config block for agents that cannot. The copy avoids
 * protocol names where a plain description will do.
 */

export function mcpUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

export function agentPrompt(input: { origin: string; token: string }): string {
  const url = mcpUrl(input.origin);
  return `Connect to Stipend, a paid research service, then use it to buy data for me.

1. Add this as a tool server in your MCP settings:
     URL:    ${url}
     Header: Authorization: Bearer ${input.token}

2. You will get four tools: agent_status, buy_signals, buy_notes, buy_brief.
3. Call agent_status first so you know my remaining budget.
4. Write queries as two to four concrete words, like a search box:
   "AI coding assistant pricing" works; "what is the best way to price an AI coding
   assistant" works badly. The service searches public discussion, so keywords beat sentences.
5. Before spending on notes or a brief, read the thread titles buy_signals returned.
   If they are not about my question, stop and tell me. Do not buy the next step.
6. If buy_signals finds nothing useful, reword the query once and try again. Then stop.
7. Every purchase costs a few cents from my Stipend wallet, not from a card.
   After buying, tell me what it cost and give me the receipt link.`;
}

export function agentConfig(input: { origin: string; token: string }): string {
  return `{
  "mcpServers": {
    "stipend": {
      "url": "${mcpUrl(input.origin)}",
      "headers": {
        "Authorization": "Bearer ${input.token}"
      }
    }
  }
}`;
}

export function agentHttpExample(input: { origin: string; token: string }): string {
  return `// Ask for a price. Nothing is charged yet.
const ask = await fetch('${input.origin}/api/paid/market-intel', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-agent-token': '${input.token}',
  },
  body: JSON.stringify({ query: 'usage-based pricing for AI tools' }),
});
// ask.status === 402, with a price in the body.

// Pay for it. This signs a transfer from your Stipend wallet.
const auth = await fetch('${input.origin}/api/agents/${'<agent id>'}/authorize', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-agent-token': '${input.token}' },
  body: JSON.stringify({ serviceId: 'market-intel', query: 'usage-based pricing for AI tools' }),
});

// Repeat the first call with the payment proof attached.
const paid = await fetch('${input.origin}/api/paid/market-intel', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-agent-token': '${input.token}',
    'x-payment': auth.header,
  },
  body: JSON.stringify({ query: 'usage-based pricing for AI tools' }),
});
// 200 with the data and a receipt.`;
}
