import { createFileRoute } from '@tanstack/react-router';
import { MobileWorkout } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/workout')({component:MobileWorkout});
