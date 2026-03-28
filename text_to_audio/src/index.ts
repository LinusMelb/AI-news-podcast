import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const app = express();
app.use(express.json());

const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY ?? "" });

interface TTSRequest {
  text: string;
  voice_id?: string; // ElevenLabs voice ID
}

app.post("/tts", async (req: Request<{}, {}, TTSRequest>, res: Response) => {
  const { text, voice_id = "JBFqnCBsd6RMkjVDRZzb" } = req.body; // default: "George"

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  try {
    const audioStream = await elevenlabs.textToSpeech.convert(voice_id, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Disposition", "attachment; filename=speech.mp3");

    for await (const chunk of audioStream) {
      res.write(chunk);
    }
    res.end();
  } catch (err: any) {
    console.error("ElevenLabs TTS error:", err?.message ?? err);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

app.get("/voices", async (_req: Request, res: Response) => {
  try {
    const { voices } = await elevenlabs.voices.getAll();
    res.json(voices.map((v) => ({ id: v.voiceId, name: v.name })));
  } catch (err: any) {
    console.error("ElevenLabs voices error:", err?.message ?? err);
    res.status(500).json({ error: "Failed to fetch voices" });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Text-to-audio API running on http://localhost:${PORT}`);
});
