import { createFileRoute } from '@tanstack/react-router';
import { MobilePedometer } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/pedometer')({component:MobilePedometer});
