import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/nlp")({ head: () => ({ meta: [{ title: "Language — WK Health" }] }), component: () => <VisionPage page="nlp" /> });