import { createFileRoute } from '@tanstack/react-router';
import { VisionOverview } from '@/components/wk/vision-overview';

export const Route = createFileRoute('/home')({ component: VisionOverview });
