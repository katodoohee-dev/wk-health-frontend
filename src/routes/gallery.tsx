import { createFileRoute } from '@tanstack/react-router';
import { PrototypeScreen } from '@/components/wk/prototype-screens';
export const Route=createFileRoute('/gallery')({component:()=> <PrototypeScreen page="gallery"/>});
