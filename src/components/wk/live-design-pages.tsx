import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AppShell } from '@/components/wk/app-shell';
import { Chip, Eyebrow, Metric, Panel, ProgressRing, SectionHeader, StackedBar } from '@/components/wk/primitives';
import { apiFetch } from '@/lib/api';
import '../wk-design.css';

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
    const calorieValue = pick(today, 'calories', 'eaten', 'totalCalories');
    const proteinValue = pick(today, 'protein', 'totalProtein');
    const burnedValue = pick(today, 'burned', 'burn');
    const goalValue = pick(today, 'goalKcal', 'goal');
    return [
      { id: 'cal', label: 'Calories', value: calorieValue ?? '—', unit: 'kcal', delta: error ? 'OFFLINE' : 'LIVE', trend: [] },
      { id: 'goal', label: 'Goal', value: goalValue ?? '—', unit: 'kcal', delta: 'ACCOUNT', trend: [] },
      { id: 'protein', label: 'Protein', value: proteinValue ?? '—', unit: 'g', delta: error ? 'OFFLINE' : 'LIVE', trend: [] },
      { id: 'burn', label: 'Burned', value: burnedValue ?? '—', unit: 'kcal', delta: error ? 'OFFLINE' : 'LIVE', trend: [] },
    ];
  }, [today, error]);

  const bars = useMemo(() => {
    if (!weekly.length) return Array.from({ length: 7 }, () => ({ day: '—', value: 0 }));
    const values = weekly.slice(-7).map(row => n(pick(row, 'calories', 'kcal', 'burn', 'steps')));
    const max = Math.max(...values, 1);
    return weekly.slice(-7).map((row, index) => ({
      day: String(row.day ?? index + 1).slice(-2),
      value: Math.round((n(pick(row, 'calories', 'kcal', 'burn', 'steps')) / max) * 100),
    }));
  }, [weekly]);

  const ringBase = n(pick(today, 'steps'), 0);
  const ringGoal = Math.max(n(pick(today, 'stepGoal', 'goalSteps'), 10000), 1);
  const readiness = pick(today, 'readiness', 'score');
  const sleepScore = pick(today, 'sleepScore', 'sleep');

  return <AppShell eyebrow="Wednesday · 19 August" title="Health overview">
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <Panel className="readiness grain">
        <div className="pills"><b>{loading ? 'SYNCING' : error ? 'BACKEND OFFLINE' : 'ALL SYSTEMS NOMINAL'}</b><span>{error ? 'RETRY AVAILABLE' : 'BACKEND SYNCED'}</span></div>
        <Eyebrow>Readiness index</Eyebrow>
        <div className="big-number">{readiness ?? '—'} <small>/100</small></div>
        <p>Live recovery, nutrition and movement totals are loaded from the authenticated WK Health account. No sample values are inserted when the account has no data.</p>
        <Link to="/assistant" className="black-btn inline-flex mt-6">Ask WK about today ↗</Link>
      </Panel>
      <div className="metric-grid">{liveVitals.map(v => <Panel key={v.id}><Metric label={v.label} value={v.value} unit={v.unit} delta={v.delta} trend={v.trend}/></Panel>)}</div>
    </div>
    <section>
      <SectionHeader eyebrow="Today" title="Movement rings" />
      <div className="wk-two-col">
        <Panel><div className="rings-row">{[['MOVE', ringBase, ringGoal], ['EXERCISE', n(pick(today, 'activeMinutes'), 0), 60], ['STAND', n(pick(today, 'standingHours'), 0), 12]].map(([label,value,goal]) => <div className="ring" key={String(label)}><div><b>{value || '—'}</b><small> / {goal}</small></div><strong>{label}</strong><span>LIVE ACCOUNT</span></div>)}</div></Panel>
        <Panel><Eyebrow>Activity · this week</Eyebrow><div className="active-number">{weekly.length ? Math.round(weekly.reduce((sum, row) => sum + n(pick(row, 'steps', 'burn', 'calories', 'kcal')), 0)) : '—'} <small>{weekly.length ? 'TOTAL' : 'NO DATA'}</small></div><div className="wk-bars">{bars.map((x, index) => <i key={index} title={x.day} style={{height:`${Math.max(x.value,2)}%`}} />)}</div><div className="days">{bars.map(x => x.day).join('   ')}</div></Panel>
      </div>
    </section>
    <section className="lower wk-two-col">
      <Panel><Eyebrow>Sleep · last night</Eyebrow><div className="sleep-num">{sleepScore ?? '—'} <small>LIVE</small></div><div className="sleep-bar" aria-hidden="true"><i/><i/><i/><i/></div><p className="legend">Sleep stages appear here when the account has sleep-stage data.</p></Panel>
      <div className="signals"><SectionHeader eyebrow="Signals" title="What WK noticed"/><div className="signal"><Eyebrow>RECOVERY</Eyebrow><h3>{error ? 'Backend unavailable' : readiness == null ? 'Waiting for recovery data' : `Readiness ${readiness}`}</h3><p>{error ? error : 'This section is driven by the live account and remains empty until the backend returns a signal.'}</p></div><div className="signal"><Eyebrow>LOAD</Eyebrow><h3>Activity trend</h3><p>{weekly.length ? 'Weekly activity data is available from the authenticated account.' : 'No weekly activity records yet.'}</p></div></div>
    </section>
  </AppShell>;
}

export function LiveStatsDesign() {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void apiFetch('/api/stats/weekly').then((response: AnyRecord) => {
      setRows(Array.isArray(response?.days) ? response.days : []);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Stats unavailable')).finally(() => setLoading(false));
  }, []);
  const values = rows.map(row => n(pick(row, 'calories', 'kcal', 'burn', 'steps'))).slice(-12);
  const max = Math.max(...values, 1);
  return <AppShell eyebrow="Analysis · 12 weeks" title="The long line, not the spike.">
    <div className="stats-metrics">
      <div><Eyebrow>RECORDS</Eyebrow><strong>{rows.length || '—'}</strong><span>{error ? 'OFFLINE' : 'LIVE'}</span></div>
      <div><Eyebrow>PERIOD</Eyebrow><strong>{rows.length ? rows.length : '—'}</strong><span>days returned</span></div>
      <div><Eyebrow>AVERAGE</Eyebrow><strong>{rows.length ? Math.round(rows.reduce((s, r) => s + n(pick(r, 'calories', 'kcal')), 0) / rows.length) : '—'}</strong><span>kcal</span></div>
      <div><Eyebrow>STATUS</Eyebrow><strong>{loading ? '…' : error ? 'OFF' : 'LIVE'}</strong><span>server</span></div>
    </div>
    <Panel className="wk-card"><div className="wk-section-head"><div><Eyebrow>Live weekly trend</Eyebrow><h2>Active load</h2></div><span>{rows.length ? 'API' : 'EMPTY'}</span></div><div className="wk-bars">{Array.from({length:12}, (_, index) => <i key={index} style={{height: values.length ? `${Math.max((values[index] ?? 0) / max * 100, 2)}%` : '2%'}} />)}</div></Panel>
    {error && <Panel className="mt-5"><Eyebrow>ERROR</Eyebrow><p className="mt-2 text-sm text-muted-foreground">{error}</p></Panel>}
  </AppShell>;
}
