"use client";

import type { ToolCallStatus } from "@/app/hooks/useFlowToolCalling";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";

interface ActiveSessionProps {
  isRecording: boolean;
  latestAgentMessage: string | null;
  userPartialText: string;
  activeToolCall: ToolCallStatus | null;
  onMute: () => void;
  onStop: () => void;
  error: string;
}

function PulseRings() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-blue-400/30"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{
            repeat: Infinity,
            duration: 2.4,
            delay: i * 0.8,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export function ActiveSession({
  isRecording,
  latestAgentMessage,
  userPartialText,
  activeToolCall,
  onMute,
  onStop,
  error,
}: ActiveSessionProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#070d1f] px-6">
      {/* Mic icon with pulse */}
      <div className="relative mb-10 flex h-20 w-20 items-center justify-center">
        {isRecording && <PulseRings />}
        <button
          onClick={onMute}
          className={`relative z-10 flex h-20 w-20 cursor-pointer items-center justify-center rounded-full transition-colors ${
            isRecording
              ? "bg-blue-500/20 text-blue-400"
              : "bg-slate-700/30 text-slate-500"
          }`}
          aria-label={isRecording ? "Mute microphone" : "Unmute microphone"}
        >
          {isRecording ? <Mic size={40} /> : <MicOff size={40} />}
        </button>
      </div>

      {/* Thinking indicator */}
      {activeToolCall?.state === "executing" && (
        <motion.p
          className="mb-4 text-base text-blue-300/60"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          Thinking...
        </motion.p>
      )}

      {/* Latest agent message */}
      <div className="min-h-[3rem] max-w-xl text-center">
        <AnimatePresence mode="wait">
          {latestAgentMessage && (
            <motion.p
              key={latestAgentMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-xl leading-relaxed text-slate-200"
            >
              {latestAgentMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Partial transcript */}
      {userPartialText && (
        <p className="mt-4 max-w-xl text-center text-base text-slate-500">
          {userPartialText}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 max-w-xl text-center text-base text-red-400">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="mt-12 flex items-center gap-4">
        <button
          onClick={onMute}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm transition-colors ${
            isRecording
              ? "bg-slate-700/40 text-slate-400 hover:bg-slate-700/60"
              : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          }`}
          aria-label={isRecording ? "Mute" : "Unmute"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={onStop}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
          aria-label="Stop conversation"
        >
          <Square size={16} />
        </button>
      </div>
    </div>
  );
}
