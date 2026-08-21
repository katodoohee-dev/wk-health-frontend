import { createFileRoute } from '@tanstack/react-router';
import { VisionPage } from '@/components/wk/vision-page';
export const Route=createFileRoute('/gallery')({component:()=> <VisionPage page="gallery"/>});
