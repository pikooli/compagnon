> **This file MUST be kept up to date.**

# Project

- Next.js 16 (App Router, latest as of 2026-02-28)
- UI: shadcn/ui
- Voice: Speechmatics Flow (`@speechmatics/flow-client-react` + companion packages)
- Memory: Backboard.io (persistent memory + vector-search recall)
- Target audience: elderly people — prioritize large text, simple navigation, high contrast, minimal cognitive load

# Architecture Philosophy
- **Flow = minimal voice brain** — handles STT, TTS, and lightweight conversational LLM. It should not carry heavy logic.
- **Backboard = secondary backend** — handles memory storage, recall intelligence, and any heavy LLM reasoning. It receives the full conversation via mirroring.
- Flow delegates to Backboard via tools whenever it needs context beyond the current conversation.

# Tool Calling
- `app/hooks/useFlowToolCalling.ts` patches WebSocket to work around SDK v0.2.2 lacking tool support
- When SDK is updated with native tool calling, refactor to remove the WS patching
- `recall_memories` tool in `app/lib/flow-tools.ts` — calls Backboard to retrieve stored memories

# Memory (Backboard.io)
- `app/lib/backboard.ts` — REST wrapper for Backboard API (no external SDK, pure fetch)
- `app/actions/backboard.ts` — server actions: createBackboardThread, mirrorTurnToBackboard, recallMemories
- `app/hooks/useConversationMirror.ts` — auto-mirrors conversation turns to Backboard (fire-and-forget)
- **Mirroring** (`memory=Auto`): every turn sent to Backboard in background; Backboard extracts + stores memories
- **Recall** (`memory=Readonly`): Flow passes user's query via tool; Backboard's vector search returns scored memories from `retrieved_memories` field (deduplicated); Flow's LLM presents them
- Fallback: if no thread available, falls back to `GET /memories` (dump all)
- Memories persist at the assistant level; new thread created per voice session
- Backboard failures never break the voice conversation — all errors are caught and logged
- Env vars: `BACKBOARD_API_KEY` (required)
- Assistant ID auto-persisted to `.backboard-assistant-id` file (gitignored, created on first run)

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
