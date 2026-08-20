import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/export")({ head: () => ({ meta: [{ title: "Export — WK Health" }] }), component: () => <VisionPage page="export" /> });