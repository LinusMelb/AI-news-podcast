# AI-news-podcast

Minimal API service for generating a short podcast script with OpenAI and turning it into audio with ElevenLabs.

## Setup

Run everything from `text_to_audio/`:

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_SCRIPT_MODEL` defaults to `gpt-5-codex`
- `PORT` defaults to `3000`

## Endpoints

### `POST /podcast-script`

Generate a short broadcast script from a list of news items.

```json
{
  "topic": "Silicon Valley",
  "durationSeconds": 30,
  "locale": "zh-CN",
  "news": [
    {
      "title": "Waymo paid robotaxi rides hit 500,000 per week",
      "summary": "Commercial robotaxi demand continues to rise.",
      "source": "TechCrunch",
      "publishedAt": "2026-03-27"
    },
    {
      "title": "San Jose airport starts testing AI robot Jose",
      "summary": "The airport is piloting an AI assistant for passengers.",
      "source": "Business Insider",
      "publishedAt": "2026-03-24"
    }
  ]
}
```

Example:

```bash
curl -X POST http://localhost:3000/podcast-script \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Silicon Valley",
    "durationSeconds": 30,
    "locale": "zh-CN",
    "news": [
      {
        "title": "Waymo paid robotaxi rides hit 500,000 per week",
        "summary": "Commercial robotaxi demand continues to rise.",
        "source": "TechCrunch",
        "publishedAt": "2026-03-27"
      },
      {
        "title": "San Jose airport starts testing AI robot Jose",
        "summary": "The airport is piloting an AI assistant for passengers.",
        "source": "Business Insider",
        "publishedAt": "2026-03-24"
      }
    ]
  }'
```

### `POST /tts`

Generate MP3 audio from text with ElevenLabs.

### `GET /voices`

List available ElevenLabs voices.
