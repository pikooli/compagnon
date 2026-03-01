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
- `app/lib/brain/agent.ts` — LangGraph ReAct agent, singleton ChatCerebras LLM, `invokeBrain(message, ctx)` returns `BrainResult { response, uiCommands }`
- `app/lib/brain/tools/index.ts` — brain tools factory `createBrainTools(ctx)`; tools close over session context (threadId, assistantId, uiCommands)
- `app/lib/brain/index.ts` — re-exports `invokeBrain`, `BrainResult`, `BrainContext`
- `app/api/brain/route.ts` — POST endpoint: `{ message, threadId?, assistantId?, displayedEvents?, displayedEmails?, conversationHistory? }` → `{ response, uiCommands }`. When `displayedEvents` or `displayedEmails` are present, prepends them as structured context to the message.
- Model: Cerebras `gpt-oss-120b` (MoE, ~3,000 tokens/sec)
- **Conversation history**: full `messages` array (user/agent turns) is sent from `useVoiceSession` → `flow-tools` → `POST /api/brain` → `invokeBrain`. Prior turns are prepended as LangGraph messages before the current enriched user message. The last history entry is excluded (it duplicates the current enriched message). This gives the brain full conversational context for detecting implicit preferences and reasoning about prior exchanges.
- Agent re-created per request (graph compilation is lightweight); LLM instance cached
- Brain tools: `recall_memories` (queries Backboard API for stored memories), `get_calendar_events` (reads Google Calendar + auto-pushes UICommand), `create_calendar_event` (creates Google Calendar event + auto-pushes `AddCalendarEventCommand`), `update_calendar_event` (updates Google Calendar + auto-pushes `UpdateCalendarEventCommand`), `delete_calendar_event` (deletes Google Calendar event + auto-pushes `RemoveCalendarEventCommand`), `focus_calendar_event` (pure UI — pushes `FocusCalendarEventCommand` to show event detail view), `unfocus_calendar_event` (pure UI — pushes `UnfocusCalendarEventCommand` to return to list view), `get_emails` (reads Gmail inbox + auto-pushes `DisplayEmailsCommand`), `focus_email` (fetches full email body + pushes `FocusEmailCommand` with body data), `unfocus_email` (pure UI — pushes `UnfocusEmailCommand` to return to email list), `trash_email` (moves email to trash + pushes `RemoveEmailCommand`), `send_email` (sends email via Gmail), `save_rule` (saves user preference to `.user-rules.md`), `remove_rule` (removes a preference), `list_rules` (returns all saved preferences)
- All calendar and email tools are factories that accept `BrainContext` (for `ctx.uiCommands` access)
- New tools should be added to `app/lib/brain/tools/index.ts` in the `createBrainTools` function
- Data-fetching tools can auto-push `UICommand` entries to `ctx.uiCommands` for frontend display
- **Proactive calendar checking**: system prompt instructs the agent to always call `get_calendar_events` before `create_calendar_event` to detect conflicts and suggest free slots. No extra tools needed — LangGraph ReAct chains the calls naturally.
- Env vars: `CEREBRAS_API_KEY` (required)

# Tool Calling
- `app/hooks/useFlowToolCalling.ts` patches WebSocket to work around SDK v0.2.2 lacking tool support
- When SDK is updated with native tool calling, refactor to remove the WS patching
- `ask_brain` tool in `app/lib/flow-tools.ts` — catch-all that calls `POST /api/brain`
- `executeToolCall()` passes session context (threadId, assistantId, displayedEvents, displayedEmails, focusedEventId, focusedEmailId, conversationHistory) + optional `onUICommands` callback to forward UI commands from the brain API response
- **Navigation intercept**: `executeToolCall` intercepts "go back" phrases (regex: `/\b(go back|back to|return to|show all)\b/i`) in the `ask_brain` message *before* hitting the brain. If something is focused, pushes the unfocus UICommand client-side and returns instantly — no brain round-trip needed. Falls through to brain if nothing is focused.
- `ToolCallingCallbacks.onUICommands` — called when brain returns UI commands; `useVoiceSession` wires this to `UICommandContext.pushCommands`

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

# User Rules
- `app/lib/rules.ts` — file I/O utility: `readRules()`, `listRules()`, `addRule()`, `removeRule()`
- `app/lib/brain/tools/rules.ts` — brain tools: `save_rule`, `remove_rule`, `list_rules`
- Rules persisted to `.user-rules.md` (project root, gitignored, auto-created on first rule save)
- Rules injected into brain system prompt on every `invokeBrain()` call via `getSystemPrompt(rulesText)`
- Brain detects implicit preferences from conversation and saves them via `save_rule` tool
- When an action would violate a rule, brain warns user via voice and asks for confirmation
- No categorization — flat list of free-form rules in markdown bullet format
- Rules are global (not per-assistant or per-thread), single-user
- Rule file format: one rule per line, each starting with `- `

# Google Calendar
- `app/lib/google-calendar.ts` — OAuth2 client, token management, `listCalendarEvents()` function
- `app/api/google-calendar/auth-url/route.ts` — GET: returns OAuth consent URL
- `app/api/google-calendar/callback/route.ts` — GET: OAuth callback, exchanges code for tokens
- `app/api/google-calendar/status/route.ts` — GET: returns `{ connected: boolean }`
- `app/api/google-calendar/disconnect/route.ts` — POST: deletes token file
- `app/components/GoogleCalendarConnect.tsx` — connect/disconnect button (currently unused in new UI, available for settings)
- OAuth tokens persisted to `.google-calendar-tokens.json` (gitignored, auto-created on OAuth)
- Token auto-refresh handled by `googleapis` OAuth2Client `tokens` event
- Calendar scope: `calendar.events`; Gmail scopes: `gmail.modify` + `gmail.send`; single Google account at a time
- Calendar failures never break the voice conversation — all errors caught and logged
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (required for calendar feature)
- Optional env vars for bootstrapping without OAuth flow: `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_EXPIRY_DATE`
- Optional: `GOOGLE_REDIRECT_URI` (defaults to `http://localhost:3000/api/google-calendar/callback`)

# Interactive UI Commands
- **Pattern**: brain tools auto-push `UICommand` entries to `ctx.uiCommands` during execution; no separate "display" tool needed
- `app/types/ui-commands.ts` — shared types: `UICommand`, `DisplayCalendarCommand`, `UpdateCalendarEventCommand`, `AddCalendarEventCommand`, `RemoveCalendarEventCommand`, `FocusCalendarEventCommand`, `UnfocusCalendarEventCommand`, `CalendarEventData`, `EmailData`, `DisplayEmailsCommand`, `FocusEmailCommand`, `UnfocusEmailCommand`, `RemoveEmailCommand`, `KnownUICommand` union
- `app/contexts/UICommandContext.tsx` — React context: `pushCommands`, `dismissCommand`, `clearCommands`, `recentlyUpdatedEventIds`, `recentlyAddedEventIds`, `recentlyRemovedEventIds`, `focusedEventId`, `setFocusedEventId`, `focusedEmailId`, `setFocusedEmailId`, `recentlyRemovedEmailIds`; wraps entire app in `page.tsx`
- **Calendar mutation pattern**: `pushCommands` detects mutation commands (`update_calendar_event`, `add_calendar_event`, `remove_calendar_event`) and mutates the existing `display_calendar` command in-place. None of these mutation commands are appended to the commands array. `recentlyUpdatedEventIds` (blue glow, 2s), `recentlyAddedEventIds` (green glow, 2s), and `recentlyRemovedEventIds` (triggers exit animation, event spliced after 400ms) track visual state.
- **Email mutation pattern**: `pushCommands` intercepts `remove_email` → marks for exit animation via `recentlyRemovedEmailIds`, splices from `display_emails` after 400ms. `focus_email` with body data updates the email's `body` field in `display_emails` in-place.
- **Focus/unfocus pattern**: `pushCommands` intercepts `focus_calendar_event` → sets `focusedEventId`, `unfocus_calendar_event` → clears it. `focus_email` → sets `focusedEmailId`, `unfocus_email` → clears it. Neither is appended to commands array. IDs cleared on removal or `clearCommands()`.
- **Displayed events/emails context**: `useVoiceSession` extracts `displayedEvents` and `displayedEmails` from the last `display_calendar`/`display_emails` commands and passes them through `sessionContext` → `flow-tools.ts` → `POST /api/brain`. The route prepends them to the user message so the brain LLM can match "my 2pm meeting" or "that email from John" to exact IDs.
- `app/components/interactive/InteractivePanel.tsx` — reads `UICommandContext`, switch-renders by command `type` (`display_calendar`, `display_emails`), `AnimatePresence` for animations
- `app/components/interactive/CalendarDisplay.tsx` — renders calendar event cards with framer-motion; `AnimatePresence` wraps card list for entry/exit animations; blue glow for updated cards, green glow for added cards, slide-left + collapse exit for removed cards; when `focusedEventId` is set, renders `MeetingDetailView` instead of card list; elderly-friendly large text
- `app/components/interactive/MeetingDetailView.tsx` — full event detail view: title, full date, time range, location, full description (no truncation), all attendees with response status icons (accepted=green, declined=red, tentative=yellow, no response=gray); back button returns to list
- `app/components/interactive/EmailDisplay.tsx` — renders email cards (sender, subject, snippet, date, unread dot) with framer-motion; slide-left + collapse exit for removed emails; when `focusedEmailId` is set, renders `EmailDetailView` (subject, from, date, full body) with back button; elderly-friendly large text
- Commands accumulate per session; `clearCommands()` called on new session start
- To add a new display type: (1) add type to `ui-commands.ts`, (2) auto-push in the brain tool, (3) add case in `InteractivePanel`

# Layout & UI States
- `app/hooks/useVoiceSession.ts` — custom hook: extracts all session logic (state, effects, callbacks, handlers) from the old VoiceAgent component. Returns `isActive`, `isRecording`, `messages`, `latestAgentMessage`, `hasInteractiveContent`, handlers, etc.
- `app/components/AppShell.tsx` — top-level orchestrator, replaces old SplitLayout. Uses `useVoiceSession()` hook. Three UI states:
  - **Landing** (`!isActive`): full-screen centered "Start" button with pulsing glow (`LandingScreen`)
  - **Active, no content** (`isActive && !hasInteractiveContent`): full-width centered mic icon with pulse animation + latest agent message (`ActiveSession`)
  - **Active, with content** (`isActive && hasInteractiveContent`): mic view 50% left + interactive panel 50% slides in from right. On mobile, interactive panel is a bottom sheet overlay.
- `app/components/LandingScreen.tsx` — full-screen start button with framer-motion pulsing glow
- `app/components/ActiveSession.tsx` — minimal mic view: large mic icon with pulse rings, latest agent message (crossfade), partial transcript, stop/mute controls
- `app/components/interactive/InteractivePanel.tsx` — renders calendar/email cards; only shown when `uiCommands.length > 0`
- Transitions: `AnimatePresence mode="wait"` for landing ↔ active; spring animation for panel slide-in
- AdminPanel still exists but is not rendered in the default UI (available for dev use)

# Admin Debug Panel
- `app/contexts/AdminDebugContext.tsx` — React context shared between `useVoiceSession` (data producer) and AdminPanel (data consumer)
- `app/types/admin-debug.ts` — shared types: MirrorLogEntry, ToolCallEntry, RecallEntry, SessionInfo
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
- **Multiple people work on this codebase — always use PRs, never direct merge to main.**
- When the branch is ready: push to remote, open a PR via `gh pr create`, let it be reviewed and merged via GitHub.
- **Before any action that impacts the remote** (push, PR creation, force push, branch deletion on remote, etc.), ALWAYS:
  1. Explain what the action will do and its impact
  2. Ask the user to confirm before proceeding
  3. Only proceed after explicit approval
- Never push directly to main. Never merge locally into main and push.
