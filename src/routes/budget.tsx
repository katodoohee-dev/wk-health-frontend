import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/budget")({ head: () => ({ meta: [{ title: "Budget — WK Health" }] }), component: () => <VisionPage page="budget" /> });