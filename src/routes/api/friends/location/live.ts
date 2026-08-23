import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, getConfirmedFriendIds, json, mapError } from "@/lib/server/friend-location-auth";
import { getFreshLocations } from "@/lib/server/friend-location-store";

export const Route = createFileRoute("/api/friends/location/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { token } = await authenticateRequest(request);
          const friendIds = await getConfirmedFriendIds(token);
          return json(getFreshLocations(friendIds));
        } catch (error) {
          return mapError(error);
        }
      },
    },
  },
});
