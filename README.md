# AI-news-podcast

A small full-stack app that pulls recent stories from major tech publications, turns the selected headlines into a short podcast script with OpenAI, and generates MP3 audio with ElevenLabs.

## What it does

- Aggregates RSS and Atom feeds from TechCrunch, The Verge, Ars Technica, Wired, and Engadget
- Lets you select the stories you want in the UI
- Generates a short spoken briefing from those stories with OpenAI
- Converts the generated script into audio with ElevenLabs

## Setup

### Backend

From `text_to_audio/`:

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables in `text_to_audio/.env`:

- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_SCRIPT_MODEL` optional, defaults to `gpt-5-codex`
- `PORT` optional, defaults to `3000`

### Frontend

From `ui/`:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/news-feed`, `/podcast-script`, `/tts`, and `/voices` to `http://localhost:3000`.

## Endpoints

### `GET /news-feed`

Fetch a normalized list of recent tech headlines from the configured publications.

Query params:

- `limit` optional, default `15`, max `40`
- `source` optional comma-separated source ids such as `techcrunch,the-verge`

Example:

```bash
curl "http://localhost:3000/news-feed?limit=10"
```

### `POST /podcast-script`

Generate a short broadcast script from a list of news items.

```json
{
  "topic": "Big tech news roundup",
  "durationSeconds": 45,
  "locale": "en-US",
  "news": [
    {
      "title": "Waymo expands robotaxi coverage",
      "summary": "The company rolled out service in additional neighborhoods.",
      "source": "TechCrunch",
      "publishedAt": "2026-03-27",
      "url": "https://example.com/story"
    }
  ]
}
```

### `POST /tts`

Generate MP3 audio from text with ElevenLabs.

### `GET /voices`

List available ElevenLabs voices.
