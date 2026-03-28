import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY ?? "" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEFAULT_SCRIPT_MODEL = process.env.OPENAI_SCRIPT_MODEL ?? "gpt-5-codex";

interface TTSRequest {
  text: string;
  voice_id?: string; // ElevenLabs voice ID
}

interface NewsItem {
  title: string;
  summary?: string;
  source?: string;
  publishedAt?: string;
  url?: string;
}

interface PodcastScriptRequest {
  news: NewsItem[];
  topic?: string;
  locale?: string;
  durationSeconds?: number;
  model?: string;
}

function formatNewsItems(news: NewsItem[]): string {
  return news
    .map((item, index) => {
      const lines = [
        `${index + 1}. ${item.title.trim()}`,
        item.summary?.trim() ? `Summary: ${item.summary.trim()}` : undefined,
        item.source?.trim() ? `Source: ${item.source.trim()}` : undefined,
        item.publishedAt?.trim() ? `Published at: ${item.publishedAt.trim()}` : undefined,
        item.url?.trim() ? `URL: ${item.url.trim()}` : undefined,
      ].filter(Boolean);

      return lines.join("\n");
    })
    .join("\n\n");
}

function extractResponseText(response: unknown): string {
  if (
    typeof response === "object" &&
    response !== null &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text.trim();
  }

  if (
    typeof response === "object" &&
    response !== null &&
    "output" in response &&
    Array.isArray(response.output)
  ) {
    const texts: string[] = [];

    for (const item of response.output) {
      if (
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        for (const contentItem of item.content) {
          if (
            typeof contentItem === "object" &&
            contentItem !== null &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            texts.push(contentItem.text);
          }
        }
      }
    }

    return texts.join("\n").trim();
  }

  return "";
}

app.post("/podcast-script", async (req: Request<{}, {}, PodcastScriptRequest>, res: Response) => {
  const {
    news,
    topic = "Silicon Valley news",
    locale = "zh-CN",
    durationSeconds = 30,
    model = DEFAULT_SCRIPT_MODEL,
  } = req.body;

  if (!Array.isArray(news) || news.length === 0) {
    res.status(400).json({ error: "news is required and must be a non-empty array" });
    return;
  }

  const invalidItem = news.find(
    (item) =>
      !item ||
      typeof item !== "object" ||
      typeof item.title !== "string" ||
      item.title.trim().length === 0,
  );

  if (invalidItem) {
    res.status(400).json({ error: "each news item must include a non-empty title" });
    return;
  }

  if (
    typeof durationSeconds !== "number" ||
    Number.isNaN(durationSeconds) ||
    durationSeconds < 10 ||
    durationSeconds > 300
  ) {
    res.status(400).json({ error: "durationSeconds must be a number between 10 and 300" });
    return;
  }

  const prompt = `
You are writing a short podcast-style news briefing.

Requirements:
- Write in ${locale}.
- Target spoken length: about ${durationSeconds} seconds.
- Topic: ${topic}.
- Use only the facts from the provided news items.
- Keep it smooth, conversational, and easy to read aloud.
- Do not invent facts, names, dates, or implications.
- Return plain text only. No markdown. No bullet points. No title.

News items:
${formatNewsItems(news)}
  `.trim();

  try {
    const response = await openai.responses.create({
      model,
      input: prompt,
    });

    const script = extractResponseText(response);

    if (!script) {
      res.status(502).json({ error: "Model returned an empty script" });
      return;
    }

    res.json({
      model,
      topic,
      locale,
      durationSeconds,
      itemCount: news.length,
      script,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("OpenAI script generation error:", message);
    res.status(500).json({ error: "Failed to generate podcast script" });
  }
});

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
