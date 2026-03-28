# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands run from the `text_to_audio/` directory:

```bash
npm run dev      # Run with live reload (uses tsx + nodemon)
npm run build    # Compile TypeScript to dist/
npm run start    # Run compiled output (requires build first)
```

## Environment Setup

Copy `.env.example` to `.env` and set:
- `OPENAI_API_KEY` — required for the OpenAI TTS API
- `PORT` — optional, defaults to 3000

## Architecture

This is a single-file Express.js REST API (`text_to_audio/src/index.ts`) that wraps OpenAI's text-to-speech API.

**Endpoints:**
- `POST /tts` — accepts `{ text, voice, speed }`, streams back an MP3 file. Voice must be one of `alloy | echo | fable | onyx | nova | shimmer`; speed must be 0.25–4.0.
- `GET /voices` — returns the list of available voices.

**Stack:** TypeScript (strict, nodenext modules), Express 5, OpenAI SDK 6. Output compiled to `dist/` via `tsc`.
