import { createFileRoute } from '@tanstack/react-router';
import { LiveStatsDesign } from '@/components/wk/live-design-pages';

export const Route = createFileRoute('/stats')({ component: LiveStatsDesign });
