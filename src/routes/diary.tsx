import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/diary")({ head: () => ({ meta: [{ title: "Diary — WK Health" }] }), component: () => <VisionPage page="diary" /> });