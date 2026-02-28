> **This file MUST be kept up to date.**

# Project

- Next.js 16 (App Router, latest as of 2026-02-28)
- UI: shadcn/ui
- Voice: Speechmatics Flow (`@speechmatics/flow-client-react` + companion packages)
- Brain: LangGraph ReAct agent + Cerebras `gpt-oss-120b` (centralized reasoning)
- Memory: Backboard.io (persistent memory storage + mirroring)
- Target audience: elderly people — prioritize large text, simple navigation, high contrast, minimal cognitive load

# Architecture Philosophy
- **Flow = minimal voice brain** — handles STT, TTS, and lightweight conversational LLM. Has a single `ask_brain` catch-all tool.
- **Brain = centralized reasoning** — LangGraph ReAct agent powered by Cerebras `gpt-oss-120b`. Receives queries from Flow, uses its own tools (recall_memories, etc.) to answer.
- **Backboard = memory storage** — receives full conversation via mirroring (`memory=Auto`), extracts and stores memories. Brain queries Backboard for recall.
- Flow delegates to the brain via the `ask_brain` tool whenever deeper thinking, recall, or external lookups are needed.

# Brain (LangGraph + Cerebras)
- `app/lib/brain/agent.ts` — LangGraph ReAct agent, singleton ChatCerebras LLM, `invokeBrain(message, context)` function
- `app/lib/brain/tools.ts` — brain tools factory `createBrainTools(ctx)`; tools close over session context (threadId, assistantId)
- `app/lib/brain/index.ts` — re-exports
- `app/api/brain/route.ts` — POST endpoint: `{ message, threadId?, assistantId? }` → `{ response }`
- Model: Cerebras `gpt-oss-120b` (MoE, ~3,000 tokens/sec)
- Agent re-created per request (graph compilation is lightweight); LLM instance cached
- Brain tools: `recall_memories` (queries Backboard API for stored memories), `get_calendar_events` (reads Google Calendar)
- New tools should be added to `app/lib/brain/tools.ts` in the `createBrainTools` function
- Env vars: `CEREBRAS_API_KEY` (required)

# Tool Calling
- `app/hooks/useFlowToolCalling.ts` patches WebSocket to work around SDK v0.2.2 lacking tool support
- When SDK is updated with native tool calling, refactor to remove the WS patching
- `ask_brain` tool in `app/lib/flow-tools.ts` — catch-all that calls `POST /api/brain`
- `executeToolCall()` passes session context (threadId, assistantId) to the brain API

# Memory (Backboard.io)
- `app/lib/backboard.ts` — REST wrapper for Backboard API (no external SDK, pure fetch)
- `app/actions/backboard.ts` — server actions: createBackboardThread, mirrorTurnToBackboard, getBackboardSessionInfo, fetchAllMemories, listAssistants, setActiveAssistant, createNewAssistant
- `app/hooks/useConversationMirror.ts` — auto-mirrors conversation turns to Backboard (fire-and-forget); accepts `MirrorCallbacks` for admin panel status reporting
- **Mirroring** (`memory=Auto`): every turn sent to Backboard in background; Backboard extracts + stores memories
- **Recall** (via brain): brain's `recall_memories` tool queries Backboard with `memory=Readonly` or fallback `GET /memories`
- Memories persist at the assistant level; new thread created per voice session
- Backboard failures never break the voice conversation — all errors are caught and logged
- Env vars: `BACKBOARD_API_KEY` (required)
- Assistant ID auto-persisted to `.backboard-assistant-id` file (gitignored, created on first run)

# Google Calendar
- `app/lib/google-calendar.ts` — OAuth2 client, token management, `listCalendarEvents()` function
- `app/api/google-calendar/auth-url/route.ts` — GET: returns OAuth consent URL
- `app/api/google-calendar/callback/route.ts` — GET: OAuth callback, exchanges code for tokens
- `app/api/google-calendar/status/route.ts` — GET: returns `{ connected: boolean }`
- `app/api/google-calendar/disconnect/route.ts` — POST: deletes token file
- `app/components/GoogleCalendarConnect.tsx` — connect/disconnect button (used in VoiceAgent)
- OAuth tokens persisted to `.google-calendar-tokens.json` (gitignored, auto-created on OAuth)
- Token auto-refresh handled by `googleapis` OAuth2Client `tokens` event
- Read-only access (scope: `calendar.readonly`), single Google account at a time
- Calendar failures never break the voice conversation — all errors caught and logged
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (required for calendar feature)
- Optional env vars for bootstrapping without OAuth flow: `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_EXPIRY_DATE`
- Optional: `GOOGLE_REDIRECT_URI` (defaults to `http://localhost:3000/api/google-calendar/callback`)

# Admin Debug Panel
- 50/50 split layout: voice agent (left), admin panel (right). Always visible.
- `app/contexts/AdminDebugContext.tsx` — React context shared between VoiceAgent (data producer) and AdminPanel (data consumer)
- `app/types/admin-debug.ts` — shared types: MirrorLogEntry, ToolCallEntry, RecallEntry, SessionInfo
- `app/components/SplitLayout.tsx` — fixed 50/50 flexbox split
- `app/components/admin/AdminPanel.tsx` — root admin container
- `app/components/admin/SessionInfo.tsx` — session IDs, timer, stored memories, recall results
- `app/components/admin/LiveFeed.tsx` — mirror log + tool call log with status badges
- Memory data refreshed on session start and after each mirrored turn (no polling)

# Important

- Always look up latest official docs online before writing code. Do NOT rely on training knowledge for Next.js, shadcn, or any dependency — it may be outdated.
- NEVER run `npm run dev`, `npm run build`, or test commands. The user runs the dev server themselves.
- Use the browser (Chrome MCP) only to check visual UI. Never use it to test audio, mic, or any hardware-dependent features — you cannot.

# Workflow Phases

## Pre-Planning (before entering plan mode)
1. **Read the code** — understand the current codebase state relevant to the request
2. **Ask clarifying questions** — use the question tool to resolve ambiguities with the user
3. **Research online** — look up docs, APIs, libraries, or examples to assess what's doable
4. **Challenge the user** — push back on what is feasible, suggest alternatives, flag risks or trade-offs before committing to a direction

Only after these steps are done, enter plan mode.

## Planning (in plan mode)
1. Do a more thorough codebase search and internet research
2. Plan edits to SPECS.md, TECH.md, and CLAUDE.md if needed
3. Write a detailed implementation plan
4. Exit plan mode for user approval

## Working
- Always create a new branch before coding
- Update SPECS.md, TECH.md, CLAUDE.md as you go

## Merging
- When user says a branch is "ok" (or equivalent): commit, merge to main, delete the branch, push to remote
- Always push main to remote after merging — remote must stay up to date
- No PRs — direct merge workflow
