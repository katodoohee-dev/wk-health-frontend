import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/friends")({ head: () => ({ meta: [{ title: "Friends — WK Health" }] }), component: () => <VisionPage page="friends" /> });