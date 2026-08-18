/**
 * gps-bridge — สะพานเชื่อมระหว่าง VoiceControl (อยู่ใน app-shell, ทุกหน้า)
 * กับ GpsTracker (internal component ในหน้า /pedometer เท่านั้น)
 *
 * ทำไมต้องมีไฟล์นี้: GpsTracker เก็บ state (routeId, points, watchRef) ไว้
 * ภายในตัวเอง ไม่ได้ยกขึ้น context/store กลาง การ refactor ทั้งหมดให้ใช้
 * store กลางจริงๆ (เช่น zustand) จะกระทบโค้ดหลายจุดและเสี่ยง regression
 * กับฟีเจอร์ GPS ที่ทำงานอยู่แล้ว ไฟล์นี้จึงใช้วิธีเบาที่สุด: GpsTracker
 * "ลงทะเบียน" ฟังก์ชัน start/stop ของตัวเองไว้ตอน mount แล้วปลดทะเบียนตอน
 * unmount — ใครก็ตามที่ import bridge นี้ (เช่น VoiceControl) เรียก
 * gpsBridge.start()/stop() ได้ทันทีถ้าผู้ใช้อยู่หน้า /pedometer อยู่
 *
 * ข้อจำกัดที่ต้องรู้: ถ้าผู้ใช้สั่งด้วยเสียงตอนไม่ได้อยู่หน้า /pedometer
 * bridge จะยังไม่มีฟังก์ชันให้เรียก (เพราะ GpsTracker ยัง unmount อยู่)
 * กรณีนี้ isReady() จะคืน false — VoiceControl ควรแจ้งผู้ใช้ให้เปิดหน้า
 * pedometer ก่อน หรือถ้าต้องการให้สั่งจากหน้าไหนก็ได้จริง ต้อง refactor
 * ให้ GPS watch ทำงานที่ระดับ app-shell แทน (งานใหญ่กว่านี้ ไม่ใช่แค่ bridge)
 */

type GpsHandlers = {
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
};

let handlers: GpsHandlers | null = null;

export const gpsBridge = {
  register(h: GpsHandlers) {
    handlers = h;
  },
  unregister() {
    handlers = null;
  },
  isReady() {
    return handlers !== null;
  },
  async start() {
    if (!handlers) {
      console.warn("[gps-bridge] ยังไม่พร้อม — ต้องเปิดหน้า /pedometer ก่อนสั่งด้วยเสียง");
      return false;
    }
    await handlers.start();
    return true;
  },
  async stop() {
    if (!handlers) {
      console.warn("[gps-bridge] ยังไม่พร้อม — ต้องเปิดหน้า /pedometer ก่อนสั่งด้วยเสียง");
      return false;
    }
    await handlers.stop();
    return true;
  },
};
