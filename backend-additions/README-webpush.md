# ต่อ Push Notification จริง (Web Push) — ทำให้ "การแจ้งเตือน" ทำงานจริงบนมือถือ

โค้ดที่ส่งมอบให้ครอบคลุมถึงจุดที่ backend "รู้" ว่าต้องส่งแจ้งเตือนอะไรเมื่อไหร่
แต่การส่งแจ้งเตือนจริงไปเครื่อง user ต้องมี **VAPID key เฉพาะของคุณ** ซึ่งเป็น
ความลับที่ต้องสร้างเองครั้งเดียว (ไม่มีใครสร้างแทนได้ เพราะผูกกับ deploy จริง)

## ขั้นตอน (ทำครั้งเดียว)

```bash
npm install web-push
npx web-push generate-vapid-keys
```

จะได้ public key + private key คู่หนึ่ง — เก็บ private key เป็น env var
`VAPID_PRIVATE_KEY` ที่ backend, และ public key ใช้ที่ frontend สำหรับ
subscribe

## ฝั่ง frontend (เพิ่ม Service Worker)

ต้องมีไฟล์ `public/sw.js` และโค้ด subscribe ผู้ใช้ตอนเปิดหน้า notifications
ครั้งแรก (ขอ permission แล้ว `pushManager.subscribe()`) — ส่วนนี้ยังไม่ได้
เขียนให้ในชุดนี้ เพราะต้องตัดสินใจร่วมกับคุณก่อนว่าจะ subscribe ตอนไหน
(ทันทีตอน login หรือรอ user กด "ส่งแจ้งเตือนทดสอบ" ก่อน)

## ฝั่ง backend (ส่งจริง)

```js
const webpush = require("web-push");
webpush.setVapidDetails("mailto:you@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ตอนถึงเวลาส่ง (cron job หรือ trigger จาก event เช่น cheer):
await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
```

ต้องมีตารางเก็บ `push_subscriptions` (endpoint, keys) ผูกกับ user_id เพิ่ม
ซึ่งยังไม่ได้รวมอยู่ใน schema ของ `new-features.routes.js` — เพิ่มได้เมื่อ
ตัดสินใจ flow การ subscribe แล้ว

**สรุป:** endpoint `/notifications/test` ตอนนี้เป็น placeholder ที่คืน
success เฉยๆ ยังไม่ส่งแจ้งเตือนจริงไปเครื่อง จนกว่าจะทำตามขั้นตอนข้างต้นครบ
