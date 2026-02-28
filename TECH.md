# Tech Stack

## Core
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4

## Voice
- `@speechmatics/flow-client` — WebSocket client for Speechmatics Flow
- `@speechmatics/flow-client-react` — React hooks (useFlow, useFlowEventListener)
- `@speechmatics/auth` — JWT generation (server-side)
- `@speechmatics/browser-audio-input` + `-react` — Mic capture
- `@speechmatics/web-pcm-player` + `-react` — Audio playback

## Architecture
- JWT generated server-side via Next.js server action (`app/actions/auth.ts`)
- Providers in `app/providers.tsx` wrap the app with Flow, audio recorder, and audio player contexts
- Audio worklet copied to `public/pcm-audio-worklet.min.js`
- Mic audio: Float32 → Int16 (PCM S16LE) → WebSocket → Flow agent
- Agent audio: Int16 (PCM S16LE) via WebSocket → browser playback
