import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, json, mapError } from "@/lib/server/friend-location-auth";
import { publishLocation } from "@/lib/server/friend-location-store";

function finiteNumber(value: unknown, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export const Route = createFileRoute("/api/friends/location/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { user } = await authenticateRequest(request);
          const body = await request.json().catch(() => ({} as Record<string, unknown>));
          const lat = finiteNumber(body?.lat, -90, 90);
          const lng = finiteNumber(body?.lng, -180, 180);
          const accuracy = finiteNumber(body?.accuracy, 0, 10000);
          const heading = body?.heading == null ? undefined : finiteNumber(body.heading, 0, 360) ?? undefined;
          const speedMps = body?.speedMps == null ? undefined : finiteNumber(body.speedMps, 0, 100) ?? undefined;
          if (lat == null || lng == null || accuracy == null) return json({ success: false, error: "ข้อมูล GPS ไม่ถูกต้อง" }, 400);
          const location = publishLocation(user.id, { lat, lng, accuracy, heading, speedMps });
          return json({ success: true, updatedAt: location.updatedAt });
        } catch (error) {
          if (error instanceof Error && error.message === "LOCATION_SHARING_DISABLED") {
            return json({ success: false, error: "ยังไม่ได้เปิดแชร์ตำแหน่ง" }, 403);
          }
          return mapError(error);
        }
      },
    },
  },
});
