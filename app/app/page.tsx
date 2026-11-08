import path from 'node:path';
import Console from '../components/Console';

export const dynamic = 'force-dynamic';

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; token?: string; view?: string }>;
}) {
  const { agent, token, view } = await searchParams;
  const mcpPath = path.join(process.cwd(), 'mcp', 'stipend-mcp.mjs');
  return (
    <Console initialAgentId={agent} initialToken={token} initialView={view} mcpPath={mcpPath} />
  );
}
