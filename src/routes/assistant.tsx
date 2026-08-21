import { createFileRoute } from '@tanstack/react-router';
import { Assistant as DesktopAssistant } from '@/components/wk-design';
import { MobileLiveAssistant } from '@/components/wk/mobile-live-assistant';
export const Route=createFileRoute('/assistant')({component:()=> <><div className="hidden lg:block"><DesktopAssistant/></div><div className="lg:hidden"><MobileLiveAssistant/></div></>});
