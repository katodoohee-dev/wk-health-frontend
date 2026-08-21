import { createFileRoute } from '@tanstack/react-router';
import { LiveSoundControl } from '@/components/wk/live-sound-control';
export const Route=createFileRoute('/sound-control')({component:LiveSoundControl});
