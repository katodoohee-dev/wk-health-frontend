import { createFileRoute } from '@tanstack/react-router';
import { LiveGallery } from '@/components/wk/live-gallery';
export const Route=createFileRoute('/gallery')({component:LiveGallery});
