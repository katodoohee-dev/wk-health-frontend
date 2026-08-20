import { createFileRoute } from "@tanstack/react-router";
import { VisionPage } from "@/components/wk/vision-page";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — WK Health" }] }),
  component: () => <VisionPage page="settings" />,
});
