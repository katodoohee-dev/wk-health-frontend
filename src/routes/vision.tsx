import { createFileRoute } from '@tanstack/react-router';
import { LiveDataPage } from '@/components/wk/live-data-page';

export const Route = createFileRoute('/vision')({ component: () => <LiveDataPage page="vision" /> });
