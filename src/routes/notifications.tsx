import { createFileRoute } from '@tanstack/react-router';
import { Notifications } from '@/components/wk-design';

export const Route = createFileRoute('/notifications')({ component: Notifications });
