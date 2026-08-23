import { useEffect, useState } from 'react';
import { AppShell } from './app-shell';
import { Action, Panel, PageHeader, StatusIndicator } from './ui';
import { apiFetch } from '@/lib/api';

type SoundSettings = {
  mode?: string;
  volume?: number;
  voiceEnabled?: boolean;
  outputDevice?: string | null;
  inputDevice?: string | null;
};

export function SoundControl() {
  const [settings, setSettings] = useState<SoundSettings>({ mode: 'ambient', volume: 68, voiceEnabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<any>('/api/sound');
      setSettings(response?.settings ?? response ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sound settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(next: SoundSettings) {
    setSettings(next);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch<any>('/api/sound', { method: 'PUT', body: next });
      setSettings(response?.settings ?? next);
      setNotice('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save sound settings');
      await load();
    } finally {
      setSaving(false);
    }
  }

  const volume = Math.max(0, Math.min(100, Number(settings.volume ?? 68)));

  return (
    <AppShell eyebrow="Sound system" title="Sound control" wide>
      <div className="sound-control-page">
        <PageHeader
          eyebrow="AUDIO / CONTROL"
          title="Control the system tone."
          description="The latest WK Health sound-control system is restored and writes directly to the existing sound endpoint."
          actions={<div className="flex items-center gap-2"><StatusIndicator label={loading ? 'SYNCING' : error ? 'OFFLINE' : 'LIVE'} state={error ? 'warn' : 'live'} /><Action size="sm" onClick={() => void load()} disabled={loading}>Refresh</Action></div>}
        />

        <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Panel className="rounded-none shadow-none">
            <div className="flex items-end justify-between border-b border-border pb-5">
              <div>
                <p className="eyebrow">MASTER VOLUME</p>
                <div className="numeric mt-2 text-6xl leading-none">{volume}<span className="ml-2 text-sm text-muted-foreground">%</span></div>
              </div>
              <span className="numeric text-[10px] text-muted-foreground">{saving ? 'SAVING' : notice || 'LIVE'}</span>
            </div>

            <div className="py-8">
              <input
                aria-label="Master volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))}
                onMouseUp={() => void save(settings)}
                onTouchEnd={() => void save(settings)}
                className="sound-slider"
              />
              <div className="mt-3 flex justify-between text-[9px] text-muted-foreground"><span>0</span><span>50</span><span>100</span></div>
            </div>

            <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
              {['ambient', 'focus', 'quiet'].map((mode) => {
                const active = String(settings.mode ?? 'ambient') === mode;
                return <button key={mode} type="button" onClick={() => void save({ ...settings, mode })} className={`sound-mode ${active ? 'is-active' : ''}`} aria-pressed={active}>{mode}</button>;
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void save({ ...settings, voiceEnabled: !settings.voiceEnabled })} className={`sound-toggle ${settings.voiceEnabled ? 'is-active' : ''}`} aria-pressed={Boolean(settings.voiceEnabled)}>
                <span><b>Voice output</b><small>{settings.voiceEnabled ? 'Enabled' : 'Muted'}</small></span><i aria-hidden="true" />
              </button>
              <div className="sound-info"><span>Output</span><b>{settings.outputDevice || 'System default'}</b></div>
            </div>
          </Panel>

          <aside className="space-y-6">
            <Panel className="rounded-none shadow-none">
              <p className="eyebrow">SYSTEM STATE</p>
              <div className="mt-4 divide-y divide-border">
                <div className="flex items-center justify-between py-4 text-xs"><span>Mode</span><b className="numeric">{String(settings.mode ?? 'ambient').toUpperCase()}</b></div>
                <div className="flex items-center justify-between py-4 text-xs"><span>Volume</span><b className="numeric">{volume}%</b></div>
                <div className="flex items-center justify-between py-4 text-xs"><span>Voice</span><b>{settings.voiceEnabled ? 'ON' : 'OFF'}</b></div>
                <div className="flex items-center justify-between py-4 text-xs"><span>Backend</span><b>{error ? 'ERROR' : 'CONNECTED'}</b></div>
              </div>
            </Panel>
            {error && <Panel className="rounded-none shadow-none"><p className="eyebrow">ERROR</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{error}</p></Panel>}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
