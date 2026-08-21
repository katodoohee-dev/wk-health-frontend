import { createFileRoute } from '@tanstack/react-router';
import { VisionStats } from '@/components/wk/vision-stats';
import { MobileStats } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/stats')({component:()=> <><div className="hidden lg:block"><VisionStats/></div><div className="lg:hidden"><MobileStats/></div></>});
