export function LandingHeroMapSkeleton() {
  return (
    <div
      className="flex min-h-[420px] animate-pulse flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-card md:min-h-[560px]"
      aria-hidden
    >
      <div className="mx-4 mt-4 shrink-0 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 md:mx-6 md:mt-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-muted/50" />
          <div className="h-4 w-28 rounded bg-muted/50" />
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3 md:p-4">
        <div className="h-full min-h-[280px] w-full rounded-2xl border border-border/50 bg-muted/20" />
      </div>
    </div>
  )
}
