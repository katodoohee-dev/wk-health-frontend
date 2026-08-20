import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wk/app-shell";
import {
  BarSeries,
  Chip,
  EmptyState,
  ErrorState,
  Eyebrow,
  Metric,
  Panel,
  SectionHeader,
} from "@/components/wk/primitives";
import { activityWeek, sessions } from "@/lib/wk-data";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — WK Health" },
      {
        name: "description",
        content: "Every session, load score and trend in one editorial training ledger.",
      },
      { property: "og:title", content: "Activity — WK Health" },
      {
        property: "og:description",
        content: "Training load, sessions and weekly balance at a glance.",
      },
    ],
  }),
  component: ActivityPage,
});

const summary = [
  { id: "load", label: "Load · 7 day", value: 612, unit: "au", delta: "+42", trend: [420, 460, 500, 470, 540, 580, 612] },
  { id: "distance", label: "Distance", value: 86.4, unit: "km", delta: "+11.2", trend: [60, 64, 70, 68, 75, 81, 86] },
  { id: "time", label: "Moving time", value: "6:52", unit: "hrs", delta: "+0:48" },
  { id: "elev", label: "Elevation", value: 742, unit: "m", delta: "-90" },
];

function ActivityPage() {
  return (
    <AppShell eyebrow="Training ledger" title="Activity">
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <Panel key={s.id} className="animate-rise">
            <Metric
              label={s.label}
              value={s.value}
              unit={s.unit}
              delta={s.delta}
              {...(s.trend ? { trend: s.trend } : {})}
            />
          </Panel>
        ))}
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel>
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>Weekly distribution</Eyebrow>
              <p className="display mt-2 text-2xl">Intensity is front-loaded</p>
            </div>
            <Chip>Minutes</Chip>
          </div>
          <div className="mt-8">
            <BarSeries data={activityWeek} />
          </div>
        </Panel>
        <Panel className="grain flex flex-col justify-between gap-8">
          <div>
            <Eyebrow>Balance</Eyebrow>
            <p className="numeric mt-3 text-6xl font-medium">1.18</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Acute-to-chronic ratio. Above 1.5 signals overreach; you are in the productive band.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { l: "Zone 1–2", v: 18 },
              { l: "Zone 3", v: 34 },
              { l: "Zone 4–5", v: 48 },
            ].map((z) => (
              <div key={z.l}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{z.l}</span>
                  <span className="numeric">{z.v}%</span>
                </div>
                <div className="mt-2 h-[3px] w-full rounded-full bg-border">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${z.v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-14">
        <SectionHeader eyebrow="Recent" title="Sessions" action={<Chip>Last 7 days</Chip>} />
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5 transition-colors hover:bg-surface-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto_auto] sm:gap-8"
            >
              <Eyebrow className="hidden sm:block">{s.type}</Eyebrow>
              <div className="min-w-0">
                <p className="truncate text-base font-medium">{s.title}</p>
                <p className="eyebrow mt-1">
                  {s.type} · {s.time}
                </p>
              </div>
              <p className="numeric hidden text-sm text-muted-foreground sm:block">{s.pace}</p>
              <div className="shrink-0 text-right">
                <p className="numeric text-lg">{s.distance}</p>
                <p className="eyebrow">load {s.load}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <EmptyState
          title="No swim data yet"
          body="Pair a compatible device and your pool sessions will appear in this ledger automatically."
        />
        <ErrorState
          title="Chest strap dropped out"
          body="Heart rate for 4 minutes of Wednesday's session is missing. The session load is estimated."
        />
      </section>
    </AppShell>
  );
}
