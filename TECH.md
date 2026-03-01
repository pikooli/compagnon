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
- `app/lib/brain/agent.ts` — LangGraph ReAct agent, singleton LLM, `invokeBrain()` function. Connects to MongoDB on each invocation.
- `app/lib/brain/tools/index.ts` — brain tools factory `createBrainTools(ctx)`; tools close over session context
- `app/lib/brain/tools/google/calendar.ts` — calendar CRUD tools (get, create, update, delete events)
- `app/lib/brain/tools/contact/index.ts` — contact search + upsert tools
- `app/lib/brain/tools/product/index.ts` — product search + upsert tools
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

## Google Calendar
- `googleapis` — Google Calendar API v3 SDK
- `app/lib/google-calendar.ts` — OAuth2 client, token management, `listCalendarEvents()`, `createCalendarEvent()`, `updateCalendarEvent()`, `deleteCalendarEvent()`
- `app/api/google-calendar/auth-url/route.ts` — GET: returns OAuth consent URL
- `app/api/google-calendar/callback/route.ts` — GET: OAuth callback, exchanges code for tokens
- `app/api/google-calendar/status/route.ts` — GET: returns `{ connected: boolean }`
- `app/api/google-calendar/disconnect/route.ts` — POST: deletes token file
- `app/components/GoogleCalendarConnect.tsx` — connect/disconnect button (used in VoiceAgent)
- OAuth tokens persisted to `.google-calendar-tokens.json` (gitignored)
- Token auto-refresh handled by `googleapis` OAuth2Client `tokens` event
- Scope: `calendar.events` (read + write)
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_REDIRECT_URI`

## MongoDB (Mongoose)
- `mongoose` — MongoDB ODM
- `app/lib/mongoose/mongoose.ts` — singleton connection (`connectMongo()`), uses `MONGO_URI` env var
- `app/lib/mongoose/schema/contact.schema.ts` — Contact model (name, company, role, city, email, phone, tags, notes)
- `app/lib/mongoose/schema/product.schema.ts` — Product model (name, description, price, tags)
- `app/lib/mongoose/schema/memory.schema.ts` — Memory model (name, memory, userId) — exists but not actively used (Backboard handles memory)
- `app/service/contact.ts` — contact CRUD operations (MongoDB queries + Qdrant vector search)
- `app/service/product.ts` — product CRUD operations (MongoDB queries + Qdrant vector search)

## Qdrant (Vector Search)
- `app/lib/qdrant/index.ts` — Qdrant client + OpenAI embedding helpers
- Uses OpenAI `text-embedding-3-small` for generating embeddings
- Semantic similarity search for contacts and products
- Env vars: `QDRANT_URL`, `QDRANT_API_KEY`, `OPENAI_API_KEY`

## Architecture — Flow → Brain → Services
- **Flow = minimal voice brain**: STT + TTS + lightweight LLM for conversational flow. Has a single `ask_brain` catch-all tool.
- **Brain = centralized reasoning**: LangGraph ReAct agent with Cerebras. Receives queries from Flow, uses its own tools to answer.
- **Brain tools**: recall_memories (Backboard), calendar CRUD (Google API), contact search/upsert (MongoDB + Qdrant), product search/upsert (MongoDB + Qdrant)
- Flow → `ask_brain` tool → `POST /api/brain` → LangGraph agent → tools → response back to Flow

## Architecture — Audio Pipeline
- JWT generated server-side via Next.js server action (`app/actions/auth.ts`)
- Providers in `app/providers.tsx` wrap the app with Flow, audio recorder, and audio player contexts
- Audio worklet copied to `public/pcm-audio-worklet.min.js`
- Mic audio: Float32 → Int16 (PCM S16LE) → WebSocket → Flow agent
- Agent audio: Int16 (PCM S16LE) via WebSocket → browser playback

## Admin Debug Panel
- `app/contexts/AdminDebugContext.tsx` — React context shared between VoiceAgent (producer) and AdminPanel (consumer)
- `app/types/admin-debug.ts` — shared types: `MirrorLogEntry`, `ToolCallEntry`, `RecallEntry`, `SessionInfo`
- `app/components/SplitLayout.tsx` — 50/50 flexbox layout, collapsible right panel
- `app/components/admin/AdminPanel.tsx` — root admin panel (SessionInfo + LiveFeed)
- `app/components/admin/SessionInfo.tsx` — session IDs, timer, memory list, recall results, calendar status
- `app/components/admin/LiveFeed.tsx` — mirror log + tool call log with status badges
- Memory refresh: on session start + ~1.5s after each successful mirror (no polling timers)

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SPEECHMATICS_API_KEY` | Yes | Voice STT/TTS |
| `CEREBRAS_API_KEY` | Yes | Brain LLM |
| `BACKBOARD_API_KEY` | Yes | Memory storage |
| `MONGO_URI` | Yes | MongoDB connection |
| `QDRANT_URL` | Yes | Vector search |
| `QDRANT_API_KEY` | Yes | Vector search auth |
| `OPENAI_API_KEY` | Yes | Text embeddings |
| `GOOGLE_CLIENT_ID` | Optional | Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar OAuth |
| `GOOGLE_REDIRECT_URI` | Optional | Defaults to `http://localhost:3000/api/google-calendar/callback` |
| `GOOGLE_REFRESH_TOKEN` | Optional | Bootstrap calendar without OAuth flow |
| `GOOGLE_ACCESS_TOKEN` | Optional | Bootstrap calendar without OAuth flow |
| `GOOGLE_EXPIRY_DATE` | Optional | Bootstrap calendar without OAuth flow |
