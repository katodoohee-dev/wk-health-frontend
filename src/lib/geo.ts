/** ยูทิลิตี้พิกัด/ทิศทาง ใช้ร่วมกันระหว่างแผนที่ (LiveTrackMap) และคำสั่งเสียง (VoiceControl) */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin((b.lng - a.lng) * (Math.PI / 180)) * Math.cos((b.lat * Math.PI) / 180);
  const x =
    Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** แปลงองศาทิศเป็นคำพูดภาษาไทย ให้ TTS พูดเป็นธรรมชาติ */
export function compassThai(deg: number) {
  const dirs = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"];
  return dirs[Math.round(((deg % 360) / 45)) % 8]!;
}

export type GeoResult = { lat: number; lng: number; label: string };

/**
 * ค้นหาพิกัดจากชื่อสถานที่ผ่าน OpenStreetMap Nominatim (ฟรี ไม่ต้องใช้ API key)
 * ใช้สำหรับ "ปักหมุดเป้าหมาย" จากคำพูด เช่น "ไปเที่ยวเชียงใหม่" -> geocode("เชียงใหม่")
 */
export async function geocodePlace(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=th&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("ค้นหาสถานที่ไม่สำเร็จ");
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name.split(",")[0] || q };
}
