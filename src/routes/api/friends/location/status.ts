import { createFileRoute } from "@tanstack/react-router";
import { getShare } from "@/lib/server/friend-location-store";
import { authenticateRequest, json, mapError } from "@/lib/server/friend-location-auth";

export const Route = createFileRoute("/api/friends/location/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { user } = await authenticateRequest(request);
          const share = getShare(user.id);
          return json({ success: true, enabled: share.enabled, visibleToConfirmedFriends: share.enabled, updatedAt: share.updatedAt });
        } catch (error) {
          return mapError(error);
        }
      },
    },
  },
});
