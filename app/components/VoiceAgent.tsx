"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  useFlow,
  useFlowEventListener,
  type AgentAudioEvent,
  type FlowIncomingMessageEvent,
} from "@speechmatics/flow-client-react";
import {
  useAudioDevices,
  usePCMAudioRecorderContext,
  usePCMAudioListener,
} from "@speechmatics/browser-audio-input-react";
import { usePCMAudioPlayerContext } from "@speechmatics/web-pcm-player-react";
import { getJWT } from "@/app/actions/auth";
import {
  getBackboardSessionInfo,
  listAssistants,
  setActiveAssistant,
  fetchAllMemories,
  createNewAssistant,
} from "@/app/actions/backboard";
import type { BackboardAssistant } from "@/app/lib/backboard";
import {
  useFlowToolCalling,
  type ToolCallingCallbacks,
  type ToolCallingContext,
} from "@/app/hooks/useFlowToolCalling";
import {
  useConversationMirror,
  type MirrorCallbacks,
} from "@/app/hooks/useConversationMirror";
import type { ToolInvokeMessage } from "@/app/lib/flow-tools";
import { useAdminDebug } from "@/app/contexts/AdminDebugContext";
import { GoogleCalendarConnect } from "@/app/components/GoogleCalendarConnect";

const AGENT_ID = "1d9e7010-5c07-40d4-8088-42a5a0bc5645:latest";

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function VoiceAgent() {
  const [isActive, setIsActive] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [assistants, setAssistants] = useState<BackboardAssistant[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [newAssistantName, setNewAssistantName] = useState<string>("");
  const [creatingAssistant, setCreatingAssistant] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "agent"; text: string }[]
  >([]);
  const [userPartialText, setUserPartialText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sessionThreadId, setSessionThreadId] = useState<string | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { startConversation, endConversation, sendAudio, socketState } =
    useFlow();
  const audioDevices = useAudioDevices();
  const { startRecording, stopRecording, isRecording, audioContext: recorderAudioContext } =
    usePCMAudioRecorderContext();
  const { playAudio, audioContext: playerAudioContext } = usePCMAudioPlayerContext();

  const {
    setSession,
    addMirrorEntry,
    updateMirrorEntry,
    addToolCall,
    updateToolCall,
    setAllMemories,
    resetSession,
  } = useAdminDebug();

  // Mirror callbacks for admin panel
  const mirrorCallbacks: MirrorCallbacks = useMemo(
    () => ({
      onThreadCreated: (threadId) => {
        setSession({ threadId });
        setSessionThreadId(threadId);
      },
      onMirrorStart: (id, userText, agentText) => {
        addMirrorEntry({
          id,
          userText,
          agentText,
          status: "pending",
          timestamp: Date.now(),
        });
      },
      onMirrorComplete: (id) => {
        updateMirrorEntry(id, { status: "sent" });
      },
      onMirrorFail: (id, error) => {
        updateMirrorEntry(id, { status: "failed", error });
      },
    }),
    [setSession, addMirrorEntry, updateMirrorEntry],
  );

  // Tool calling callbacks for admin panel
  const toolCallbacks: ToolCallingCallbacks = useMemo(
    () => ({
      onToolCallStart: (entry) => {
        addToolCall(entry);
      },
      onToolCallEnd: (id, update) => {
        updateToolCall(id, update);
      },
    }),
    [addToolCall, updateToolCall],
  );

  // Session context for brain API calls
  const sessionContext: ToolCallingContext = useMemo(
    () => ({
      threadId: sessionThreadId,
      assistantId: selectedAssistantId || undefined,
    }),
    [sessionThreadId, selectedAssistantId],
  );

  const { activeToolCall, handleToolInvoke } =
    useFlowToolCalling(toolCallbacks, sessionContext);

  // Mirror conversation turns to Backboard for memory extraction
  useConversationMirror(messages, isActive, mirrorCallbacks);

  // Use refs so audio listener always sees latest values without re-registering
  const isActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Send mic audio to Flow (skipped when muted)
  usePCMAudioListener(
    useCallback(
      (audio: Float32Array) => {
        if (isActiveRef.current && !isMutedRef.current) {
          sendAudio(float32ToInt16(audio).buffer);
        }
      },
      [sendAudio],
    ),
  );

  // Play agent audio
  useFlowEventListener(
    "agentAudio",
    useCallback(
      (ev: AgentAudioEvent) => {
        playAudio(ev.data);
      },
      [playAudio],
    ),
  );

  // Handle messages
  useFlowEventListener(
    "message",
    useCallback((ev: FlowIncomingMessageEvent) => {
      const msg = ev.data;

      // ToolInvoke is injected via WS patch and not in the SDK type union
      if ((msg as unknown as { message: string }).message === "ToolInvoke") {
        handleToolInvoke(msg as unknown as ToolInvokeMessage);
        return;
      }

      switch (msg.message) {
        case "ResponseStarted":
          setUserPartialText("");
          setIsAgentSpeaking(true);
          break;
        case "ResponseCompleted":
          setMessages((prev) => [...prev, { role: "agent", text: msg.content }]);
          setIsAgentSpeaking(false);
          break;
        case "AddTranscript":
          // Skip punctuation-only transcripts (e.g. a lone ".")
          if (msg.metadata.transcript.trim() && /\w/.test(msg.metadata.transcript)) {
            setMessages((prev) => {
              // Accumulate into the last user message if it exists,
              // otherwise create a new one
              if (prev.length > 0 && prev[prev.length - 1].role === "user") {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: updated[updated.length - 1].text + msg.metadata.transcript,
                };
                return updated;
              }
              return [...prev, { role: "user", text: msg.metadata.transcript }];
            });
          }
          setUserPartialText("");
          break;
        case "AddPartialTranscript":
          setUserPartialText(msg.metadata.transcript);
          break;
        case "ConversationEnded":
          setIsActive(false);
          setIsAgentSpeaking(false);
          break;
        case "Error":
          setError(JSON.stringify(msg));
          setIsActive(false);
          setIsAgentSpeaking(false);
          break;
      }
    }, [handleToolInvoke]),
  );

  // Fetch available assistants on mount
  useEffect(() => {
    listAssistants().then((list) => {
      setAssistants(list);
      // Pre-select the current active assistant and load its memories
      getBackboardSessionInfo().then((info) => {
        if (info.assistantId) {
          setSelectedAssistantId(info.assistantId);
          setSession({ assistantId: info.assistantId });
          fetchAllMemories().then(setAllMemories);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request mic permissions on mount
  useEffect(() => {
    if (audioDevices.permissionState === "prompt") {
      audioDevices.promptPermissions();
    }
  }, [audioDevices]);

  const handleCreateAssistant = async () => {
    const name = newAssistantName.trim();
    if (!name) return;
    setCreatingAssistant(true);
    try {
      const assistant = await createNewAssistant(name);
      if (assistant) {
        setAssistants((prev) => [...prev, assistant]);
        setSelectedAssistantId(assistant.assistant_id);
        setSession({ assistantId: assistant.assistant_id });
        setAllMemories([]);
        setNewAssistantName("");
      }
    } finally {
      setCreatingAssistant(false);
    }
  };

  const handleAssistantChange = async (assistantId: string) => {
    setSelectedAssistantId(assistantId);
    if (assistantId) {
      await setActiveAssistant(assistantId);
      setSession({ assistantId });
      fetchAllMemories().then(setAllMemories);
    }
  };

  const handleStart = async () => {
    try {
      setError("");
      setMessages([]);
      setUserPartialText("");
      setSessionThreadId(null);
      resetSession();

      // Ensure the selected assistant is active on the server
      if (selectedAssistantId) {
        await setActiveAssistant(selectedAssistantId);
      }

      // Resume AudioContexts (browsers suspend them until user gesture)
      await Promise.all([
        recorderAudioContext?.resume(),
        playerAudioContext?.resume(),
      ]);

      const jwt = await getJWT();

      await startConversation(jwt, {
        config: {
          template_id: AGENT_ID,
          template_variables: {},
        },
        audioFormat: {
          type: "raw",
          encoding: "pcm_s16le",
          sample_rate: 16000,
        },
      });

      setIsActive(true);
      setSession({ startedAt: Date.now() });

      // Fetch session info (assistant ID) from server
      getBackboardSessionInfo().then((info) => {
        setSession({ assistantId: info.assistantId });
      });

      await startRecording({
        deviceId: selectedDeviceId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStop = () => {
    stopRecording();
    endConversation();
    setIsActive(false);
    setIsAgentSpeaking(false);
    setIsMuted(false);
  };

  const deviceList =
    audioDevices.permissionState === "granted" ? audioDevices.deviceList : [];

  return (
    <div className="flex flex-col min-h-full bg-[#070d1f]">
      {/* ── Gradient hero / controls area ── */}
      <div className="px-8 pt-8 pb-8" style={{ background: "radial-gradient(circle at top, #0f1c3f, #070d1f 80%)" }}>

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/parrot3.png"
            alt="Compagnon logo"
            className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold leading-tight text-white">Compagnon</h1>
            <p className="text-sm text-slate-400">Your AI Voice Companion</p>
          </div>
        </div>

        {/* ── Big mic / stop button ── */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-5">
            {isActive && (
              <div className="absolute -inset-4 animate-ping rounded-full bg-red-300/30" />
            )}
            <button
              onClick={isActive ? handleStop : handleStart}
              disabled={socketState === "connecting"}
              className={`relative h-32 w-32 rounded-full font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
                isActive
                  ? "bg-gradient-to-b from-red-400 to-red-600"
                  : "bg-gradient-to-b from-blue-500 to-blue-700"
              }`}
            >
              {socketState === "connecting" ? (
                <span className="text-sm font-medium">Connecting…</span>
              ) : isActive ? (
                <div className="flex flex-col items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="h-8 w-8">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  <span className="text-sm font-medium">Stop</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  <span className="text-sm font-medium">Start</span>
                </div>
              )}
            </button>
          </div>

          {/* Status indicator / Waveform */}
          {isAgentSpeaking ? (
            <div className="flex items-center gap-1.5">
              {[0, 0.15, 0.07, 0.22, 0.11, 0.18, 0.05].map((delay, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-blue-400"
                  style={{
                    height: "28px",
                    transformOrigin: "center",
                    animation: `waveBar 0.75s ease-in-out ${delay}s infinite`,
                  }}
                />
              ))}
              <span className="ml-1 text-sm font-medium text-blue-500">Speaking…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                isActive
                  ? isMuted
                    ? "bg-red-500"
                    : isRecording
                      ? "animate-pulse bg-green-500"
                      : "bg-yellow-400"
                  : "bg-slate-300"
              }`} />
              <span className="text-sm font-medium text-slate-500">
                {socketState === "connecting"
                  ? "Connecting…"
                  : isActive
                    ? isMuted
                      ? "Muted"
                      : isRecording ? "Listening…" : "Processing…"
                    : "Tap to start a conversation"}
              </span>
            </div>
          )}

          {/* Mute toggle — only visible during an active session */}
          {isActive && (
            <button
              onClick={() => setIsMuted((m) => !m)}
              className={`mt-3 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isMuted
                  ? "border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25"
                  : "border-[#1e2d4a] bg-[#0f1c3f] text-slate-400 hover:text-white"
              }`}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? (
                <>
                  {/* mic-off icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                  Unmute
                </>
              ) : (
                <>
                  {/* mic icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Mute
                </>
              )}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Tool call status */}
        {activeToolCall && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            activeToolCall.state === "executing"
              ? "border-amber-900/50 bg-amber-950/30 text-amber-400"
              : activeToolCall.state === "completed"
                ? "border-green-900/50 bg-green-950/30 text-green-400"
                : "border-red-900/50 bg-red-950/30 text-red-400"
          }`}>
            {activeToolCall.state === "executing" && "Thinking…"}
            {activeToolCall.state === "completed" && "Got it!"}
            {activeToolCall.state === "failed" && "Something went wrong. Let me try again."}
          </div>
        )}

        {/* ── Settings cards ── */}
        <div className="space-y-3">
          {/* Assistant selector */}
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0f1c3f] p-4">
            <label htmlFor="assistant-select" className="mb-2 block text-sm font-semibold text-slate-300">
              Assistant Profile
            </label>
            <select
              id="assistant-select"
              value={selectedAssistantId}
              onChange={(e) => handleAssistantChange(e.target.value)}
              disabled={isActive}
              className="w-full rounded-lg border border-[#1e2d4a] bg-[#0b1528] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
            >
              <option value="">Loading…</option>
              {assistants.map((a) => (
                <option key={a.assistant_id} value={a.assistant_id}>
                  {a.name || a.assistant_id.slice(0, 12)}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="New assistant name…"
                value={newAssistantName}
                onChange={(e) => setNewAssistantName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAssistant()}
                disabled={isActive || creatingAssistant}
                className="flex-1 rounded-lg border border-[#1e2d4a] bg-[#0b1528] px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
              />
              <button
                onClick={handleCreateAssistant}
                disabled={isActive || creatingAssistant || !newAssistantName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingAssistant ? "Creating…" : "New"}
              </button>
            </div>
          </div>

          {/* Microphone selector */}
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0f1c3f] p-4">
            <label htmlFor="mic-select" className="mb-2 block text-sm font-semibold text-slate-300">
              Microphone
            </label>
            <select
              id="mic-select"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isActive}
              className="w-full rounded-lg border border-[#1e2d4a] bg-[#0b1528] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
            >
              <option value="">Default Microphone</option>
              {deviceList.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Google Calendar */}
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0f1c3f] p-4">
            <p className="mb-2 text-sm font-semibold text-slate-300">Google Calendar</p>
            <GoogleCalendarConnect disabled={isActive} />
          </div>
        </div>
      </div>

      {/* ── Conversation feed ── */}
      <div className="flex-1 px-8 py-6">
        {messages.length === 0 && !userPartialText && !activeToolCall && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0f1c3f]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-slate-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <p className="text-base text-slate-400">Your conversation will appear here</p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const appendPartial = isLast && msg.role === "user" && userPartialText;

            return (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm border border-[#1e2d4a] bg-[#1e293b] text-white"
                }`}>
                  <p className="text-base leading-relaxed">
                    {msg.text}
                    {appendPartial && (
                      <span className="opacity-50">{userPartialText}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Standalone partial transcript */}
          {userPartialText && (messages.length === 0 || messages[messages.length - 1].role !== "user") && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-400/60 px-5 py-3">
                <p className="text-base text-white">{userPartialText}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
