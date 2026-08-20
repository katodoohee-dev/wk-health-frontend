import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/device-connect")({ head: () => ({ meta: [{ title: "Devices — WK Health" }] }), component: () => <VisionPage page="device-connect" /> });