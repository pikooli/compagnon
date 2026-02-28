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

## Planning
1. Read current codebase state
2. Research internet sources if needed
3. Ask clarifying questions via the question tool
4. Plan edits to SPECS.md, TECH.md, and CLAUDE.md if needed
5. Once agreed, write the plan

## Working
- Always create a new branch before coding
- Update SPECS.md, TECH.md, CLAUDE.md as you go

## Merging
- When user says a branch is "ok" (or equivalent): commit, merge to main, delete the branch
- No PRs — direct merge workflow
