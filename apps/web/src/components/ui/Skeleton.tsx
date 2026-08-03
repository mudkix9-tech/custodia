import { cn } from "@/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-white/10 rounded', className)} />;
}
