import { createFileRoute } from '@tanstack/react-router';
import { SoundControl } from '@/components/wk/sound-control';

export const Route = createFileRoute('/sound-control')({ component: SoundControl });
