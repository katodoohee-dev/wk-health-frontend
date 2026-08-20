import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/music")({ head: () => ({ meta: [{ title: "Music — WK Health" }] }), component: () => <VisionPage page="music" /> });