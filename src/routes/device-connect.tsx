import { createFileRoute } from '@tanstack/react-router';
import { LiveDeviceConnect } from '@/components/wk/live-device-connect';
export const Route=createFileRoute('/device-connect')({component:LiveDeviceConnect});
