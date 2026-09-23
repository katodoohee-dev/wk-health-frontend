// FIX: เพิ่มใหม่ — ผู้ใช้ขอให้ปุ่มควบคุมเสียงลอย (ไมค์ + ลำโพง) พับเก็บได้ และหลังพับแล้วต้องเข้าไป
// เปิดเองในหน้า "ตั้งค่า" (ใช้หน้าโปรไฟล์เป็นหน้าตั้งค่า) เท่านั้นถึงจะเห็นปุ่มอีกครั้ง — ไม่มีทาง
// เปิดกลับจากปุ่มพับเก็บเอง
//
// RESTORE: บัญชีที่ใช้แอปอยู่แล้วก่อนอัปเดตนี้ ต้อง "ไม่หาย" (ปุ่มยังโชว์เหมือนเดิมหลัง deploy)
// ส่วนบัญชีใหม่ (สมัครหลังอัปเดตนี้) ต้องเริ่มจากปิด แล้วไปเปิดเองในตั้งค่า — ระบบไม่มี flag ฝั่ง
// server บอกว่า "ใครสมัครก่อน/หลังอัปเดต" เลยใช้วิธีตัดสินใจครั้งเดียวตอนโค้ดนี้รันครั้งแรกในเครื่อง
// นั้นๆ: ถ้าตอนนั้นมี token ล็อกอินอยู่แล้ว (แปลว่าเป็นบัญชีที่ใช้แอปมาก่อนอัปเดตแล้ว) ให้ default = เปิด
// ถ้ายังไม่มี token (ยังไม่เคยสมัคร/ล็อกอินเลย แปลว่าเป็นบัญชีใหม่ที่กำลังจะสมัครหลังจากนี้) ให้
// default = ปิด แล้วล็อกผลตัดสินใจนี้ไว้ถาวรทันที ไม่คำนวณซ้ำอีกในครั้งต่อๆ ไป
import { getToken } from "@/lib/api";

const ENABLED_KEY = "wk-health:voice-controls-enabled";

export function isVoiceControlsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(ENABLED_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    // ยังไม่เคยตัดสินใจมาก่อนในเครื่องนี้ — ตัดสินใจครั้งเดียวแล้วจำไว้ถาวร (ดูคอมเมนต์ด้านบนไฟล์)
    const hadTokenAlready = !!getToken();
    window.localStorage.setItem(ENABLED_KEY, hadTokenAlready ? "1" : "0");
    return hadTokenAlready;
  } catch {
    return false;
  }
}

export function setVoiceControlsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ไม่ critical */
  }
}
