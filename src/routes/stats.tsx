import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/stats")({ head: () => ({ meta: [{ title: "Stats — WK Health" }] }), component: () => <VisionPage page="stats" /> });