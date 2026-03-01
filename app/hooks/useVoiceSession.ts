"use client";

import { getJWT } from "@/app/actions/auth";
import {
  createNewAssistant,
  fetchAllMemories,
  getBackboardSessionInfo,
  listAssistants,
  setActiveAssistant,
} from "@/app/actions/backboard";
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
import type {
  CalendarEventData,
  DisplayCalendarCommand,
  DisplayEmailsCommand,
  EmailData,
} from "@/app/types/ui-commands";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FEMALE_AGENT_ID = process.env.NEXT_PUBLIC_FEMALE_AGENT_ID || "";
const MALE_AGENT_ID = process.env.NEXT_PUBLIC_MALE_AGENT_ID || "";

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function useVoiceSession() {
  const [isActive, setIsActive] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [assistants, setAssistants] = useState<BackboardAssistant[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [newAssistantName, setNewAssistantName] = useState<string>("");
  const [creatingAssistant, setCreatingAssistant] = useState(false);
  const [selectedVoiceAgentId, setSelectedVoiceAgentId] =
    useState<string>(FEMALE_AGENT_ID);
  const [messages, setMessages] = useState<
    { role: "user" | "agent"; text: string }[]
  >([]);
  const [userPartialText, setUserPartialText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sessionThreadId, setSessionThreadId] = useState<string | null>(null);

  const { startConversation, endConversation, sendAudio, socketState } =
    useFlow();
  const audioDevices = useAudioDevices();
  const {
    startRecording,
    stopRecording,
    isRecording,
    audioContext: recorderAudioContext,
  } = usePCMAudioRecorderContext();
  const { playAudio, audioContext: playerAudioContext } =
    usePCMAudioPlayerContext();

  const {
    setSession,
    addMirrorEntry,
    updateMirrorEntry,
    addToolCall,
    updateToolCall,
    setAllMemories,
    resetSession,
  } = useAdminDebug();

  const {
    pushCommands,
    clearCommands,
    commands: uiCommands,
    focusedEventId,
    focusedEmailId,
  } = useUICommands();

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
    [
      sessionThreadId,
      selectedAssistantId,
      displayedEvents,
      displayedEmails,
      focusedEventId,
      focusedEmailId,
      messages,
    ],
  );

  const { activeToolCall, handleToolInvoke } = useFlowToolCalling(
    toolCallbacks,
    sessionContext,
  );

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
    useCallback(
      (ev: FlowIncomingMessageEvent) => {
        const msg = ev.data;

        switch (msg.message) {
          case "ResponseStarted":
            setUserPartialText("");
            break;
          case "ResponseCompleted":
            setMessages((prev) => [
              ...prev,
              { role: "agent", text: msg.content },
            ]);
            break;
          case "AddTranscript":
            // Skip punctuation-only transcripts (e.g. a lone ".")
            if (
              msg.metadata.transcript.trim() &&
              /\w/.test(msg.metadata.transcript)
            ) {
              setMessages((prev) => {
                if (
                  prev.length > 0 &&
                  prev[prev.length - 1].role === "user"
                ) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    text:
                      updated[updated.length - 1].text +
                      msg.metadata.transcript,
                  };
                  return updated;
                }
                return [
                  ...prev,
                  { role: "user", text: msg.metadata.transcript },
                ];
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
      },
      [handleToolInvoke],
    ),
  );

  // Fetch available assistants on mount
  useEffect(() => {
    listAssistants().then((list) => {
      setAssistants(list);
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

      if (selectedAssistantId) {
        await setActiveAssistant(selectedAssistantId);
      }

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

  // Derived values for presentation layer
  const latestAgentMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "agent") return messages[i].text;
    }
    return null;
  }, [messages]);

  const hasInteractiveContent = uiCommands.length > 0;

  return {
    // State
    isActive,
    isRecording,
    messages,
    userPartialText,
    error,
    socketState,
    activeToolCall,
    selectedAssistantId,
    assistants,
    newAssistantName,
    creatingAssistant,

    // Derived
    latestAgentMessage,
    hasInteractiveContent,

    // Voice
    selectedVoiceAgentId,
    setSelectedVoiceAgentId,
    maleAgentId: MALE_AGENT_ID,
    femaleAgentId: FEMALE_AGENT_ID,

    // Handlers
    handleStart,
    handleStop,
    handleMute,
    handleCreateAssistant,
    handleAssistantChange,
    setSelectedAssistantId,
    setNewAssistantName,
  };
}
