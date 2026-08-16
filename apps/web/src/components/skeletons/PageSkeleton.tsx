import { Skeleton } from "../ui/Skeleton";

export function RopaListSkeleton() {
  return (
    <div className="p-6 space-y-4 w-full">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-12 w-full mb-4" /> {/* Filter bar */}
      <div className="bg-[#08090A] rounded-2xl border border-white/10 p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function VendorListSkeleton() {
  return (
    <div className="p-6 space-y-4 w-full">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="bg-[#08090A] rounded-2xl border border-white/10 p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function GenericListSkeleton() {
  return (
    <div className="p-6 space-y-4 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-[#08090A] rounded-2xl border border-white/10 p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function GenericWorkspaceSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="flex-1 p-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings routes are a centred single column, not the three-pane workspace
 * GenericWorkspaceSkeleton draws — mirrors SettingsPage/SettingsHeader measure
 * and the SettingsCard hairline so the swap to real content doesn't reflow.
 * Renders inside settings/layout.tsx, so the nav rail is already on screen and
 * deliberately absent here.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24">
      <div className="pb-8">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="mt-3.5 h-4 w-[40ch]" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-set-line bg-set-panel">
            <div className="flex items-center justify-between gap-4 px-[22px] pt-[18px] pb-4">
              <Skeleton className="h-[15px] w-44" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="space-y-3 px-[22px] pb-[18px]">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
