import { createFileRoute } from '@tanstack/react-router';
import { Health } from '@/components/wk-design';

export const Route = createFileRoute('/home')({ component: Health });
