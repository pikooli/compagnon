"use client";

import { useUICommands } from "@/app/contexts/UICommandContext";
import type { DisplayCalendarData, DisplayDynamicData, EmailData } from "@/app/types/ui-commands";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDisplay } from "./CalendarDisplay";
import { DynamicDisplay } from "./DynamicDisplay";
import { EmailDisplay } from "./EmailDisplay";

export function InteractivePanel() {
  const { commands } = useUICommands();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1e2d4a] px-6 py-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">
          Display
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="popLayout">
          {commands.map((cmd) => {
            switch (cmd.type) {
              case "display_calendar":
                return (
                  <motion.div
                    key={cmd.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                  >
                    <CalendarDisplay
                      data={cmd.data as DisplayCalendarData}
                    />
                  </motion.div>
                );
              case "display_emails":
                return (
                  <motion.div
                    key={cmd.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                  >
                    <EmailDisplay
                      data={cmd.data as { emails: EmailData[] }}
                    />
                  </motion.div>
                );
              case "display_dynamic":
                return (
                  <motion.div
                    key={cmd.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                  >
                    <DynamicDisplay
                      data={cmd.data as DisplayDynamicData}
                    />
                  </motion.div>
                );
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
