# Specs

## Architecture

- **Flow (Speechmatics)** = minimal voice brain. Handles STT, TTS, and lightweight conversational responses. Does not carry heavy logic or long-term memory.
- **Brain (LangGraph + Cerebras)** = centralized reasoning backend. Receives queries from Flow via a catch-all tool, uses its own tools (memory recall, etc.), and returns answers. Powered by Cerebras `gpt-oss-120b` for fast inference.
- **Backboard.io** = memory storage backend. Receives full conversation via mirroring (`memory=Auto`) and automatically extracts/stores memories. The brain queries Backboard for recall.
- Flow delegates to the brain via the `ask_brain` tool whenever the user asks something that needs deeper thinking, memory recall, or external lookups.

## Voice Agent (v1)

- Real-time voice conversation with a Speechmatics Flow agent
- Agent ID: `1d9e7010-5c07-40d4-8088-42a5a0bc5645:latest`
- Microphone selector (choose input device)
- Start/Stop conversation button
- Displays agent responses as text on screen
- Displays user transcript (what the user said)
- Audio playback of agent speech

## Tool Calling

- Speechmatics Flow tool calling wired up via WebSocket patching (SDK v0.2.2 lacks native support)
- Tool definitions injected into the `StartConversation` message at runtime
- UI indicator: pulsing yellow while executing, green on success, red on failure
- `ask_brain` catch-all tool — Flow passes the user's query to the brain API; brain uses LangGraph ReAct agent with its own tools (recall_memories, etc.) and returns the answer

## Brain (LangGraph)

- LangGraph ReAct agent using Cerebras `gpt-oss-120b` (~3,000 tokens/sec)
- Exposed as Next.js API route at `POST /api/brain`
- Accepts `{ message, threadId?, assistantId? }`, returns `{ response }`
- Tools: `recall_memories` (queries Backboard for stored memories via `memory=Readonly` or fallback `GET /memories`)
- Designed for extension — new tools can be added to `app/lib/brain/tools.ts`

## Memory (Backboard.io)

- Persistent memory layer — the agent remembers family members, preferences, routines across sessions
- **Mirroring**: every conversation turn is sent to Backboard in the background (fire-and-forget, `memory=Auto`). Backboard automatically extracts and stores relevant memories.
- **Recall** (via brain): the brain's `recall_memories` tool queries Backboard with `memory=Readonly` for vector search + LLM filtering. Fallback: dumps all memories via `GET /memories`.
- New Backboard thread per voice session; memories persist at assistant level across all threads
- Graceful degradation: if Backboard is unavailable, voice conversation continues normally

## Admin Debug Panel

- Fixed 50/50 split layout: voice agent (left), admin panel (right)
- Always visible (hackathon demo mode)
- **Session Info**: thread ID, assistant ID, session duration timer
- **Stored Memories**: full memory bank from Backboard, refreshed after each mirrored turn
- **Mirror Log**: each conversation turn pair sent to Backboard, with pending/sent/failed status
- **Tool Call Log**: each tool invocation with arguments, result, duration, and status
- Shared state via React Context (`AdminDebugContext`) — VoiceAgent pushes data, AdminPanel reads
