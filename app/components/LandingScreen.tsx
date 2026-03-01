"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type IntroPhase = "fadein" | "hold" | "ready";

interface LandingScreenProps {
  onStart: () => Promise<void>;
  isConnecting: boolean;
}

export function LandingScreen({ onStart, isConnecting }: LandingScreenProps) {
  const [introPhase, setIntroPhase] = useState<IntroPhase>("fadein");

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

  return (
    <motion.div
      className="flex h-screen w-full flex-col items-center justify-center bg-[#070d1f]"
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h1
        className="text-5xl tracking-[0.25em] uppercase"
        style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, color: "#FFFFF0" }}
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
        <motion.button
          onClick={onStart}
          disabled={isConnecting}
          className="relative flex h-40 w-40 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
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
          {isConnecting ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : (
            "Start"
          )}
        </motion.button>

        {isConnecting && (
          <p className="mt-6 text-base text-blue-300/60">Connecting...</p>
        )}
      </motion.div>
    </motion.div>
  );
}
