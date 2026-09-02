import { cn } from "@/lib/utils";

/** Base shimmer block. Compose these to build any loading placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

/** Rows of avatar + text + trailing chip — for list/table style pages. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#e5e9f2]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Grid of card placeholders — for card-based modules. */
export function CardGridSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  const colClass = cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={cn("grid gap-4", colClass)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Header + two info cards — for detail pages. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {/* Status banner */}
      <Skeleton className="h-14 w-full rounded-xl" />
      {/* Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
