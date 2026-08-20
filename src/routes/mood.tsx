import { createFileRoute } from '@tanstack/react-router';
import { MobileMood } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/mood')({component:MobileMood});
