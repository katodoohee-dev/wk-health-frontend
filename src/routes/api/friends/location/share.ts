import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, backendUrl, json, mapError } from "@/lib/server/friend-location-auth";
import { setShare } from "@/lib/server/friend-location-store";

export const Route = createFileRoute("/api/friends/location/share")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { user, token } = await authenticateRequest(request);
          const body = await request.json().catch(() => ({} as Record<string, unknown>));
          const enabled = body?.enabled === true;
          if (enabled) {
            const raw = await fetch(`${backendUrl()}/friends`, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
            if (!raw.ok) return json({ success: false, error: "ไม่สามารถตรวจสอบรายชื่อเพื่อนได้" }, 503);
            const friends = await raw.json();
            const list = Array.isArray(friends) ? friends : friends?.friends || friends?.data || [];
            if (!Array.isArray(list)) return json({ success: false, error: "ข้อมูลเพื่อนไม่ถูกต้อง" }, 503);
            if (list.length === 0) return json({ success: false, error: "ต้องมีเพื่อนที่ยืนยันแล้วก่อนจึงจะแชร์ตำแหน่งได้" }, 403);
          }
          const state = setShare(user.id, enabled);
          return json({ success: true, enabled: state.enabled, visibleToConfirmedFriends: state.enabled, updatedAt: state.updatedAt });
        } catch (error) {
          return mapError(error);
        }
      },
    },
  },
});
