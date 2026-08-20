import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/scan")({ head: () => ({ meta: [{ title: "Scan — WK Health" }] }), component: () => <VisionPage page="scan" /> });