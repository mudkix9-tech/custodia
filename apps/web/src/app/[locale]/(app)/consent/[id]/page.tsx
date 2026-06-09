import { ConsentWorkspaceClient } from '@/components/consent/ConsentWorkspaceClient';

export default function ConsentWorkspacePage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col">
      <ConsentWorkspaceClient domainId={params.id} />
    </div>
  );
}
