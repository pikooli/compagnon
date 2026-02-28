# Specs

## Architecture

- **Flow (Speechmatics)** = minimal voice brain. Handles STT, TTS, and lightweight conversational responses. Does not carry heavy logic or long-term memory.
- **Backboard.io** = secondary backend. Handles persistent memory, intelligent recall (vector search), and any heavy reasoning. Receives the full conversation via mirroring.
- Flow delegates to Backboard via tools when it needs context beyond the current conversation.

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
- `recall_memories` tool — Flow passes the user's query; Backboard recalls relevant memories via native vector search + LLM filtering

## Memory (Backboard.io)

- Persistent memory layer — the agent remembers family members, preferences, routines across sessions
- **Mirroring**: every conversation turn is sent to Backboard in the background (fire-and-forget, `memory=Auto`). Backboard automatically extracts and stores relevant memories.
- **Recall**: `recall_memories` tool sends the query to Backboard with `memory=Readonly`. Backboard performs vector search + LLM filtering internally (using Cerebras behind the scenes) and returns matched memories. Fallback: if no active thread, dumps all memories via `GET /memories`. Flow's LLM incorporates the results into its spoken response.
- New Backboard thread per voice session; memories persist at assistant level across all threads
- Graceful degradation: if Backboard is unavailable, voice conversation continues normally

## Admin Debug Panel

- Fixed 50/50 split layout: voice agent (left), admin panel (right)
- Always visible (hackathon demo mode)
- **Session Info**: thread ID, assistant ID, session duration timer
- **Stored Memories**: full memory bank from Backboard, refreshed after each mirrored turn
- **Recall Results**: when `recall_memories` fires — shows query, returned memories with relevance scores
- **Mirror Log**: each conversation turn pair sent to Backboard, with pending/sent/failed status
- **Tool Call Log**: each tool invocation with arguments, result, duration, and status
- Shared state via React Context (`AdminDebugContext`) — VoiceAgent pushes data, AdminPanel reads
