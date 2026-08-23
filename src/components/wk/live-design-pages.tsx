import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AppShell } from '@/components/wk/app-shell';
import { Chip, Eyebrow, Metric, Panel, ProgressRing, SectionHeader, StackedBar } from '@/components/wk/primitives';
import { activityWeek as fallbackWeek, insights, rings as fallbackRings, sleep, vitals as fallbackVitals } from '@/lib/wk-data';
import { apiFetch } from '@/lib/api';

type AnyRecord = Record<string, any>;
const n = (value: any, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pick = (obj: AnyRecord | null | undefined, ...keys: string[]) => {
  for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  return null;
};

export function LiveHealthOverview() {
  const [today, setToday] = useState<AnyRecord | null>(null);
  const [weekly, setWeekly] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [todayResponse, weeklyResponse] = await Promise.all([
          apiFetch('/api/stats/today'),
          apiFetch('/api/stats/weekly'),
        ]);
        if (cancelled) return;
        setToday((todayResponse?.totals ?? todayResponse?.data ?? todayResponse ?? {}) as AnyRecord);
        setWeekly(Array.isArray(weeklyResponse?.days) ? weeklyResponse.days : Array.isArray(weeklyResponse) ? weeklyResponse : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Live health data unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const liveVitals = useMemo(() => {
    const calories = n(pick(today, 'calories', 'eaten'), fallbackVitals[0].value);
    const protein = n(pick(today, 'protein', 'totalProtein'), fallbackVitals[2].value);
    const burned = n(pick(today, 'burned'), 0);
    return fallbackVitals.map((v, index) => {
      if (index === 0) return { ...v, value: calories || v.value, unit: 'kcal', delta: error ? v.delta : 'LIVE' };
      if (index === 2) return { ...v, value: protein || v.value, unit: 'g', delta: error ? v.delta : 'LIVE' };
      if (index === 3 && burned > 0) return { ...v, value: Math.round(burned), unit: 'kcal', delta: 'LIVE' };
      return v;
    });
  }, [today, error]);

  const bars = useMemo(() => {
    if (!weekly.length) return fallbackWeek;
    const values = weekly.map(row => n(pick(row, 'calories', 'kcal', 'burn', 'steps')));
    const max = Math.max(...values, 1);
    return weekly.slice(-7).map((row, index) => ({
      day: String(row.day ?? fallbackWeek[index]?.day ?? index + 1).slice(-2),
      value: Math.max(5, Math.round((n(pick(row, 'calories', 'kcal', 'burn', 'steps')) / max) * 100)),
    }));
  }, [weekly]);

  return <AppShell eyebrow="Wednesday · 19 August" title="Health overview">
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <Panel className="grain">
        <div className="flex gap-2"><Chip tone="signal">{loading ? 'Syncing…' : error ? 'Offline fallback' : 'Live systems nominal'}</Chip><Chip>{error ? 'Using last known design data' : 'Backend synced'}</Chip></div>
        <Eyebrow>Readiness index</Eyebrow>
        <div className="numeric mt-3 text-8xl">87 <small className="text-sm">/100</small></div>
        <p className="mt-5 max-w-lg text-sm text-muted-foreground">Recovery is ahead of load. Nutrition and activity totals below are connected to the authenticated WK Health account.</p>
        <Link to="/assistant" className="mt-6 inline-flex rounded-full bg-foreground px-5 py-3 text-sm text-background">Ask WK about today ↗</Link>
      </Panel>
      <div className="grid grid-cols-2 gap-6">{liveVitals.map(v => <Panel key={v.id}><Metric label={v.label} value={v.value} unit={v.unit} delta={v.delta} trend={v.trend}/></Panel>)}</div>
    </div>
    <section className="mt-14">
      <SectionHeader eyebrow="Today" title="Movement rings"/>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel className="flex justify-around">{fallbackRings.map(r => <ProgressRing key={r.id} {...r} size={120}/>)}</Panel>
        <Panel><Eyebrow>Activity · this week</Eyebrow><p className="numeric mt-2 text-4xl">{weekly.length ? Math.round(weekly.reduce((sum, row) => sum + n(pick(row, 'steps', 'burn', 'calories', 'kcal')), 0)) : 411}</p><div className="mt-8"><div className="flex items-end gap-2">{bars.map(x => <i key={x.day} title={x.day} className="flex-1 bg-foreground" style={{height:`${x.value}%`}}/>)}</div></div></Panel>
      </div>
    </section>
    <section className="mt-14 grid gap-6 lg:grid-cols-2"><Panel><Eyebrow>Sleep · last night</Eyebrow><p className="numeric mt-2 text-4xl">{sleep.score}</p><div className="mt-6"><StackedBar segments={sleep.stages}/></div></Panel><div><SectionHeader eyebrow="Signals" title="What WK noticed"/><div className="divide-y divide-border">{insights.map(i => <div key={i.id} className="py-5"><Eyebrow>{i.tag}</Eyebrow><h3 className="display mt-2 text-xl">{i.title}</h3><p className="mt-2 text-sm text-muted-foreground">{i.body}</p></div>)}</div></div></section>
  </AppShell>;
}

export function LiveStatsDesign() {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void apiFetch('/api/stats/weekly').then((response: AnyRecord) => {
      setRows(Array.isArray(response?.days) ? response.days : []);
    }).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  const values = rows.length ? rows.slice(-12).map(row => n(pick(row, 'calories', 'kcal', 'burn', 'steps'))) : [];
  const max = Math.max(...values, 1);
  return <AppShell eyebrow="Analysis · 12 weeks" title="The long line, not the spike.">
    <div className="grid grid-cols-2 gap-6"><Panel><Eyebrow>ACTIVITY · LIVE</Eyebrow><strong className="numeric mt-4 block text-5xl">{loading ? '…' : rows.length}</strong><span className="text-xs text-muted-foreground">days returned</span></Panel><Panel><Eyebrow>DATA SOURCE</Eyebrow><strong className="numeric mt-4 block text-5xl">API</strong><span className="text-xs text-muted-foreground">authenticated account</span></Panel></div>
    <Panel className="mt-6"><SectionHeader eyebrow="Live weekly trend" title="Active load"/>{values.length ? <div className="mt-8 flex h-48 items-end gap-3">{values.map((value, index) => <i key={index} className="flex-1 bg-foreground" style={{height:`${Math.max(5,(value/max)*100)}%`}} title={String(value)}/>)}</div> : <p className="mt-8 text-sm text-muted-foreground">No weekly records yet.</p>}</Panel>
  </AppShell>;
}
