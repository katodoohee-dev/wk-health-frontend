import { createFileRoute } from '@tanstack/react-router';
import { LiveAuth } from '@/components/wk/live-auth';
export const Route=createFileRoute('/auth')({component:LiveAuth});
