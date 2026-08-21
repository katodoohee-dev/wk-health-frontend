import { createFileRoute } from '@tanstack/react-router';
import { Assistant as DesktopAssistant } from '@/components/wk-design';
import { MobileAssistant } from '@/components/wk/mobile-pages';
export const Route=createFileRoute('/assistant')({component:()=> <><div className="hidden lg:block"><DesktopAssistant/></div><div className="lg:hidden"><MobileAssistant/></div></>});
