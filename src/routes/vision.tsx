import { createFileRoute } from '@tanstack/react-router';
import { VisionUI } from '@/components/wk/vision-ui';
import { MobileVision } from '@/components/wk/vision-mobile-extra';
export const Route=createFileRoute('/vision')({component:()=> <><div className="hidden lg:block"><VisionUI/></div><div className="lg:hidden"><MobileVision/></div></>});
