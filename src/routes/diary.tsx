import { createFileRoute } from '@tanstack/react-router';
import { MobileDiary } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/diary')({component:MobileDiary});
