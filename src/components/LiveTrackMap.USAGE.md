# วิธีเอา LiveTrackMap ไปใส่ในระบบหลัก

## 1. ติดตั้ง dependency (ถ้ายังไม่มี)
```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

## 2. วางไฟล์
- `src/components/LiveTrackMap.tsx`
- `src/components/live-track-map.css`

## 3. เรียกใช้ (หน้าเริ่มวิ่ง/เดิน)
```tsx
import { LiveTrackMap } from "@/components/LiveTrackMap";

<LiveTrackMap
  steps={currentSteps}              // จำนวนก้าวจากระบบนับก้าวเดิม (DeviceMotionEvent)
  onSessionEnd={(summary) => {
    // summary = { distanceKm, durationSec, steps, avgSpeedKmh, track }
    // บันทึกลง DB / เรียก API save session ตามระบบเดิม
  }}
/>
```
ถ้าไม่ส่ง `onSessionEnd` จะไม่มีปุ่ม "จบการวิ่ง" แสดง (ใช้แค่โชว์แผนที่อย่างเดียวได้)

## 4. สิ่งที่ต่อข้อมูลจริงให้แล้ว (ไม่ใช่ mock)
- ใช้ `navigator.geolocation.watchPosition` จริง (ไม่ใช่ mock walk เหมือนตัวที่ Lovable สร้าง)
- คำนวณระยะทางจริงด้วยสูตร Haversine จากพิกัดที่ได้แต่ละจุด
- คำนวณ heading (ทิศทางลูกศร) จากพิกัดจุดก่อนหน้า-ปัจจุบัน ถ้า GPS ไม่ส่ง heading มาให้
- กรอง GPS drift/noise เบื้องต้น (ถ้าความเร็วกระโดดเกิน 40 km/h ในช่วงสั้นๆ จะข้ามจุดนั้น)
- ความเร็ว/pace real-time จาก `coords.speed` (m/s → แปลงเป็น km/h)
- เส้นทางไล่สีตามความเร็วจริงของแต่ละช่วง
- เวลาที่ใช้นับจริงจากตอนเปิดหน้า (setInterval ทุกวินาที)

## 5. ต้องเชื่อมเองตามระบบเดิม
- **ก้าวเดิน**: component นี้ไม่ได้นับก้าวเอง ต้องส่งค่า `steps` เข้ามาจาก state/hook นับก้าวที่มีอยู่แล้วในแอพ
- **บันทึกลง DB**: ใน `onSessionEnd` ใส่โค้ดเรียก API บันทึกที่มีอยู่แล้ว (เช่น `/api/pedometer` หรือ endpoint ที่เกี่ยวข้อง)
- **สิทธิ์ GPS**: ต้องรันบน HTTPS จริงเท่านั้น (ใช้ไม่ได้บน localhost ธรรมดาที่ไม่ใช่ https หรือ in-app browser บางตัว เช่น LINE)
- ถ้าแอพมีปุ่ม "เริ่มวิ่ง" อยู่แล้ว (จากระบบเสียง/ปุ่มเดิม) — mount component `<LiveTrackMap>` ตอนกดเริ่ม แล้ว unmount ตอนกดจบ

## 6. ดีไซน์
โทนมินท์/ฟ้า glassmorphism เดียวกับส่วนอื่นของแอพ ถ้าธีมมี CSS variables `--deep`, `--gradient-orb`, `--shadow-glow`, `--mint`, `--aqua` อยู่แล้วจะใช้ค่านั้นอัตโนมัติ (มี fallback ให้ในไฟล์ CSS เผื่อไม่มี)
