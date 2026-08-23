import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AppShell as BaseShell } from '@/components/app/app-shell';

export function AppShell({ children, eyebrow, title, wide: _wide }: { children: ReactNode; eyebrow?: string; title?: string; wide?: boolean }) {
  return <BaseShell>
    <div className="wk-page py-8">
      {(eyebrow || title) && <header className="mb-8 border-b border-border pb-6">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h1 className="display mt-2 text-5xl">{title}</h1>}
      </header>}
      {children}
    </div>
  </BaseShell>;
}

export { Link };
