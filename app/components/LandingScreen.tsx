"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LandingScreenProps {
  onStart: () => Promise<void>;
  isConnecting: boolean;
}

export function LandingScreen({ onStart, isConnecting }: LandingScreenProps) {
  return (
    <motion.div
      className="flex h-screen w-full flex-col items-center justify-center bg-[#070d1f]"
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="mb-8 text-lg tracking-widest text-blue-400/60 uppercase">
        Voice Assistant
      </p>

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
  );
}
