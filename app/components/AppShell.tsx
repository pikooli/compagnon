"use client";

import { ActiveSession } from "@/app/components/ActiveSession";
import { LandingScreen } from "@/app/components/LandingScreen";
import { InteractivePanel } from "@/app/components/interactive/InteractivePanel";
import { useVoiceSession } from "@/app/hooks/useVoiceSession";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AppShell() {
  const {
    isActive,
    isRecording,
    userPartialText,
    error,
    socketState,
    activeToolCall,
    latestAgentMessage,
    hasInteractiveContent,
    handleStart,
    handleStop,
    handleMute,
    selectedVoiceAgentId,
    setSelectedVoiceAgentId,
    maleAgentId,
    femaleAgentId,
  } = useVoiceSession();

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Auto-open mobile sheet when interactive content arrives
  const prevHasContentRef = useRef(false);
  useEffect(() => {
    if (hasInteractiveContent && !prevHasContentRef.current) {
      setMobileSheetOpen(true);
    }
    if (!hasInteractiveContent && prevHasContentRef.current) {
      setMobileSheetOpen(false);
    }
    prevHasContentRef.current = hasInteractiveContent;
  }, [hasInteractiveContent]);

  return (
    <div className="relative h-screen overflow-hidden bg-[#070d1f]">
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingScreen
              onStart={handleStart}
              selectedVoiceAgentId={selectedVoiceAgentId}
              onVoiceChange={setSelectedVoiceAgentId}
              maleAgentId={maleAgentId}
              femaleAgentId={femaleAgentId}
            />
          </motion.div>
        ) : (
          <motion.div
            key="active"
            className="flex h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Mic / message area — desktop */}
            <motion.div
              className="hidden h-full md:block"
              animate={{
                width: hasInteractiveContent ? "50%" : "100%",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <ActiveSession
                isRecording={isRecording}
                latestAgentMessage={latestAgentMessage}
                userPartialText={userPartialText}
                activeToolCall={activeToolCall}
                onMute={handleMute}
                onStop={handleStop}
                error={error}
              />
            </motion.div>

            {/* Mic / message area — mobile (always full width) */}
            <div className="h-full w-full md:hidden">
              <ActiveSession
                isRecording={isRecording}
                latestAgentMessage={latestAgentMessage}
                userPartialText={userPartialText}
                activeToolCall={activeToolCall}
                onMute={handleMute}
                onStop={handleStop}
                error={error}
              />
            </div>

            {/* Interactive panel — desktop slide-in */}
            <AnimatePresence>
              {hasInteractiveContent && (
                <motion.div
                  key="panel"
                  className="hidden h-full overflow-hidden border-l border-[#1e2d4a] md:block"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "50%", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="h-full overflow-y-auto">
                    <InteractivePanel />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile bottom sheet */}
            {hasInteractiveContent && (
              <>
                {/* Backdrop */}
                {mobileSheetOpen && (
                  <div
                    className="fixed inset-0 z-30 bg-black/60 md:hidden"
                    onClick={() => setMobileSheetOpen(false)}
                  />
                )}

                {/* Sheet */}
                <div
                  className={`fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-[#1e2d4a] bg-[#070d1f] transition-transform duration-300 md:hidden ${
                    mobileSheetOpen ? "translate-y-0" : "translate-y-full"
                  }`}
                  style={{ height: "72vh" }}
                >
                  <div className="flex flex-shrink-0 items-center justify-between border-b border-[#1e2d4a] px-4 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                      Display
                    </span>
                    <button
                      onClick={() => setMobileSheetOpen(false)}
                      className="text-xl leading-none text-slate-400 hover:text-white"
                      aria-label="Close display panel"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <InteractivePanel />
                  </div>
                </div>

                {/* Floating open button */}
                <button
                  onClick={() => setMobileSheetOpen((o) => !o)}
                  className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[#1e2d4a] bg-[#0f1c3f] px-4 py-2.5 text-xs font-semibold text-blue-400 shadow-lg transition-all duration-200 md:hidden ${
                    mobileSheetOpen
                      ? "scale-0 opacity-0"
                      : "scale-100 opacity-100"
                  }`}
                  aria-label="Open display panel"
                >
                  Display
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
