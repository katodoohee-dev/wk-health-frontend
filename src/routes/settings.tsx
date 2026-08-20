import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppShell } from "@/components/wk/app-shell";
import { Chip, Eyebrow, Panel, SectionHeader, SuccessState } from "@/components/wk/primitives";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WK Health" },
      {
        name: "description",
        content: "Control how WK Health measures, coaches and speaks — plus privacy and accessibility.",
      },
      { property: "og:title", content: "Settings — WK Health" },
      { property: "og:description", content: "Units, voice, privacy and accessibility controls." },
    ],
  }),
  component: SettingsPage,
});

type Row = { label: string; hint: string; value: string; on?: boolean };

const groups: { title: string; eyebrow: string; rows: Row[] }[] = [
  {
    eyebrow: "Measurement",
    title: "Units & baselines",
    rows: [
      { label: "Distance", hint: "Used across activity and navigation", value: "Kilometres" },
      { label: "Weight", hint: "Scale sync and body trends", value: "Kilograms" },
      { label: "Week starts", hint: "Affects weekly rollups", value: "Monday" },
      { label: "Baseline window", hint: "Rolling comparison period", value: "30 days" },
    ],
  },
  {
    eyebrow: "Assistant",
    title: "Voice & coaching",
    rows: [
      { label: "Wake phrase", hint: '"Hey WK" on band and phone', value: "On", on: true },
      { label: "Voice character", hint: "Neutral, measured delivery", value: "Calm" },
      { label: "Coaching tone", hint: "How direct guidance should be", value: "Direct" },
      { label: "Duck music on cues", hint: "Lower playback while speaking", value: "On", on: true },
    ],
  },
  {
    eyebrow: "Privacy",
    title: "Data & sharing",
    rows: [
      { label: "On-device processing", hint: "Keep raw signals local where possible", value: "On", on: true },
      { label: "Share with friends", hint: "Only streaks and active minutes", value: "Limited" },
      { label: "Research contribution", hint: "Anonymised aggregate only", value: "Off" },
    ],
  },
  {
    eyebrow: "Accessibility",
    title: "Display & motion",
    rows: [
      { label: "Reduce motion", hint: "Follows your system preference", value: "System" },
      { label: "Larger numerals", hint: "Increases metric type scale", value: "Off" },
      { label: "High contrast borders", hint: "Strengthens hairlines", value: "On", on: true },
    ],
  },
];

function SettingsPage() {
  return (
    <AppShell eyebrow="Configuration" title="Settings">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-14">
          {groups.map((g) => (
            <section key={g.title}>
              <SectionHeader eyebrow={g.eyebrow} title={g.title} />
              <ul className="divide-y divide-border">
                {g.rows.map((r) => (
                  <li
                    key={r.label}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.hint}</p>
                    </div>
                    {r.on !== undefined ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.on}
                        aria-label={r.label}
                        className={
                          r.on
                            ? "flex h-7 w-12 shrink-0 items-center justify-end rounded-full bg-foreground p-1"
                            : "flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-surface-2 p-1"
                        }
                      >
                        <span
                          className={
                            r.on
                              ? "grid size-5 place-items-center rounded-full bg-background"
                              : "size-5 rounded-full bg-border-strong"
                          }
                        >
                          {r.on ? <Check className="size-3 text-foreground" aria-hidden="true" /> : null}
                        </span>
                      </button>
                    ) : (
                      <span className="shrink-0 text-sm text-muted-foreground">{r.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <Panel className="grain flex flex-col gap-5">
            <Chip tone="solid">Prototype</Chip>
            <p className="display text-2xl">Design system v1</p>
            <p className="text-sm text-muted-foreground">
              This is a visual exploration of the WK Health operating system: monochrome tokens,
              editorial type, one accent signal, and states for empty, loading, error and success.
            </p>
            <dl className="hairline" />
            <dl className="space-y-3">
              {[
                ["Surface", "off-white / white"],
                ["Ink", "#111 equivalent"],
                ["Hairline", "#E5E5E5 equivalent"],
                ["Accent", "single signal green"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="text-xs text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <SuccessState title="Preferences saved" body="Changes apply instantly across your devices." />
          <div>
            <Eyebrow>Danger zone</Eyebrow>
            <button
              type="button"
              className="mt-3 min-h-11 w-full rounded-full border border-destructive/40 px-5 text-sm text-destructive transition-colors hover:bg-destructive/5"
            >
              Delete all health history
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
