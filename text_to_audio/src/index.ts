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
  id?: string;
  title: string;
  summary?: string;
  source?: string;
  publishedAt?: string;
  url?: string;
}

interface FeedSource {
  id: string;
  name: string;
  url: string;
}

interface FeedResponse {
  sources: Array<Pick<FeedSource, "id" | "name">>;
  items: NewsItem[];
}

interface PodcastScriptRequest {
  news: NewsItem[];
  topic?: string;
  locale?: string;
  durationSeconds?: number;
  model?: string;
}

const NEWS_FEEDS: FeedSource[] = [
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { id: "the-verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { id: "ars-technica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { id: "wired", name: "Wired", url: "https://www.wired.com/feed/rss" },
  { id: "engadget", name: "Engadget", url: "https://www.engadget.com/rss.xml" },
];
const DEFAULT_NEWS_LIMIT = 15;
const MAX_NEWS_LIMIT = 40;

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

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripHtml(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagContent(block: string, tagName: string): string | undefined {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1]?.trim();
}

function getAtomLink(block: string): string | undefined {
  const hrefMatch = block.match(/<link\b[^>]*href="([^"]+)"[^>]*\/?>/i);
  return hrefMatch?.[1]?.trim();
}

function normalizeNewsItem(item: NewsItem, sourceName: string, fallbackId: string): NewsItem | null {
  const title = item.title.trim();
  if (!title) {
    return null;
  }

  const summary = item.summary?.trim();
  const url = item.url?.trim();
  const publishedAt = item.publishedAt?.trim();

  const normalized: NewsItem = {
    title,
    source: item.source?.trim() || sourceName,
  };

  const id = item.id?.trim() || fallbackId;
  if (id) {
    normalized.id = id;
  }

  if (summary) {
    normalized.summary = stripHtml(summary);
  }

  if (publishedAt) {
    normalized.publishedAt = publishedAt;
  }

  if (url) {
    normalized.url = url;
  }

  return normalized;
}

function parseRssItems(xml: string, source: FeedSource): NewsItem[] {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((block, index) => {
      const rawItem: NewsItem = {
        title: stripHtml(getTagContent(block, "title") ?? ""),
        source: source.name,
      };

      const id = getTagContent(block, "guid") || getTagContent(block, "link");
      const summary = getTagContent(block, "description") || getTagContent(block, "content:encoded");
      const publishedAt = getTagContent(block, "pubDate");
      const link = getTagContent(block, "link");

      if (id) {
        rawItem.id = id;
      }

      if (summary) {
        rawItem.summary = summary;
      }

      if (publishedAt) {
        rawItem.publishedAt = publishedAt;
      }

      if (link) {
        rawItem.url = stripHtml(link);
      }

      return normalizeNewsItem(rawItem, source.name, `${source.id}-${index}`);
    })
    .filter((item): item is NewsItem => item !== null);
}

function parseAtomItems(xml: string, source: FeedSource): NewsItem[] {
  const entryMatches = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  return entryMatches
    .map((block, index) => {
      const rawItem: NewsItem = {
        title: stripHtml(getTagContent(block, "title") ?? ""),
        source: source.name,
      };

      const id = getTagContent(block, "id") || getAtomLink(block);
      const summary = getTagContent(block, "summary") || getTagContent(block, "content");
      const publishedAt = getTagContent(block, "updated") || getTagContent(block, "published");
      const link = getAtomLink(block);

      if (id) {
        rawItem.id = id;
      }

      if (summary) {
        rawItem.summary = summary;
      }

      if (publishedAt) {
        rawItem.publishedAt = publishedAt;
      }

      if (link) {
        rawItem.url = link;
      }

      return normalizeNewsItem(rawItem, source.name, `${source.id}-${index}`);
    })
    .filter((item): item is NewsItem => item !== null);
}

function parseFeed(xml: string, source: FeedSource): NewsItem[] {
  if (/<entry\b/i.test(xml)) {
    return parseAtomItems(xml, source);
  }

  return parseRssItems(xml, source);
}

function sortNewsItems(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const timeA = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
    const timeB = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;

    if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
      return a.title.localeCompare(b.title);
    }

    if (Number.isNaN(timeA)) {
      return 1;
    }

    if (Number.isNaN(timeB)) {
      return -1;
    }

    return timeB - timeA;
  });
}

async function fetchFeed(source: FeedSource): Promise<NewsItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "AI-news-podcast/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: HTTP ${response.status}`);
  }

  const xml = await response.text();
  return parseFeed(xml, source);
}

app.get("/news-feed", async (req: Request, res: Response<FeedResponse | { error: string }>) => {
  const limitParam = req.query.limit;
  const sourceParam = req.query.source;

  const limit =
    typeof limitParam === "string" && limitParam.trim()
      ? Number.parseInt(limitParam, 10)
      : DEFAULT_NEWS_LIMIT;

  if (Number.isNaN(limit) || limit < 1 || limit > MAX_NEWS_LIMIT) {
    res.status(400).json({ error: `limit must be a number between 1 and ${MAX_NEWS_LIMIT}` });
    return;
  }

  const requestedSourceIds =
    typeof sourceParam === "string" && sourceParam.trim()
      ? sourceParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  const selectedSources =
    requestedSourceIds.length > 0
      ? NEWS_FEEDS.filter((source) => requestedSourceIds.includes(source.id))
      : NEWS_FEEDS;

  if (selectedSources.length === 0) {
    res.status(400).json({ error: "No valid sources were requested" });
    return;
  }

  try {
    const results = await Promise.allSettled(selectedSources.map((source) => fetchFeed(source)));
    const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const uniqueItems = sortNewsItems(items)
      .filter(
        (item, index, all) =>
          index === all.findIndex((candidate) => (candidate.url || candidate.id) === (item.url || item.id)),
      )
      .slice(0, limit);

    if (uniqueItems.length === 0) {
      res.status(502).json({ error: "No feed items could be fetched from the configured sources" });
      return;
    }

    res.json({
      sources: selectedSources.map(({ id, name }) => ({ id, name })),
      items: uniqueItems,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("News feed fetch error:", message);
    res.status(500).json({ error: "Failed to fetch news feeds" });
  }
});

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
