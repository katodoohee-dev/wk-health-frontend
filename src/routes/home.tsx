import { createFileRoute } from '@tanstack/react-router';
import { LiveHealthOverview } from '@/components/wk/live-design-pages';

export const Route = createFileRoute('/home')({ component: LiveHealthOverview });
