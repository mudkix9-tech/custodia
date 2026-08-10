import { DsarWorkspace } from '@/components/dsar/DsarWorkspace';

export default async function DsarWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-8">
      <DsarWorkspace dsarId={id} />
    </div>
  );
}
