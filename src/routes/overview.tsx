import { createFileRoute } from '@tanstack/react-router';
import { VisionOverview } from '@/components/wk/vision-overview';
import { MobileOverview } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/overview')({component:()=> <><div className="hidden lg:block"><VisionOverview/></div><div className="lg:hidden"><MobileOverview/></div></>});
