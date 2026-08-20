import { createFileRoute } from "@tanstack/react-router";
import { proxyBackend } from "@/lib/server/backend-proxy";

export const Route = createFileRoute("/api/auth/register")({
  server: { handlers: { POST: ({ request }) => proxyBackend(request, "/api/auth/register", "POST") } },
});
