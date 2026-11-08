import Console from '../components/Console';

export const dynamic = 'force-dynamic';

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; token?: string; view?: string }>;
}) {
  const { agent, token, view } = await searchParams;
  return <Console initialAgentId={agent} initialToken={token} initialView={view} />;
}
