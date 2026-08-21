import { createFileRoute } from '@tanstack/react-router';
import { Vision } from '@/components/wk-design';
import { MobileVision } from '@/components/wk/vision-mobile-extra';
export const Route=createFileRoute('/vision')({component:()=> <><div className="hidden lg:block"><Vision/></div><div className="lg:hidden"><MobileVision/></div></>});
