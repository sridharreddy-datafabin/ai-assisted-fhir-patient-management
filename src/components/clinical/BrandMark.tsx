import { Activity } from "lucide-react";

export function BrandMark({ subtitle = "Clinical Workspace" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-[oklch(0.42_0.13_220)] shadow-md ring-1 ring-primary/30">
        {/* Soft inner highlight */}
        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/15 to-transparent" />
        {/* Cross + pulse motif */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-6 w-6"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            d="M3 12h4l2-4 3 8 2-5 2 3h5"
            stroke="oklch(0.85 0.12 195)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Accent dot */}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.15_195)] ring-2 ring-card" />
      </div>
      <div className="flex flex-col leading-tight">
        <h1 className="text-base font-bold tracking-tight text-primary">
          Patient Management
        </h1>
        {subtitle && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

// Activity is intentionally re-exported only via import to keep tree-shaking happy.
void Activity;
