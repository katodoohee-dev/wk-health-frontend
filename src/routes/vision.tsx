import { createFileRoute } from '@tanstack/react-router';
import { PrototypeScreen } from '@/components/wk/prototype-screens';
export const Route=createFileRoute('/vision')({component:()=> <PrototypeScreen page="vision"/>});
