import { createFileRoute } from '@tanstack/react-router';
import { VisionPage } from '@/components/wk/vision-page';
export const Route=createFileRoute('/budget')({component:()=> <VisionPage page="budget"/>});
