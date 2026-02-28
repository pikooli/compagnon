# Specs

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
- TEMPORARY test tool: `get_data` — returns hardcoded text after a 3s fake delay. Will be replaced with a real implementation.
