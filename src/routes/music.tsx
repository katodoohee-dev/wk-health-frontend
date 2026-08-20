import { createFileRoute } from '@tanstack/react-router';
import { Music as DesktopMusic } from '@/components/wk-design';
import { MobileMusic } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/music')({component:()=> <><div className="hidden lg:block"><DesktopMusic/></div><MobileMusic/></>});
