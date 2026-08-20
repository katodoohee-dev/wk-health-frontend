import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/gallery")({ head: () => ({ meta: [{ title: "Gallery — WK Health" }] }), component: () => <VisionPage page="gallery" /> });