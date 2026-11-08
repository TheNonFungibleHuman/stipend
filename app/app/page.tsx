import Console from '../components/Console';

export const dynamic = 'force-dynamic';

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent } = await searchParams;
  return <Console initialAgentId={agent} />;
}
