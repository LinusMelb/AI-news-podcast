import express from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

interface TTSRequest {
  text: string;
  voice?: Voice;
  speed?: number; // 0.25 to 4.0
}

app.post("/tts", async (req: Request<{}, {}, TTSRequest>, res: Response) => {
  const { text, voice = "alloy", speed = 1.0 } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  if (!VOICES.includes(voice)) {
    res.status(400).json({ error: `voice must be one of: ${VOICES.join(", ")}` });
    return;
  }

  if (typeof speed !== "number" || speed < 0.25 || speed > 4.0) {
    res.status(400).json({ error: "speed must be a number between 0.25 and 4.0" });
    return;
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      speed,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Disposition", "attachment; filename=speech.mp3");
    res.send(buffer);
  } catch (err: any) {
    console.error("OpenAI TTS error:", err?.message ?? err);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

app.get("/voices", (_req: Request, res: Response) => {
  res.json({ voices: VOICES });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Text-to-audio API running on http://localhost:${PORT}`);
});
