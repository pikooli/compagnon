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

## Tool Calling
- `app/lib/flow-tools.ts` — tool type definitions, tool registry (`TOOLS`), and executor (`executeToolCall`)
- `app/hooks/useFlowToolCalling.ts` — custom hook that patches `WebSocket.send` to inject `tools` into `StartConversation`, handles `ToolInvoke` messages, and sends `ToolResult` back
- SDK v0.2.2 has no native tool calling support; we access private `FlowClient` internals via `as any` casts
- `recall_memories` tool calls `recallMemories` server action via dynamic import

## Memory (Backboard.io)
- `app/lib/backboard.ts` — `BackboardClient` class wrapping REST API (`https://app.backboard.io/api`), pure fetch, no external deps
- `app/actions/backboard.ts` — server actions with module-level caching for client + assistant_id + thread_id
  - `createBackboardThread()` — creates thread, stores thread_id server-side, returns it to client
  - `mirrorTurnToBackboard()` — sends user + agent text with `memory=Auto` (Backboard extracts memories)
  - `recallMemories(query)` — primary: `sendMessage` with `memory=Readonly` on session thread; uses `retrieved_memories` from response (Backboard's vector search with relevance scores, deduplicated); fallback: `GET /memories` dump
- `app/hooks/useConversationMirror.ts` — client hook that detects completed turn pairs and fires mirror calls
- Assistant ID auto-created on first run, persisted to `.backboard-assistant-id` file (gitignored)
- Auth: `X-API-Key` header with `BACKBOARD_API_KEY` env var

## Architecture — Flow vs Backboard
- **Flow = minimal voice brain**: STT + TTS + lightweight LLM for conversational flow. Does not carry heavy logic or long-term state.
- **Backboard = secondary backend**: persistent memory, intelligent recall (vector search with scoring), conversation context. Receives full conversation via mirroring.
- Flow delegates to Backboard via tools (`recall_memories`) when it needs context beyond the current conversation.

## Architecture
- JWT generated server-side via Next.js server action (`app/actions/auth.ts`)
- Providers in `app/providers.tsx` wrap the app with Flow, audio recorder, and audio player contexts
- Audio worklet copied to `public/pcm-audio-worklet.min.js`
- Mic audio: Float32 → Int16 (PCM S16LE) → WebSocket → Flow agent
- Agent audio: Int16 (PCM S16LE) via WebSocket → browser playback
