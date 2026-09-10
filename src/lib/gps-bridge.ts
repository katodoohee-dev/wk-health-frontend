/** Shared bridge between the global voice controller and the GPS tracker. */
type GpsHandlers = {
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  shareLocation?: () => void | Promise<void>;
};

let handlers: GpsHandlers | null = null;
let pendingStart = false;
let pendingShare = false;

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
};
