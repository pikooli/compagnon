"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { useFlowToolCalling } from "@/app/hooks/useFlowToolCalling";
import { useConversationMirror } from "@/app/hooks/useConversationMirror";
import type { ToolInvokeMessage } from "@/app/lib/flow-tools";

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
  const [messages, setMessages] = useState<
    { role: "user" | "agent"; text: string }[]
  >([]);
  const [userPartialText, setUserPartialText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const { startConversation, endConversation, sendAudio, socketState } =
    useFlow();
  const audioDevices = useAudioDevices();
  const { startRecording, stopRecording, isRecording, audioContext: recorderAudioContext } =
    usePCMAudioRecorderContext();
  const { playAudio, audioContext: playerAudioContext } = usePCMAudioPlayerContext();
  const { activeToolCall, handleToolInvoke } = useFlowToolCalling();

  // Mirror conversation turns to Backboard for memory extraction
  useConversationMirror(messages, isActive);

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

      // Debug: log every message type
      setDebugLog((prev) => [
        ...prev.slice(-19),
        `${msg.message}: ${JSON.stringify(msg).slice(0, 120)}`,
      ]);

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
        case "ToolInvoke":
          handleToolInvoke(msg as unknown as ToolInvokeMessage);
          break;
      }
    }, [handleToolInvoke]),
  );

  // Request mic permissions on mount
  useEffect(() => {
    if (audioDevices.permissionState === "prompt") {
      audioDevices.promptPermissions();
    }
  }, [audioDevices]);

  const handleStart = async () => {
    try {
      setError("");
      setMessages([]);
      setUserPartialText("");

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
    <div className="mx-auto max-w-[700px] p-8 text-foreground">
      <h1 className="mb-6 text-3xl font-bold">Voice Agent</h1>

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

      {/* Start / Stop */}
      <button
        onClick={isActive ? handleStop : handleStart}
        disabled={socketState === "connecting"}
        className={`mb-6 cursor-pointer rounded-lg px-8 py-3 text-xl text-white ${
          isActive ? "bg-red-600" : "bg-green-600"
        }`}
      >
        {isActive ? "Stop" : "Start Conversation"}
      </button>

      {/* Status */}
      <p className="mb-4 text-sm text-foreground/50">
        Socket: {socketState ?? "idle"} | Recording:{" "}
        {isRecording ? "yes" : "no"}
      </p>

      {/* Tool call status */}
      {activeToolCall && (
        <div
          className={`mb-4 rounded-lg p-4 text-lg ${
            activeToolCall.state === "executing"
              ? "animate-pulse bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
              : activeToolCall.state === "completed"
                ? "bg-green-500/20 text-green-700 dark:text-green-300"
                : "bg-red-500/20 text-red-700 dark:text-red-300"
          }`}
        >
          {activeToolCall.state === "executing" && (
            <span>Checking my memory...</span>
          )}
          {activeToolCall.state === "completed" && (
            <span>Got it!</span>
          )}
          {activeToolCall.state === "failed" && (
            <span>Could not access memories right now.</span>
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
            className={`mb-3 rounded-lg p-4 ${
              msg.role === "user" ? "bg-foreground/10" : "bg-blue-500/10"
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
      {/* Debug log */}
      {debugLog.length > 0 && (
        <div className="mt-8 rounded-lg bg-foreground/5 p-4">
          <strong className="text-sm">Debug (messages received):</strong>
          <pre className="mt-2 max-h-60 overflow-auto text-xs text-foreground/60">
            {debugLog.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
