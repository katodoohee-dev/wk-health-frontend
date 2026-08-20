import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/pedometer")({ head: () => ({ meta: [{ title: "Pedometer — WK Health" }] }), component: () => <VisionPage page="pedometer" /> });