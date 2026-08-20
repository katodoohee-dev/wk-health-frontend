import { createFileRoute } from '@tanstack/react-router';
import { Stats as DesktopStats } from '@/components/wk-design';
import { MobileStats } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/stats')({component:()=> <><div className="hidden lg:block"><DesktopStats/></div><MobileStats/></>});
