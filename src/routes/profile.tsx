import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/profile")({ head: () => ({ meta: [{ title: "Profile — WK Health" }] }), component: () => <VisionPage page="profile" /> });