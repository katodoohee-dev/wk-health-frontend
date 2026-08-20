import { createFileRoute } from '@tanstack/react-router';
import { Vision } from '@/components/wk-design';
export const Route=createFileRoute('/vision')({component:()=> <Vision/>});
