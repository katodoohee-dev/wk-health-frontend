import { createFileRoute } from '@tanstack/react-router';
import { MobileLanguage } from '@/components/wk/mobile-pages';
import { VisionPage } from '@/components/wk/vision-page';
export const Route=createFileRoute('/nlp')({component:()=> <><div className="hidden lg:block"><VisionPage page="nlp"/></div><div className="lg:hidden"><MobileLanguage/></div></>});
