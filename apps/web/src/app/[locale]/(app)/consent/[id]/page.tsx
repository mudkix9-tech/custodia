import { ConsentWorkspaceClient } from '@/components/consent/ConsentWorkspaceClient';

// Next 16 removed synchronous `params` access, so reading `params.id` directly
// yields undefined and the workspace never receives a domain id.
export default async function ConsentWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col">
      <ConsentWorkspaceClient domainId={id} />
    </div>
  );
}
