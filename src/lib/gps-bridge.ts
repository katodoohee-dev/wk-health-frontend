/** Shared bridge between the global voice controller and the GPS tracker. */
export type GpsDestination = { lat: number; lng: number; label: string };
type GpsHandlers = {
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  shareLocation?: () => void | Promise<void>;
  setDestination?: (dest: GpsDestination) => void | Promise<void>;
  setGoalKm?: (km: number) => void | Promise<void>;
};

let handlers: GpsHandlers | null = null;
let pendingStart = false;
let pendingShare = false;
let pendingDestination: GpsDestination | null = null;
let pendingGoalKm: number | null = null;

export const gpsBridge = {
  register(h: GpsHandlers) {
    handlers = h;
    if (pendingStart) {
      pendingStart = false;
      void h.start();
    }
    if (pendingShare && h.shareLocation) {
      pendingShare = false;
      void h.shareLocation();
    }
    if (pendingDestination && h.setDestination) {
      const dest = pendingDestination;
      pendingDestination = null;
      void h.setDestination(dest);
    }
    if (pendingGoalKm !== null && h.setGoalKm) {
      const km = pendingGoalKm;
      pendingGoalKm = null;
      void h.setGoalKm(km);
    }
  },
  unregister() {
    handlers = null;
  },
  isReady() {
    return handlers !== null;
  },
  async start() {
    if (!handlers) {
      pendingStart = true;
      return false;
    }
    await handlers.start();
    return true;
  },
  async stop() {
    pendingStart = false;
    if (!handlers) return false;
    await handlers.stop();
    return true;
  },
  // FIX: เพิ่มใหม่ — เดิมไม่มีทางแชร์ตำแหน่งปัจจุบันได้เลยทั้งจากปุ่มกดและจากเสียง
  async shareLocation() {
    if (!handlers?.shareLocation) {
      pendingShare = true;
      return false;
    }
    await handlers.shareLocation();
    return true;
  },
  // FIX: เพิ่มใหม่ — "มาร์กเป้าหมาย" ที่ผู้ใช้ขอ: ปักหมุดเป้าหมายจากเสียง แล้วให้หน้า GPS
  // (ซึ่งอาจยังไม่ได้เปิดอยู่ตอนสั่งเสียง) รับพิกัดไปวาดหมุด+เส้นทาง+ระยะทางให้เมื่อเปิดหน้าขึ้นมา
  async setDestination(dest: GpsDestination) {
    if (!handlers?.setDestination) {
      pendingDestination = dest;
      return false;
    }
    await handlers.setDestination(dest);
    return true;
  },
  // FIX: เพิ่มใหม่ — ตั้งเป้าหมายระยะทางวิ่ง/เดินจากเสียง (เช่น "อยากวิ่งกี่กิโล" -> ตอบ 5 -> เป้าหมาย 5 กม.)
  async setGoalKm(km: number) {
    if (!handlers?.setGoalKm) {
      pendingGoalKm = km;
      return false;
    }
    await handlers.setGoalKm(km);
    return true;
  },
};
