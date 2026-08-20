import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";
export const Route = createFileRoute("/workout")({ head: () => ({ meta: [{ title: "Workout — WK Health" }] }), component: () => <VisionPage page="workout" /> });