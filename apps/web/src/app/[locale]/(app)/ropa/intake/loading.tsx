import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

// Route-level loading UI. Next renders this while the segment streams; without
// it the previous page stayed on screen with no indication anything was
// happening, and each page hand-rolled its own spinner instead.
export default function Loading() {
  return <GenericListSkeleton />;
}
