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
- `ask_brain` catch-all tool calls the brain API route via `fetch("/api/brain")`; passes session context (threadId, assistantId)

## Brain (LangGraph + Cerebras)
- `@langchain/langgraph` — agent orchestration (createReactAgent)
- `@langchain/cerebras` — ChatCerebras LLM binding for Cerebras Cloud
- `@langchain/core` — base types (messages, tools)
- `zod` — tool schema definitions
- **Model**: Cerebras `gpt-oss-120b` (MoE, ~3,000 tokens/sec, OpenAI-compatible API)
- `app/lib/brain/agent.ts` — LangGraph ReAct agent, singleton LLM, `invokeBrain()` function
- `app/lib/brain/tools.ts` — brain tools (recall_memories via Backboard API); tools are created per-request to close over session context
- `app/lib/brain/index.ts` — re-exports
- `app/api/brain/route.ts` — POST endpoint: accepts `{ message, threadId?, assistantId? }`, invokes brain agent, returns `{ response }`
- Agent is re-created per request (lightweight graph compilation); LLM instance is cached

## Memory (Backboard.io)
- `app/lib/backboard.ts` — `BackboardClient` class wrapping REST API (`https://app.backboard.io/api`), pure fetch, no external deps
- `app/actions/backboard.ts` — server actions with module-level caching for client + assistant_id + thread_id
  - `createBackboardThread()` — creates thread, stores thread_id server-side, returns it to client
  - `mirrorTurnToBackboard()` — sends user + agent text with `memory=Auto` (Backboard extracts memories)
  - `getBackboardSessionInfo()` — returns `{assistantId, threadId}` for admin panel
  - `fetchAllMemories()` — returns all stored `BackboardMemory[]` for admin panel
  - `listAssistants()` — lists all assistants for the current API key
  - `setActiveAssistant(id)` — switches active assistant (persists to file + cache)
  - `createNewAssistant(name)` — creates new assistant, switches to it
- `app/hooks/useConversationMirror.ts` — client hook that detects completed turn pairs and fires mirror calls; accepts optional `MirrorCallbacks` for status reporting
- Assistant ID auto-created on first run, persisted to `.backboard-assistant-id` file (gitignored)
- Auth: Backboard uses `X-API-Key` header with `BACKBOARD_API_KEY` env var

## Architecture — Flow → Brain → Backboard
- **Flow = minimal voice brain**: STT + TTS + lightweight LLM for conversational flow. Has a single `ask_brain` catch-all tool.
- **Brain = centralized reasoning**: LangGraph ReAct agent with Cerebras. Receives queries from Flow, uses its own tools to answer. Currently has `recall_memories` tool.
- **Backboard = memory storage**: persistent memory extraction via mirroring (`memory=Auto`). Brain queries Backboard for recall (`memory=Readonly` or `GET /memories` fallback).
- Flow → `ask_brain` tool → `POST /api/brain` → LangGraph agent → tools (recall_memories → Backboard API) → response back to Flow

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
