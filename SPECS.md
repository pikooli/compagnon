# Specs

## Architecture

- **Flow (Speechmatics)** = minimal voice brain. Handles STT, TTS, and lightweight conversational responses. Does not carry heavy logic or long-term memory.
- **Brain (LangGraph + Cerebras)** = centralized reasoning backend. Receives queries from Flow via a catch-all tool, uses its own tools (memory recall, calendar, contacts, products), and returns answers. Powered by Cerebras `gpt-oss-120b` for fast inference.
- **Backboard.io** = memory storage backend. Receives full conversation via mirroring (`memory=Auto`) and automatically extracts/stores memories. The brain queries Backboard for recall.
- **MongoDB** = structured data storage for contacts and products. Paired with Qdrant for vector/semantic search.
- **Qdrant** = vector database for semantic similarity search over contacts and products. Embeddings generated via OpenAI.
- Flow delegates to the brain via the `ask_brain` tool whenever the user asks something that needs deeper thinking, memory recall, or external lookups.

## Voice Agent

- Real-time voice conversation with a Speechmatics Flow agent
- Microphone selector (choose input device)
- Male/Female voice agent selector
- Start/Stop conversation button
- Mute/unmute microphone during active conversation
- Displays agent responses as text on screen
- Displays user transcript (what the user said)
- Audio playback of agent speech

## Tool Calling

- Speechmatics Flow tool calling wired up via WebSocket patching (SDK v0.2.2 lacks native support)
- Tool definitions injected into the `StartConversation` message at runtime
- UI indicator: pulsing yellow while executing, green on success, red on failure
- `ask_brain` catch-all tool — Flow passes the user's query to the brain API; brain uses LangGraph ReAct agent with its own tools and returns the answer

## Brain (LangGraph)

- LangGraph ReAct agent using Cerebras `gpt-oss-120b` (~3,000 tokens/sec)
- Exposed as Next.js API route at `POST /api/brain`
- Accepts `{ message, threadId?, assistantId? }`, returns `{ response }`
- Brain tools:
  - **recall_memories** — queries Backboard for stored memories (preferences, family, routines)
  - **get_calendar_events** — retrieve events (today, tomorrow, this week, upcoming)
  - **create_calendar_event** — add new events with time, location, description
  - **update_calendar_event** — reschedule or modify existing events
  - **delete_calendar_event** — remove events from calendar
  - **searchContactByQuery** — semantic search for contacts via Qdrant
  - **searchContact** — structured field search (name, company, role, city, email, phone, tags, notes)
  - **upsertContact** — create or update contact information
  - **searchProduct** — semantic search for products via Qdrant
  - **upsertProduct** — create or update product info (name, description, price, tags)

## Memory (Backboard.io)

- Persistent memory layer — the agent remembers family members, preferences, routines across sessions
- **Mirroring**: every conversation turn is sent to Backboard in the background (fire-and-forget, `memory=Auto`). Backboard automatically extracts and stores relevant memories.
- **Recall** (via brain): the brain's `recall_memories` tool queries Backboard with `memory=Readonly` for vector search + LLM filtering. Fallback: dumps all memories via `GET /memories`.
- New Backboard thread per voice session; memories persist at assistant level across all threads
- Graceful degradation: if Backboard is unavailable, voice conversation continues normally

## Google Calendar

- OAuth2 authentication flow (connect/disconnect from UI)
- Full CRUD: read, create, update, delete events
- Scope: `calendar.events` (read + write)
- Token auto-refresh and persistence to file
- Graceful degradation: tools return friendly message if not connected

## Contacts (MongoDB + Qdrant)

- Structured contact storage in MongoDB (name, company, role, city, email, phone, tags, notes)
- Semantic search via Qdrant vector embeddings (OpenAI text-embedding-3-small)
- CRUD via brain tools (search by query, search by fields, upsert)

## Products (MongoDB + Qdrant)

- Product/inventory storage in MongoDB (name, description, price, tags)
- Semantic search via Qdrant vector embeddings
- CRUD via brain tools (search, upsert)

## Multi-Assistant Support

- Multiple assistants per Backboard API key
- Create new assistants dynamically from the UI
- Switch between assistants mid-session (each has independent memory bank)
- Active assistant ID persisted to `.backboard-assistant-id` file

## Admin Debug Panel

- 50/50 split layout: voice agent (left), admin panel (right). Collapsible.
- **Session Info**: thread ID, assistant ID, session duration timer, calendar connection status
- **Stored Memories**: full memory bank from Backboard, refreshed after each mirrored turn
- **Recall Results**: results from the most recent memory recall
- **Mirror Log**: each conversation turn pair sent to Backboard, with pending/sent/failed status
- **Tool Call Log**: each tool invocation with arguments, result, duration, and status
- Shared state via React Context (`AdminDebugContext`) — VoiceAgent pushes data, AdminPanel reads
