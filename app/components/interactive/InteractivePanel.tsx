"use client";

import { useUICommands } from "@/app/contexts/UICommandContext";
import type { DisplayCalendarData, EmailData } from "@/app/types/ui-commands";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor } from "lucide-react";
import { CalendarDisplay } from "./CalendarDisplay";
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
          {commands.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full min-h-[200px] flex-col items-center justify-center text-center"
            >
              <Monitor className="mb-3 h-12 w-12 text-slate-600" />
              <p className="text-lg text-slate-500">
                Visual content will appear here
              </p>
              <p className="mt-1 text-base text-slate-600">
                Ask about your calendar, and events will show up
              </p>
            </motion.div>
          )}

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
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
