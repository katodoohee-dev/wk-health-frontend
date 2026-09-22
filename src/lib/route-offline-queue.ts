// เก็บ/ซิงค์ "เส้นทางที่วิ่งเสร็จแล้วแต่ยังบันทึกขึ้น server ไม่สำเร็จ" (ไม่มีเน็ต/เน็ตหลุดตอนกดหยุด)
// ไว้ในเครื่องก่อน แล้วลองซิงค์ใหม่อัตโนมัติเมื่อกลับมามีเน็ต — ผู้ใช้ไม่ต้องรอเน็ตตอนวิ่งจบ
// และไม่เสียข้อมูลการวิ่งไปเฉยๆ ถ้าออฟไลน์อยู่ตอนนั้น
import { apiRouteStart, apiRouteStop, type GeoPoint } from "./api";

const STORAGE_KEY = "wk_pending_routes_v1";

export interface PendingRoute {
  localId: string;
  path: GeoPoint[];
  durationSeconds: number;
  // คำนวณไว้ล่วงหน้าฝั่ง client ตอนวิ่งจบ (เพื่อโชว์ผู้ใช้ทันทีแบบ real-time โดยไม่ต้องรอ server)
  distanceKm: number;
  kcal: number;
  createdAt: number;
}

function readQueue(): PendingRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingRoute[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingRoute[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage เต็ม/ถูกบล็อก — ไม่มีอะไรทำได้มากกว่านี้ ปล่อยผ่าน ไม่ทำให้แอปพัง
  }
}

export function getPendingRoutes(): PendingRoute[] {
  return readQueue();
}

export function enqueuePendingRoute(entry: Omit<PendingRoute, "localId" | "createdAt">): PendingRoute {
  const item: PendingRoute = { ...entry, localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() };
  writeQueue([item, ...readQueue()]);
  return item;
}

function removeFromQueue(localId: string) {
  writeQueue(readQueue().filter((r) => r.localId !== localId));
}

let flushing = false;

/**
 * ลองส่งเส้นทางที่ค้างอยู่ในคิวทั้งหมดขึ้น server อีกครั้ง (เรียกตอนแอปเปิด/ตอนกลับมามีเน็ต)
 * ทำทีละรายการกันยิง request รัว ๆ พร้อมกันตอนเน็ตเพิ่งกลับมา (มักไม่เสถียรช่วงแรก)
 */
export async function flushPendingRoutes(onSynced?: (localId: string) => void): Promise<void> {
  if (flushing || typeof window === "undefined" || !navigator.onLine) return;
  flushing = true;
  try {
    for (const item of readQueue()) {
      try {
        const routeId = await apiRouteStart();
        const routeIdNum = Number(routeId);
        await apiRouteStop({
          routeId: Number.isFinite(routeIdNum) ? String(routeIdNum) : routeId,
          path: item.path,
          durationSeconds: item.durationSeconds,
        });
        removeFromQueue(item.localId);
        onSynced?.(item.localId);
      } catch {
        // ยังส่งไม่ได้ (เน็ตยังไม่กลับมาจริง/server ล่มชั่วคราว) — เก็บไว้ในคิว ลองใหม่รอบหน้า
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
