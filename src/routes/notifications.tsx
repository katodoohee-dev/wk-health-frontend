import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/notifications")({ head: () => ({ meta: [{ title: "Notifications — WK Health" }] }), component: () => <VisionPage page="notifications" /> });