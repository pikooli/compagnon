"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

type IntroPhase = "fadein" | "hold" | "ready";

interface LandingScreenProps {
  onStart: () => Promise<void>;
  selectedVoiceAgentId: string;
  onVoiceChange: (id: string) => void;
  maleAgentId: string;
  femaleAgentId: string;
}

export function LandingScreen({
  onStart,
  selectedVoiceAgentId,
  onVoiceChange,
  maleAgentId,
  femaleAgentId,
}: LandingScreenProps) {
  const [introPhase, setIntroPhase] = useState<IntroPhase>("fadein");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const holdTimer = setTimeout(() => setIntroPhase("hold"), 1000);
    const readyTimer = setTimeout(() => setIntroPhase("ready"), 3000);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@500&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const voiceOptions = [
    { id: femaleAgentId, label: "Female voice" },
    { id: maleAgentId, label: "Male voice" },
  ];

  const selectedLabel =
    voiceOptions.find((v) => v.id === selectedVoiceAgentId)?.label ??
    "Female voice";

  return (
    <motion.div
      className="flex h-screen w-full flex-col items-center justify-center bg-[#070d1f]"
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h1
        className="text-5xl tracking-[0.25em] uppercase"
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 500,
          color: "#FFFFF0",
        }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          y: introPhase === "ready" ? -120 : 0,
        }}
        transition={{
          opacity: { duration: 1 },
          y: { duration: 0.6, ease: "easeOut" },
        }}
      >
        Compagnon
      </motion.h1>

      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: introPhase === "ready" ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        style={{ pointerEvents: introPhase === "ready" ? "auto" : "none" }}
      >
        <div className="relative flex items-center justify-center">
          {/* Pulse ring on click */}
          {pulseKey > 0 && (
            <motion.div
              key={pulseKey}
              className="pointer-events-none absolute h-40 w-40 rounded-full border-2 border-blue-400/60"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}

        <motion.button
          onClick={() => {
            setPulseKey((k) => k + 1);
            onStart();
          }}
          className="relative flex h-40 w-40 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-semibold text-white shadow-lg"
          animate={{
            scale: [1, 1.03, 1],
            boxShadow: [
              "0 0 30px 0 rgba(59, 130, 246, 0.3)",
              "0 0 60px 10px rgba(59, 130, 246, 0.5)",
              "0 0 30px 0 rgba(59, 130, 246, 0.3)",
            ],
          }}
          transition={{
            repeat: Infinity,
            repeatType: "reverse",
            duration: 2,
            ease: "easeInOut",
          }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.97 }}
        >
          Start
        </motion.button>
        </div>

        {/* Voice selector */}
        <div className="relative mt-20">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-base text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            {selectedLabel}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-1/2 mt-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
              {voiceOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onVoiceChange(option.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center px-4 py-3 text-left text-base transition-colors hover:bg-slate-700 ${
                    option.id === selectedVoiceAgentId
                      ? "text-blue-400"
                      : "text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
