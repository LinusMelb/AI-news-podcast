# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Two independent services, each with their own `package.json`:

- `text_to_audio/` — Express REST API that calls ElevenLabs TTS and streams back MP3 audio
- `ui/` — React + TypeScript frontend (Vite) that lets users type a prompt and play the generated audio

## Development Commands

**Backend** (`text_to_audio/`):
```bash
npm run dev      # Live-reload dev server via tsx + nodemon
npm run build    # Compile TypeScript → dist/
npm run start    # Run compiled output (requires build first)
```

**Frontend** (`ui/`):
```bash
npm run dev      # Vite dev server (proxies /tts and /voices to localhost:3000)
npm run build    # Type-check + Vite production build
npm run lint     # ESLint
npm run preview  # Serve the production build locally
```

Run both services simultaneously for local development: backend on port 3000, frontend on Vite's default port (5173).

## Environment Setup

Create `text_to_audio/.env` with:
```
ELEVENLABS_API_KEY=...
PORT=3000          # optional, defaults to 3000
```

## Architecture

### Backend (`text_to_audio/src/index.ts`)

Single-file Express 5 server. Two endpoints:

- `POST /tts` — body: `{ text: string, voice_id?: string }`. Calls `elevenlabs.textToSpeech.convert()` with model `eleven_multilingual_v2` and streams the response as `audio/mpeg`. Default voice is `JBFqnCBsd6RMkjVDRZzb` ("George").
- `GET /voices` — proxies `elevenlabs.voices.getAll()` and returns `[{ id, name }]`.

TypeScript config uses `"module": "nodenext"` with strict mode and `noUncheckedIndexedAccess` — imports inside `text_to_audio/` must use `.js` extensions even for `.ts` source files.

### Frontend (`ui/src/App.tsx`)

Single-component React app. On mount it fetches `/voices` to populate the voice selector. On submit it POSTs to `/tts`, receives a blob, creates an object URL, and plays it via an `<audio>` element. Vite proxies `/tts` and `/voices` to `http://localhost:3000` during dev so no CORS config is needed.

### Note on `text_to_audio/CLAUDE.md`

That file is stale — it documents an OpenAI implementation that was replaced by ElevenLabs. Ignore it; this root CLAUDE.md is authoritative.
