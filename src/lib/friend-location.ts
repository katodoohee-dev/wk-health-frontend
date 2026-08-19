import {
  apiFriendLocationPublish,
  apiFriendLocationShare,
  apiFriendLocationSharingStatus,
} from "@/lib/api-new-features";
import { featureFlags } from "@/lib/feature-flags";

type LocationState = {
  enabled: boolean;
  watching: boolean;
  lastError: string | null;
};

let watchId: number | null = null;
let publishTimer: number | null = null;
let latest: Omit<GeolocationCoordinates, "toJSON"> & { timestamp: number } | null = null;

const state: LocationState = { enabled: false, watching: false, lastError: null };

function emitState() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wk:friend-location-state", { detail: { ...state } }));
}

function clearWatch() {
  if (watchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  if (publishTimer != null && typeof window !== "undefined") window.clearInterval(publishTimer);
  publishTimer = null;
  state.watching = false;
}

async function publishNow() {
  if (!state.enabled || !latest) return;
  try {
    await apiFriendLocationPublish({
      friendId: "self",
      lat: latest.latitude,
      lng: latest.longitude,
      accuracy: latest.accuracy,
      heading: latest.heading ?? undefined,
      speedMps: latest.speed ?? undefined,
    });
    state.lastError = null;
  } catch (error) {
    // Backend may not exist yet; never let location sharing crash the app.
    state.lastError = error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ";
  }
  emitState();
}

export async function startFriendLocationSharing() {
  if (!featureFlags.locationSharing) {
    state.lastError = "ระบบแชร์ตำแหน่งยังไม่เปิดใช้งาน";
    emitState();
    return false;
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    state.lastError = "อุปกรณ์นี้ไม่รองรับ GPS ในเว็บ";
    emitState();
    return false;
  }

  try {
    await apiFriendLocationShare(true);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "เปิดแชร์ตำแหน่งไม่สำเร็จ";
    emitState();
    return false;
  }

  state.enabled = true;
  clearWatch();
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      latest = { ...position.coords, timestamp: position.timestamp } as typeof latest;
      state.lastError = null;
      emitState();
      void publishNow();
    },
    (error) => {
      state.lastError = error.code === error.PERMISSION_DENIED
        ? "กรุณาอนุญาต GPS เพื่อแชร์ตำแหน่ง"
        : "อ่าน GPS ไม่สำเร็จ";
      emitState();
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );
  state.watching = true;
  if (typeof window !== "undefined") {
    publishTimer = window.setInterval(() => void publishNow(), 5000);
  }
  emitState();
  return true;
}

export async function stopFriendLocationSharing() {
  clearWatch();
  state.enabled = false;
  try {
    await apiFriendLocationShare(false);
    state.lastError = null;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "ปิดแชร์ตำแหน่งไม่สำเร็จ";
  }
  emitState();
  return true;
}

export async function hydrateFriendLocationSharingStatus() {
  if (!featureFlags.locationSharing) return null;
  try {
    const remote = await apiFriendLocationSharingStatus();
    state.enabled = Boolean(remote.enabled && remote.visibleToConfirmedFriends);
    emitState();
    return remote;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "อ่านสถานะการแชร์ตำแหน่งไม่สำเร็จ";
    emitState();
    return null;
  }
}

export function getFriendLocationSharingState() {
  return { ...state };
}
