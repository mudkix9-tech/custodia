import { PolicyEditorClient } from '@/components/policies/PolicyEditorClient';

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col">
      <PolicyEditorClient policyId={id} />
    </div>
  );
}
