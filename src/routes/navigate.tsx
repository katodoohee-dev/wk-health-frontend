import { createFileRoute } from "@tanstack/react-router";
import { Navigation, Volume2 } from "lucide-react";
import { AppShell } from "@/components/wk/app-shell";
import { Chip, Eyebrow, Panel, SectionHeader } from "@/components/wk/primitives";
import { routeStops } from "@/lib/wk-data";

export const Route = createFileRoute("/navigate")({
  head: () => ({
    meta: [
      { title: "Navigate — WK Health" },
      {
        name: "description",
        content: "Turn-by-turn route guidance designed for movement: shaded paths, clean air, calm typography.",
      },
      { property: "og:title", content: "Navigate — WK Health" },
      {
        property: "og:description",
        content: "Route guidance built around how your body is doing today.",
      },
    ],
  }),
  component: NavigatePage,
});

function MapCanvas() {
  return (
    <div className="grain relative overflow-hidden rounded-2xl border border-border bg-surface-2">
      <svg viewBox="0 0 800 520" className="h-full w-full" role="img" aria-label="Route map preview">
        <defs>
          <pattern id="wk-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0v40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          </pattern>
        </defs>
        <rect width="800" height="520" fill="url(#wk-grid)" />
        <path
          d="M0 380 C 140 340 200 260 320 250 S 520 300 620 210 L 800 150"
          fill="none"
          stroke="currentColor"
          strokeWidth="18"
          strokeLinecap="round"
          className="text-border"
        />
        <path
          d="M0 380 C 140 340 200 260 320 250 S 520 300 620 210 L 800 150"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10 8"
          className="text-foreground"
        />
        <path
          d="M60 120 C 220 90 300 160 420 120 L 700 60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-border-strong"
        />
        <circle cx="320" cy="250" r="7" className="fill-foreground" />
        <circle cx="320" cy="250" r="18" className="animate-pulse-ring fill-none stroke-foreground" strokeWidth="1" />
        <circle cx="800" cy="150" r="5" className="fill-none stroke-foreground" strokeWidth="2" />
      </svg>

      <div className="absolute inset-x-4 top-4 flex flex-wrap items-center gap-2">
        <Chip tone="solid">Riverside loop</Chip>
        <Chip tone="signal">AQI 24</Chip>
        <Chip>Shaded 78%</Chip>
      </div>

      <div className="absolute inset-x-4 bottom-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border bg-surface/95 p-4 backdrop-blur-md">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <Navigation className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">In 240 m</p>
          <p className="display truncate text-2xl">Bear left onto river path</p>
        </div>
      </div>
    </div>
  );
}

function NavigatePage() {
  return (
    <AppShell eyebrow="Guidance" title="Navigate">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-h-[420px] lg:min-h-[560px]">
          <MapCanvas />
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="flex items-center justify-between gap-6">
            <div>
              <Eyebrow>Remaining</Eyebrow>
              <p className="numeric mt-2 text-5xl font-medium">6.2</p>
              <p className="eyebrow mt-1">kilometres</p>
            </div>
            <div className="text-right">
              <Eyebrow>ETA</Eyebrow>
              <p className="numeric mt-2 text-5xl font-medium">31</p>
              <p className="eyebrow mt-1">minutes</p>
            </div>
          </Panel>

          <Panel className="flex items-center gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border">
              <Volume2 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Voice guidance</p>
              <p className="text-xs text-muted-foreground">Ducking music at each cue</p>
            </div>
          </Panel>

          <div>
            <SectionHeader eyebrow="Itinerary" title="Turn list" />
            <ol className="mt-2 divide-y divide-border">
              {routeStops.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-4 py-4">
                  <span className="numeric text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="eyebrow mt-0.5">{s.detail}</p>
                  </div>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">{s.meta}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
