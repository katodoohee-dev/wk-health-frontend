import { createFileRoute } from '@tanstack/react-router';
import { LiveScanPage } from '@/components/wk/live-scan-page';
export const Route=createFileRoute('/scan')({component:LiveScanPage});
