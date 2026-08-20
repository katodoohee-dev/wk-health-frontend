import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BarChart3,
  Camera,
  Footprints,
  HeartPulse,
  Moon,
  Music,
  Sparkles,
} from "lucide-react";
import { GlassCard, Ring, Bar } from "@/components/app/ui-bits";

export const Route = createFileRoute("/vision")({
  head: () => ({
    meta: [
      { title: "WK Health — Vision UI" },
      {
        name: "description",
        content: "WK Health Vision — static editorial frontend preview. No backend connected.",
      },
      { property: "og:title", content: "WK Health — Vision UI" },
      { property: "og:description", content: "A monochrome editorial preview of the WK Health frontend." },
    ],
  }),
  component: VisionPage,
});

const timeline = [
  ["06:40", "Woke up", "Sleep score 82 · 7h 12m", "done"],
  ["07:05", "Morning walk", "2,140 steps · 22 min", "done"],
  ["07:45", "Breakfast", "Oats, blueberries, kefir · 410 kcal", "done"],
  ["08:30", "Focus block", "Ambient playlist queued", "active"],
  ["18:00", "Strength session", "Lower body · 45 min planned", "idle"],
] as const;

function VisionPage() {
  return (
    <div className="vision-page">
      <header className="vision-topbar">
        <div className="flex items-center gap-3">
          <span className="vision-mark">WK</span>
          <div>
            <p className="vision-brand">WK Health</p>
            <p className="vision-mono">VISION / FRONTEND PREVIEW</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="vision-status"><span /> Static UI · No backend</span>
          <Link to="/" className="vision-toplink">Current app <ArrowUpRight className="size-3.5" /></Link>
        </div>
      </header>

      <main className="vision-content">
        <section className="vision-hero">
          <div>
            <p className="vision-eyebrow">WK HEALTH / VISION SYSTEM</p>
            <h1 className="vision-display">A calmer way to<br /><em>hold your health.</em></h1>
            <p className="vision-lede">
              Editorial, monochrome, deliberate. This is the new frontend direction rendered as a complete product surface before any backend connection.
            </p>
          </div>
          <div className="vision-hero-meta">
            <div><span>DATE</span><strong>20 AUG 2026</strong></div>
            <div><span>MODE</span><strong>VISUAL ONLY</strong></div>
            <div><span>BUILD</span><strong>VISION 01</strong></div>
          </div>
        </section>

        <section className="vision-metrics">
          <Metric label="Steps" value="8,412" unit="/ 10k" delta="+12%" />
          <Metric label="Energy" value="1,860" unit="kcal" />
          <Metric label="Resting HR" value="58" unit="bpm" />
          <Metric label="Sleep" value="7:12" unit="hrs" delta="+18m" />
        </section>

        <section className="vision-grid">
          <div className="vision-column">
            <SectionLabel title="Day so far" meta="08:31" />
            <GlassCard className="vision-panel vision-timeline-panel">
              <div className="vision-timeline">
                {timeline.map(([time, title, detail, state]) => (
                  <div className="vision-timeline-row" key={time}>
                    <span className="vision-time">{time}</span>
                    <span className={`vision-dot ${state}`} />
                    <div>
                      <p>{title}</p>
                      <small>{detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <SectionLabel title="Targets" meta="4 active" />
            <GlassCard className="vision-panel vision-targets">
              <Bar label="Movement" value={84} max={100} color="var(--foreground)" unit="%" />
              <Bar label="Protein" value={61} max={100} color="var(--foreground)" unit="%" />
              <Bar label="Hydration" value={45} max={100} color="var(--vision-signal)" unit="%" />
              <Bar label="Mindful minutes" value={30} max={100} color="var(--foreground)" unit="%" />
            </GlassCard>
          </div>

          <div className="vision-column">
            <SectionLabel title="Quick capture" meta="4 actions" />
            <GlassCard className="vision-panel vision-actions">
              <QuickAction to="/scan" icon={Camera} label="Scan meal" meta="Nutrition capture" />
              <QuickAction to="/pedometer" icon={Footprints} label="Movement" meta="Daily activity" />
              <QuickAction to="/mood" icon={HeartPulse} label="Mood check" meta="Mental state" />
              <QuickAction to="/music" icon={Music} label="Sound" meta="Focus environment" />
            </GlassCard>

            <SectionLabel title="Now playing" meta="Focus" />
            <GlassCard className="vision-panel vision-player">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="vision-display-sm">Slow Interior</p>
                  <p className="vision-mono mt-2">KAYA REEVE · AMBIENT</p>
                </div>
                <Music className="size-5 opacity-45" strokeWidth={1.4} />
              </div>
              <div className="vision-wave" aria-hidden="true">
                {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: `${18 + Math.abs(Math.sin(i * 1.55)) * 68}%` }} className={i < 22 ? "active" : ""} />)}
              </div>
              <div className="vision-player-time"><span>02:14</span><span>05:38</span></div>
            </GlassCard>

            <SectionLabel title="Recovery" meta="Today" />
            <GlassCard className="vision-panel vision-recovery">
              <div className="vision-recovery-main">
                <Ring value={78} max={100} size={112} stroke={7} color="var(--foreground)" track="var(--muted)">
                  <span className="vision-ring-value">78</span>
                  <span className="vision-ring-label">READY</span>
                </Ring>
                <div>
                  <p className="vision-display-sm">Moderate load</p>
                  <p className="vision-muted">Recovery is steady. Keep the evening session controlled.</p>
                </div>
              </div>
              <div className="vision-data-list">
                <DataLine icon={Moon} label="Sleep debt" value="-42 min" />
                <DataLine icon={HeartPulse} label="HRV" value="64 ms" meta="7-day avg 61" />
                <DataLine icon={BarChart3} label="Readiness" value="78" meta="Moderate load advised" />
              </div>
            </GlassCard>
          </div>
        </section>

        <section className="vision-bottom-note">
          <div className="flex items-center gap-3">
            <Sparkles className="size-4" strokeWidth={1.4} />
            <span>VISION UI / STATIC PRESENTATION LAYER</span>
          </div>
          <span>Backend connection intentionally deferred.</span>
        </section>
      </main>

      <nav className="vision-mobile-dock">
        <Link to="/vision"><BarChart3 /></Link>
        <Link to="/scan"><Camera /></Link>
        <Link to="/pedometer"><Footprints /></Link>
        <Link to="/music"><Music /></Link>
        <Link to="/profile"><span className="vision-dock-mark">WK</span></Link>
      </nav>
    </div>
  );
}

function Metric({ label, value, unit, delta }: { label: string; value: string; unit: string; delta?: string }) {
  return (
    <div className="vision-metric">
      <span className="vision-eyebrow">{label}</span>
      <div><strong>{value}</strong><small>{unit}</small>{delta && <em>{delta}</em>}</div>
    </div>
  );
}

function SectionLabel({ title, meta }: { title: string; meta: string }) {
  return <div className="vision-section-label"><span>{title}</span><small>{meta}</small></div>;
}

function QuickAction({ to, icon: Icon, label, meta }: { to: string; icon: typeof Camera; label: string; meta: string }) {
  return (
    <Link to={to} className="vision-action-row">
      <span className="vision-action-icon"><Icon className="size-4" strokeWidth={1.5} /></span>
      <span><strong>{label}</strong><small>{meta}</small></span>
      <ArrowUpRight className="vision-action-arrow" />
    </Link>
  );
}

function DataLine({ icon: Icon, label, value, meta }: { icon: typeof Moon; label: string; value: string; meta?: string }) {
  return (
    <div className="vision-data-line">
      <Icon className="size-4" strokeWidth={1.4} />
      <span><strong>{label}</strong>{meta && <small>{meta}</small>}</span>
      <b>{value}</b>
    </div>
  );
}
