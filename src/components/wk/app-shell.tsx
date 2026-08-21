import type { ReactNode } from 'react';
import { AppShell as DesignShell } from './shell';

export function AppShell({ children, title, eyebrow: _eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  return <DesignShell title={title}>{children}</DesignShell>;
}
