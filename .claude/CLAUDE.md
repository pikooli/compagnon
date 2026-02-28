> **This file MUST be kept up to date.**

# Project

- Next.js 16 (App Router, latest as of 2026-02-28)
- UI: shadcn/ui
- Voice: Speechmatics Flow (`@speechmatics/flow-client-react` + companion packages)
- Target audience: elderly people — prioritize large text, simple navigation, high contrast, minimal cognitive load

# Tool Calling
- `app/hooks/useFlowToolCalling.ts` patches WebSocket to work around SDK v0.2.2 lacking tool support
- When SDK is updated with native tool calling, refactor to remove the WS patching
- TEMPORARY: `get_data` in `app/lib/flow-tools.ts` is a hardcoded test tool — will be replaced with a real implementation

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
- When user says a branch is "ok" (or equivalent): commit, merge to main, delete the branch
- No PRs — direct merge workflow
