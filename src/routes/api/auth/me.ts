import { createFileRoute } from "@tanstack/react-router";
import { proxyBackend } from "@/lib/server/backend-proxy";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: ({ request }) => proxyBackend(request, "/api/auth/me", "GET"),
      PATCH: ({ request }) => proxyBackend(request, "/api/auth/me", "PATCH"),
    },
  },
});
