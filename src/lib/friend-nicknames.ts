// เก็บ "ชื่อเล่นเพื่อน" (nickname) ที่ผู้ใช้ตั้งเอง
//
// หมายเหตุสำคัญ: backend ปัจจุบัน (external API ที่ /api/friends) ยังไม่มี field
// สำหรับเก็บ nickname ต่อเพื่อนแต่ละคนเลย (ดู Friend type ใน api-new-features.ts —
// มีแค่ id/name/avatar/streak) การเพิ่ม endpoint ใหม่ต้องแก้ backend repo ซึ่งอยู่คนละที่
// ไม่ใช่ repo นี้ เลยเก็บ nickname แบบ local-only ต่อเครื่อง/เบราว์เซอร์ไปก่อน (localStorage)
// — ใช้งานได้ทันทีไม่ต้องรอ backend แต่จะไม่ sync ข้ามอุปกรณ์ ถ้าต้องการ sync ข้ามเครื่อง
// ต้องเพิ่ม endpoint เช่น PATCH /api/friends/:id { nickname } ฝั่ง backend ก่อน

const KEY = "wk-health:friend-nicknames";

type NicknameMap = Record<string, string>;

function readMap(): NicknameMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: NicknameMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* localStorage อาจเต็ม/ถูกปิดใช้งาน — ไม่ critical พอที่จะโชว์ error ให้ผู้ใช้ */
  }
}

export function getFriendNickname(friendId: string): string {
  return readMap()[friendId] ?? "";
}

export function setFriendNickname(friendId: string, nickname: string) {
  const map = readMap();
  const trimmed = nickname.trim();
  if (trimmed) map[friendId] = trimmed;
  else delete map[friendId];
  writeMap(map);
}

export function getAllFriendNicknames(): NicknameMap {
  return readMap();
}
