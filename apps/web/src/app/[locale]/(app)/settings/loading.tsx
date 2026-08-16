import { SettingsPageSkeleton } from '@/components/skeletons/PageSkeleton';

// Route-level loading UI for the whole /settings subtree. Load-bearing beyond
// the visible skeleton: the (app) layout is force-dynamic, and Next does not
// prefetch a dynamic route that has no loading boundary — so without this file
// every tab switch was an unprefetched, blocking RSC round trip with the old
// page frozen on screen until it landed. See vendors/loading.tsx, which fixed
// the same thing everywhere except here.
export default function Loading() {
  return <SettingsPageSkeleton />;
}
