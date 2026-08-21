import { createFileRoute } from '@tanstack/react-router';
import { LiveDataPage } from '@/components/wk/live-data-page';

export const Route = createFileRoute('/notifications')({ component: () => <LiveDataPage page="notifications" /> });
