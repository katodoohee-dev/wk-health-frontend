import { createFileRoute } from '@tanstack/react-router';
import { Scan } from '@/components/wk-design';

export const Route = createFileRoute('/scan')({ component: Scan });
