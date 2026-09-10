AI Series Thai V5.1
====================

แก้ปัญหา V5 เดิม:
- ไม่ใช้ app.get("*") ที่ทำให้ Express 5 มีปัญหา
- เพิ่ม endpoint /api/generate จริง
- เพิ่ม image-to-video เพื่อให้รูปเกิดการเคลื่อนไหวจริง
- ต่อด้วย Gemini TTS ภาษาไทย
- ต่อด้วย Sync-3 video-to-video เพื่อทำ Lip-sync
- ใช้ FAL_KEY ฝั่งเซิร์ฟเวอร์เท่านั้น

Pipeline:
รูป -> Kling V3 Image-to-Video -> Gemini TTS -> Sync-3 Lip-sync -> MP4

การ deploy:
1) อัปโหลดโปรเจกต์นี้ขึ้น Node.js web host
2) ตั้ง Environment Variable ชื่อ FAL_KEY เป็น API key ของคุณ
3) Start: npm start
4) เปิด URL เว็บจากมือถือ

ห้ามใส่ FAL_KEY ใน index.html และห้ามส่ง key ในแชต
