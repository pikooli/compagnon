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
- `recall_memories` tool calls `recallMemoriesStructured` server action via dynamic import (returns both text for Flow + structured memory data for admin panel)

## Memory (Backboard.io)
- `app/lib/backboard.ts` — `BackboardClient` class wrapping REST API (`https://app.backboard.io/api`), pure fetch, no external deps
- `app/actions/backboard.ts` — server actions with module-level caching for client + assistant_id + thread_id
  - `createBackboardThread()` — creates thread, stores thread_id server-side, returns it to client
  - `mirrorTurnToBackboard()` — sends user + agent text with `memory=Auto` (Backboard extracts memories)
  - `recallMemories(query)` — sends query with `memory=Readonly`, Backboard returns matched memories
  - `recallMemoriesStructured(query)` — same as above but returns `{text, memories[]}` for admin panel
  - `getBackboardSessionInfo()` — returns `{assistantId, threadId}` for admin panel
  - `fetchAllMemories()` — returns all stored `BackboardMemory[]` for admin panel
  - `listAssistants()` — lists all assistants for the current API key
  - `setActiveAssistant(id)` — switches active assistant (persists to file + cache)
  - `createNewAssistant(name)` — creates new assistant, switches to it
- `app/hooks/useConversationMirror.ts` — client hook that detects completed turn pairs and fires mirror calls; accepts optional `MirrorCallbacks` for status reporting
- Assistant ID auto-created on first run, persisted to `.backboard-assistant-id` file (gitignored)
- Auth: Backboard uses `X-API-Key` header with `BACKBOARD_API_KEY` env var

## Architecture — Flow vs Backboard
- **Flow = minimal voice brain**: STT + TTS + lightweight LLM for conversational flow. Does not carry heavy logic or long-term state.
- **Backboard = memory backend**: persistent memory extraction (via mirroring), storage, and intelligent recall. Receives full conversation via mirroring. Recall uses Backboard's native vector search + LLM filtering (Cerebras runs behind Backboard — we don't call it directly).
- Flow delegates to Backboard via tools (`recall_memories`) when it needs context beyond the current conversation.

## Architecture
- JWT generated server-side via Next.js server action (`app/actions/auth.ts`)
- Providers in `app/providers.tsx` wrap the app with Flow, audio recorder, and audio player contexts
- Audio worklet copied to `public/pcm-audio-worklet.min.js`
- Mic audio: Float32 → Int16 (PCM S16LE) → WebSocket → Flow agent
- Agent audio: Int16 (PCM S16LE) via WebSocket → browser playback

## Admin Debug Panel
- `app/contexts/AdminDebugContext.tsx` — React context shared between VoiceAgent (producer) and AdminPanel (consumer)
- `app/types/admin-debug.ts` — shared types: `MirrorLogEntry`, `ToolCallEntry`, `RecallEntry`, `SessionInfo`
- `app/components/SplitLayout.tsx` — fixed 50/50 flexbox layout
- `app/components/admin/AdminPanel.tsx` — root admin panel (SessionInfo + LiveFeed)
- `app/components/admin/SessionInfo.tsx` — session IDs, timer, memory list, recall results
- `app/components/admin/LiveFeed.tsx` — mirror log + tool call log with status badges
- Memory refresh: on session start + ~1.5s after each successful mirror (no polling timers)
