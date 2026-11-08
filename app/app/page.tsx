import Dashboard from '../components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent } = await searchParams;
  return <Dashboard initialAgentId={agent} />;
}
