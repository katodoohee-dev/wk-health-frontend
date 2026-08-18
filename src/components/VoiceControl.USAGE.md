# วิธีเอาไปใส่ใน wk-health-frontend

## 1. วางไฟล์
คัดลอกไปที่:
- `src/components/VoiceControl.tsx`
- `src/components/voice-control.css`

## 2. เรียกใช้ (เช่นใน layout/root ของแอพ)

```tsx
import { VoiceControl } from "@/components/VoiceControl";

<VoiceControl
  profileName={profile?.name}
  bodyWeightKg={profile?.weightKg ?? 60}
  onExercise={(result) => {
    // result = { activity, duration_min, mets, kcal }
    // บันทึกเข้า state/DB ของแอพตามระบบเดิม
  }}
  onStartGps={() => startGpsTracking()}   // ฟังก์ชัน GPS เดิมที่มีอยู่แล้ว
  onStopGps={() => stopGpsTracking()}     // ฟังก์ชัน GPS เดิมที่มีอยู่แล้ว
  onOpenProfileModal={() => setShowProfileModal(true)}
/>
```

## 3. สิ่งที่ต่อ logic จริงให้แล้ว (ไม่ใช่ demo)
- Web Speech API (`SpeechRecognition`, `continuous: true, interimResults: true`, `lang: "th-TH"`)
- Buffer 3 วินาที รวมประโยคก่อนส่งวิเคราะห์
- แปลงเลขไทย → ตัวเลขก่อนส่ง AI (`thaiWordsToDigits`)
- เช็ค GPS keyword ก่อนยิง AI เสมอ (เริ่มวิ่ง/หยุดวิ่ง ฯลฯ)
- เรียก DeepSeek ผ่าน Worker: `https://kasidathdeepseek.katodoohee.workers.dev`
  - ปรับ endpoint ได้ที่ตัวแปร `DEEPSEEK_ENDPOINT` บนสุดของไฟล์
  - ถ้า response format จาก Worker ไม่ตรง ให้แก้ที่บรรทัด `data?.content ?? data?.choices?.[0]?.message?.content`
- Fallback จับคำในเครื่องถ้า DeepSeek ล่ม (`localActivityMatchAnyAlt`) — ไล่เช็คทุก alternative transcript
- คำนวณ kcal ฝั่ง JS: `kcal = METs × น้ำหนักตัว(กก.) × (นาที/60)`
- error handling แยกตาม type: ปฏิเสธสิทธิ์ไมค์ / ไม่มีฮาร์ดแวร์ / ไม่ได้ยิน 4 รอบติด / เน็ตหลุด
- restart อัตโนมัติเมื่อ recognition จบ (เช็ค permission ก่อนเงียบๆ)

## 4. ต้องเช็คเอง (ไม่มีในโค้ดนี้เพราะแล้วแต่ระบบเดิม)
- `LOCAL_ACTIVITY_METS` — ตอนนี้มีแค่ 6 กิจกรรมพื้นฐาน เพิ่ม/แก้ตามที่แอพรองรับจริง
- Response shape จาก DeepSeek Worker ของคุณ อาจไม่ตรงกับที่เดาไว้ — ลอง console.log(data) ดูจริงหนึ่งรอบ
- Modal กรอกชื่อโปรไฟล์ (`onOpenProfileModal`) ต้องเป็นของเดิมที่มีอยู่แล้ว
- ไมค์/GPS ต้องรันบน HTTPS จริงเท่านั้น (ใช้ไม่ได้ใน sandbox หรือ in-app browser เช่น LINE/Facebook)

## 5. ดีไซน์
ธีมมินท์/ฟ้า glassmorphism ล้ำยุค ตรงกับ bio-tech bright ของแอพอยู่แล้ว — ปรับสีได้ที่ตัวแปร CSS บนสุดของ `voice-control.css` (`--vc-mint`, `--vc-aqua`, `--vc-deep`)
