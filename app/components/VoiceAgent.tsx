"use client";

import { getJWT } from "@/app/actions/auth";
import {
  createNewAssistant,
  fetchAllMemories,
  getBackboardSessionInfo,
  listAssistants,
  setActiveAssistant,
} from "@/app/actions/backboard";
import { GoogleCalendarConnect } from "@/app/components/GoogleCalendarConnect";
import { useAdminDebug } from "@/app/contexts/AdminDebugContext";
import { useUICommands } from "@/app/contexts/UICommandContext";
import {
  useConversationMirror,
  type MirrorCallbacks,
} from "@/app/hooks/useConversationMirror";
import {
  useFlowToolCalling,
  type ToolCallingCallbacks,
  type ToolCallingContext,
} from "@/app/hooks/useFlowToolCalling";
import type { BackboardAssistant } from "@/app/lib/backboard";
import type { ToolInvokeMessage } from "@/app/lib/flow-tools";
import type { CalendarEventData, DisplayCalendarCommand, DisplayEmailsCommand, EmailData } from "@/app/types/ui-commands";
import {
  useAudioDevices,
  usePCMAudioListener,
  usePCMAudioRecorderContext,
} from "@speechmatics/browser-audio-input-react";
import {
  useFlow,
  useFlowEventListener,
  type AgentAudioEvent,
  type FlowIncomingMessageEvent,
} from "@speechmatics/flow-client-react";
import { usePCMAudioPlayerContext } from "@speechmatics/web-pcm-player-react";
import { Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


const MALE_AGENT_ID = process.env.NEXT_PUBLIC_MALE_AGENT_ID || '';
const FEMALE_AGENT_ID = process.env.NEXT_PUBLIC_FEMALE_AGENT_ID || '';
const ICON_SIZE = 38;

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
  const [selectedVoiceAgentId, setSelectedVoiceAgentId] = useState<string>(FEMALE_AGENT_ID);
  const [messages, setMessages] = useState<
    { role: "user" | "agent"; text: string }[]
  >([]);
  const [userPartialText, setUserPartialText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sessionThreadId, setSessionThreadId] = useState<string | null>(null);

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

  const { pushCommands, clearCommands, commands: uiCommands, focusedEventId, focusedEmailId } = useUICommands();

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

  // Tool calling callbacks for admin panel + UI commands
  const toolCallbacks: ToolCallingCallbacks = useMemo(
    () => ({
      onToolCallStart: (entry) => {
        addToolCall(entry);
      },
      onToolCallEnd: (id, update) => {
        updateToolCall(id, update);
      },
      onUICommands: pushCommands,
    }),
    [addToolCall, updateToolCall, pushCommands],
  );

  // Extract displayed events from the last display_calendar command
  const displayedEvents: CalendarEventData[] | undefined = useMemo(() => {
    for (let i = uiCommands.length - 1; i >= 0; i--) {
      if (uiCommands[i].type === "display_calendar") {
        return (uiCommands[i] as DisplayCalendarCommand).data.events;
      }
    }
    return undefined;
  }, [uiCommands]);

  // Extract displayed emails from the last display_emails command
  const displayedEmails: EmailData[] | undefined = useMemo(() => {
    for (let i = uiCommands.length - 1; i >= 0; i--) {
      if (uiCommands[i].type === "display_emails") {
        return (uiCommands[i] as DisplayEmailsCommand).data.emails;
      }
    }
    return undefined;
  }, [uiCommands]);

  // Session context for brain API calls
  const sessionContext: ToolCallingContext = useMemo(
    () => ({
      threadId: sessionThreadId,
      assistantId: selectedAssistantId || undefined,
      displayedEvents,
      displayedEmails,
      focusedEventId,
      focusedEmailId,
      conversationHistory: messages,
    }),
    [sessionThreadId, selectedAssistantId, displayedEvents, displayedEmails, focusedEventId, focusedEmailId, messages],
  );

  const { activeToolCall, handleToolInvoke } =
    useFlowToolCalling(toolCallbacks, sessionContext);

  // Mirror conversation turns to Backboard for memory extraction
  useConversationMirror(messages, isActive, mirrorCallbacks);

  // Use ref so the audio listener always sees latest value without re-registering
  const isActiveRef = useRef(false);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Send mic audio to Flow
  usePCMAudioListener(
    useCallback(
      (audio: Float32Array) => {
        if (isActiveRef.current) {
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

      switch (msg.message) {
        case "ResponseStarted":
          setUserPartialText("");
          break;
        case "ResponseCompleted":
          setMessages((prev) => [...prev, { role: "agent", text: msg.content }]);
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
          break;
        case "Error":
          setError(JSON.stringify(msg));
          setIsActive(false);
          break;
          // @ts-expect-error - FlowIncomingMessageEvent is not typed correctly
        case "ToolInvoke":
          handleToolInvoke(msg as unknown as ToolInvokeMessage);
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

  const handleMute = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording({
        deviceId: selectedDeviceId || undefined,
      });
    }
  }, [isRecording, selectedDeviceId, startRecording, stopRecording]);

  const handleStart = async () => {
    try {
      setError("");
      setMessages([]);
      setUserPartialText("");
      setSessionThreadId(null);
      resetSession();
      clearCommands();

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
          template_id: selectedVoiceAgentId,
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
  };

  const deviceList =
    audioDevices.permissionState === "granted" ? audioDevices.deviceList : [];

  return (
    <div className="p-8 text-foreground">
      <h1 className="mb-6 text-3xl font-bold">Voice Agent</h1>

      {/* Assistant selector */}
      <div className="mb-4">
        <label htmlFor="assistant-select" className="mb-2 block text-lg">
          Assistant:
        </label>
        <select
          id="assistant-select"
          value={selectedAssistantId}
          onChange={(e) => handleAssistantChange(e.target.value)}
          disabled={isActive}
          className="w-full rounded border border-foreground/20 bg-background p-2 text-base text-foreground"
        >
          <option value="">Loading...</option>
          {assistants.map((a) => (
            <option key={a.assistant_id} value={a.assistant_id}>
              {a.name || a.assistant_id.slice(0, 12)}
            </option>
          ))}
        </select>
        <select
          id="voice-agent-select"
          value={selectedVoiceAgentId}
          onChange={(e) => setSelectedVoiceAgentId(e.target.value)}
          disabled={isActive}
          className="w-full rounded border border-foreground/20 bg-background p-2 text-base text-foreground"
        >
          <option value="">Select Voice Agent</option>
          <option value={MALE_AGENT_ID}>Male</option  >
          <option value={FEMALE_AGENT_ID}>Female</option>
        </select>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="New assistant name..."
            value={newAssistantName}
            onChange={(e) => setNewAssistantName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateAssistant()}
            disabled={isActive || creatingAssistant}
            className="flex-1 rounded border border-foreground/20 bg-background px-2 py-1 text-sm text-foreground placeholder:text-foreground/30"
          />
          <button
            onClick={handleCreateAssistant}
            disabled={isActive || creatingAssistant || !newAssistantName.trim()}
            className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
          >
            {creatingAssistant ? "Creating..." : "New"}
          </button>
        </div>
      </div>

      {/* Google Calendar connection */}
      <div className="mb-4">
        <GoogleCalendarConnect disabled={isActive} />
      </div>

      {/* Mic selector */}
      <div className="mb-4">
        <label htmlFor="mic-select" className="mb-2 block text-lg">
          Microphone:
        </label>
        <select
          id="mic-select"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={isActive}
          className="w-full rounded border border-foreground/20 bg-background p-2 text-base text-foreground"
        >
          <option value="">Default</option>
          {deviceList.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-center flex-col gap-2 md:flex-row mb-2">
        <button
          onClick={isActive ? handleStop : handleStart}
          disabled={socketState === "connecting"}
          className={`mb-6 cursor-pointer rounded-lg px-8 py-3 text-xl text-white ${isActive ? "bg-red-600" : "bg-green-600"
            }`}
        >
          {isActive ? "Stop" : "Start Conversation"}
        </button>
        <button
          onClick={handleMute}
          disabled={!isActive}
          className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
        >
          {isRecording ? <Mic size={ICON_SIZE}/> : <MicOff size={ICON_SIZE}/>}
        </button>
      </div>

      <p className="mb-4 text-sm text-foreground/50">
        Socket: {socketState ?? "idle"} | Recording:{" "}
        {isRecording ? "yes" : "no"}
      </p>

      {activeToolCall && (
        <div
          className={`mb-4 rounded-lg p-4 text-lg ${activeToolCall.state === "executing"
              ? "animate-pulse bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
              : activeToolCall.state === "completed"
                ? "bg-green-500/20 text-green-700 dark:text-green-300"
                : "bg-red-500/20 text-red-700 dark:text-red-300"
            }`}
        >
          {activeToolCall.state === "executing" && (
            <span>Thinking...</span>
          )}
          {activeToolCall.state === "completed" && (
            <span>Got it!</span>
          )}
          {activeToolCall.state === "failed" && (
            <span>Something went wrong. Let me try again.</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mb-4 text-base text-red-500">Error: {error}</p>
      )}

      {/* Conversation */}
      {messages.map((msg, i) => {
        const isLast = i === messages.length - 1;
        const appendPartial = isLast && msg.role === "user" && userPartialText;

        return (
          <div
            key={i}
            className={`mb-3 rounded-lg p-4 ${msg.role === "user" ? "bg-foreground/10" : "bg-blue-500/10"
              }`}
          >
            <strong className="text-base">
              {msg.role === "user" ? "You:" : "Agent:"}
            </strong>
            <p className="mt-2 text-lg">
              {msg.text}
              {appendPartial && (
                <span className="text-foreground/50">{userPartialText}</span>
              )}
            </p>
          </div>
        );
      })}

      {/* Live partial transcript — standalone only when no user message to attach to */}
      {userPartialText && (messages.length === 0 || messages[messages.length - 1].role !== "user") && (
        <div className="mb-3 rounded-lg bg-foreground/10 p-4">
          <strong className="text-base">You:</strong>
          <p className="mt-2 text-lg text-foreground/50">{userPartialText}</p>
        </div>
      )}
    </div>
  );
}
