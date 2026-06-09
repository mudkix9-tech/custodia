import { PolicyEditorClient } from '@/components/policies/PolicyEditorClient';

export default function PolicyPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col">
      <PolicyEditorClient policyId={params.id} />
    </div>
  );
}
