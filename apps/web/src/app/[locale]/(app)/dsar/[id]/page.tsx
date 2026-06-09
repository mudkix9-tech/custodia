import { DsarWorkspace } from '@/components/dsar/DsarWorkspace';

export default function DsarWorkspacePage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8">
      <DsarWorkspace dsarId={params.id} />
    </div>
  );
}
