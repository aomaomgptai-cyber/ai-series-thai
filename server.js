import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fal } from "@fal-ai/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

function setupFal() {
  if (!process.env.FAL_KEY) {
    const err = new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FAL_KEY");
    err.status = 500;
    throw err;
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: "5.1",
    falKeyConfigured: Boolean(process.env.FAL_KEY)
  });
});

app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    setupFal();

    const speech = String(req.body.speech || "").trim();
    const motionPrompt = String(req.body.motionPrompt || "").trim() ||
      "The construction worker breathes naturally, blinks, subtly moves his head and shoulders, shifts his gaze, and the camera makes a gentle cinematic push-in. Keep the face and identity consistent. Realistic natural movement.";
    const voice = req.body.voice || "Charon";
    const seconds = Math.min(Math.max(Number(req.body.seconds || 5), 3), 10);

    if (!speech) {
      return res.status(400).json({ error: "กรุณาใส่บทพูดภาษาไทย" });
    }

    // 1) Upload image to fal storage.
    let buffer, mime, filename;
    if (req.file) {
      buffer = req.file.buffer;
      mime = req.file.mimetype || "image/png";
      filename = req.file.originalname || "scene.png";
    } else {
      throw new Error("กรุณาเลือกรูปภาพฉากก่อนสร้างวิดีโอ");
      mime = "image/png";
      filename = "scene1.png";
    }
    const imageFile = new File([buffer], filename, { type: mime });
    const imageUrl = await fal.storage.upload(imageFile);

    // 2) Generate Thai speech.
    const tts = await fal.subscribe("fal-ai/gemini-tts", {
      input: {
        prompt: speech,
        style_instructions: "พูดภาษาไทยแบบนักแสดงซีรีส์จีนพากย์ไทย อารมณ์จริงจัง เป็นธรรมชาติ ชัดเจน",
        voice,
        model: "gemini-2.5-flash-tts",
        language_code: "Thai (Thailand)",
        output_format: "mp3"
      },
      logs: false
    });

    const audioUrl = tts?.data?.audio?.url;
    if (!audioUrl) throw new Error("สร้างเสียงภาษาไทยไม่สำเร็จ");

    // 3) First create REAL motion from the still image.
    // Kling V3 standard supports image-to-video and durations 3-15 sec.
    const motion = await fal.subscribe("fal-ai/kling-video/v3/standard/image-to-video", {
      input: {
        prompt: motionPrompt,
        start_image_url: imageUrl,
        duration: String(seconds),
        generate_audio: false,
        negative_prompt: "warping face, deformed hands, extra limbs, flicker, blur, identity change, text distortion"
      },
      logs: false
    });

    const motionVideoUrl = motion?.data?.video?.url;
    if (!motionVideoUrl) throw new Error("สร้างวิดีโอเคลื่อนไหวไม่สำเร็จ");

    // 4) Lip-sync the generated motion video to the Thai voice.
    const lipsync = await fal.subscribe("fal-ai/sync-lipsync/v3", {
      input: {
        video_url: motionVideoUrl,
        audio_url: audioUrl,
        sync_mode: "cut_off"
      },
      logs: false
    });

    const finalVideoUrl = lipsync?.data?.video?.url;
    if (!finalVideoUrl) throw new Error("ทำ Lip-sync ไม่สำเร็จ");

    res.json({
      ok: true,
      videoUrl: finalVideoUrl,
      motionVideoUrl,
      audioUrl,
      seconds,
      message: "สร้างวิดีโอเคลื่อนไหว + เสียงไทย + Lip-sync สำเร็จ"
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({
      error: err?.message || "เกิดข้อผิดพลาดระหว่างสร้างวิดีโอ"
    });
  }
});

// Express 5-safe SPA fallback. Do NOT use app.get("*").
app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "index.html"));
  }
  res.status(404).json({ error: "Not found" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI Series Thai V5.1 listening on ${port}`));
