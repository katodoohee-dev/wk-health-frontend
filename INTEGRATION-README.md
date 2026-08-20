# WK Health — Package ประกอบสมบูรณ์ (3 หน้าใหม่ merge เข้าโค้ดจริงแล้ว)

## โครงสร้าง
```
src/                          ← โปรเจกต์ frontend เต็ม (จากไฟล์เดิมที่คุณอัปโหลด
                                 + 3 หน้าใหม่ merge เข้าไปแล้ว พร้อมลิงก์ในเมนู
                                 หน้า dashboard เรียบร้อย)
  routes/export.tsx           ← ใหม่
  routes/friends.tsx          ← ใหม่
  routes/notifications.tsx    ← ใหม่
  routes/index.tsx            ← แก้แล้ว: เพิ่ม 3 การ์ดในเมนู "เครื่องมือของคุณ"
  lib/api-new-features.ts     ← ใหม่: ฟังก์ชันเรียก API ทั้ง 9 endpoint

backend-additions/
  new-features.routes.js      ← Express Router จริง (ไม่ใช่ mock) พร้อม
                                 SQLite schema สร้างตารางอัตโนมัติ
  README-webpush.md           ← ขั้นตอนต่อ push notification จริง (ต้องใช้
                                 VAPID key ของคุณเอง)
```

## สถานะความสมบูรณ์ ตามจริง

| ส่วน | สถานะ |
|---|---|
| Frontend 3 หน้าใหม่ | ✅ พร้อมใช้ merge เข้า repo ได้เลย |
| เชื่อมเมนู dashboard | ✅ เพิ่มลิงก์ให้แล้ว |
| Backend endpoint (9 จุด) | ✅ เขียนโค้ดจริงให้แล้ว (Express + SQLite) — แต่ยังไม่ได้ deploy/mount เข้า server จริงของคุณ |
| Export ไฟล์ PDF/CSV จริง | ⚠️ endpoint รับ request ได้ แต่ logic สร้างไฟล์จริงจากข้อมูล diary ยังเป็น TODO (มีคอมเมนต์ระบุจุดที่ต้องเติม) |
| Friends แบบ real-time | ⚠️ เพิ่ม/เชียร์เพื่อนทำงานได้ผ่าน HTTP ปกติ (ไม่ใช่ WebSocket) — ถ้าต้องการอัปเดตแบบ real-time จริง (เพื่อนเชียร์แล้วเห็นทันทีไม่ต้อง refresh) ต้องเพิ่ม WebSocket/SSE เพิ่มเติม ยังไม่ได้ทำ |
| Push notification จริง | ⚠️ ต้องคุณสร้าง VAPID key เองตาม README-webpush.md — ไม่มีใครสร้างแทนได้เพราะเป็นความลับเฉพาะบัญชี |

## วิธีติดตั้ง

**Frontend:**
1. เอาทั้งโฟลเดอร์ `src/` ไปแทนที่ในโปรเจกต์ `wk-health-frontend` ของคุณ
   (หรือ diff เทียบก่อนถ้ามีการแก้ไขอื่นที่ยังไม่ได้รวมมาด้วย)
2. `pnpm install && pnpm dev`

**Backend:**
1. คัดลอก `backend-additions/new-features.routes.js` ไปไว้ในโปรเจกต์ backend
2. Mount เข้า Express app หลัก:
   ```js
   const newFeaturesRouter = require("./new-features.routes");
   app.use(newFeaturesRouter(db, requireAuth));
   ```
3. ปรับ query ในไฟล์นี้ให้ตรงกับ schema ตาราง `users`/`checkins` จริงของคุณ
   (ผมเดา column name จากไฟล์ frontend ที่มี ไม่มี schema backend จริงให้ดู
   จึงอาจต้องปรับชื่อ column เล็กน้อย)
4. ทำตาม `README-webpush.md` ถ้าต้องการ push notification จริง

## หมายเหตุความซื่อสัตย์
"พร้อมใช้งานเรียลไทม์ทุกจุด" ตามที่ขอ — ทำได้จริงในระดับ **HTTP request/response
ปกติ** (โหลดข้อมูล, กดปุ่ม, บันทึกได้จริงเมื่อ mount backend แล้ว) แต่คำว่า
"เรียลไทม์" ถ้าหมายถึง WebSocket push แบบไม่ต้อง refresh หรือ mobile push
notification จริง สองอย่างนี้ต้องมีขั้นตอนเพิ่มที่พึ่งพา credential/decision
เฉพาะของคุณ (WebSocket infra, VAPID key) ไม่ใช่สิ่งที่เขียนโค้ดแทนได้ทั้งหมด
โดยไม่มี input จากคุณ
