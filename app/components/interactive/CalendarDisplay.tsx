"use client";

import { useUICommands } from "@/app/contexts/UICommandContext";
import type { DisplayCalendarData } from "@/app/types/ui-commands";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { MeetingDetailView } from "./MeetingDetailView";

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return "All Day";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(start: string, end: string, allDay: boolean): string {
  if (allDay) return "All Day";
  return `${formatTime(start, false)} – ${formatTime(end, false)}`;
}

function formatAttendees(
  attendees?: { email: string; displayName?: string }[],
): string | null {
  if (!attendees || attendees.length === 0) return null;
  const names = attendees
    .slice(0, 2)
    .map((a) => a.displayName || a.email.split("@")[0]);
  const remaining = attendees.length - 2;
  if (remaining > 0) {
    return `with ${names.join(", ")} +${remaining} other${remaining > 1 ? "s" : ""}`;
  }
  return `with ${names.join(" & ")}`;
}

function timeRangeLabel(timeRange: string): string {
  switch (timeRange) {
    case "today":
      return "Today's Schedule";
    case "tomorrow":
      return "Tomorrow's Schedule";
    case "this_week":
      return "This Week's Schedule";
    default:
      return "Upcoming Events";
  }
}

const glowTransition = {
  duration: 0.4,
  ease: "easeOut" as const,
};

const timeTransition = {
  duration: 0.3,
  ease: "easeInOut" as const,
};

export function CalendarDisplay({ data }: { data: DisplayCalendarData }) {
  const { events, timeRange } = data;
  const {
    recentlyUpdatedEventIds,
    recentlyAddedEventIds,
    recentlyRemovedEventIds,
    focusedEventId,
    setFocusedEventId,
  } = useUICommands();

  const focusedEvent = focusedEventId
    ? events.find((e) => e.id === focusedEventId)
    : null;

  if (focusedEvent) {
    return (
      <MeetingDetailView
        event={focusedEvent}
        onBack={() => setFocusedEventId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Calendar className="h-7 w-7 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">
            {timeRangeLabel(timeRange)}
          </h2>
        </motion.div>

        {/* Empty state */}
        {events.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-[#1e2d4a] bg-[#0f1c3f]/50 p-8 text-center"
          >
            <Calendar className="mx-auto mb-3 h-12 w-12 text-slate-500" />
            <p className="text-xl text-slate-400">No events scheduled</p>
            <p className="mt-1 text-base text-slate-500">
              Your {timeRange === "today" ? "day" : "schedule"} is free!
            </p>
          </motion.div>
        )}

        {/* Event cards */}
        <AnimatePresence>
          {events.map((event, i) => {
            const isUpdated = recentlyUpdatedEventIds.has(event.id);
            const isAdded = recentlyAddedEventIds.has(event.id);
            const isRemoving = recentlyRemovedEventIds.has(event.id);
            const timeKey = `${event.start}-${event.end}`;

            // Determine glow color: green for added, blue for updated, none otherwise
            const glowActive = isAdded || isUpdated;
            const glowColor = isAdded ? "#22c55e" : "#3b82f6";
            const glowShadow = isAdded
              ? "0 0 20px 4px rgba(34, 197, 94, 0.35)"
              : "0 0 20px 4px rgba(59, 130, 246, 0.35)";

            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: isRemoving ? 0.5 : 1,
                  y: 0,
                  x: 0,
                  borderColor: glowActive ? glowColor : "#1e2d4a",
                  boxShadow: glowActive
                    ? glowShadow
                    : "0 0 0px 0px rgba(59, 130, 246, 0)",
                }}
                exit={{
                  opacity: 0,
                  x: -40,
                  height: 0,
                  marginBottom: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                  overflow: "hidden",
                }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  delay: i * 0.1,
                  duration: 0.3,
                  borderColor: glowTransition,
                  boxShadow: glowTransition,
                  exit: { duration: 0.35, ease: "easeIn" },
                }}
                className={`mb-4 rounded-2xl border bg-[#0f1c3f]/80 p-5 ${
                  events.length === 1 ? "p-6" : ""
                }`}
              >
                {/* Event title */}
                <h3
                  className={`font-semibold text-white ${
                    events.length === 1 ? "text-2xl" : "text-xl"
                  }`}
                >
                  {event.summary}
                </h3>

                {/* Time — animated fade on change */}
                <div className="mt-2 flex items-center gap-2 text-blue-300">
                  <Clock className="h-5 w-5" />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={timeKey}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={timeTransition}
                      className="text-lg"
                    >
                      {formatTimeRange(event.start, event.end, event.allDay)}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Location */}
                {event.location && (
                  <div className="mt-1.5 flex items-center gap-2 text-slate-300">
                    <MapPin className="h-5 w-5" />
                    <span className="text-lg">{event.location}</span>
                  </div>
                )}

                {/* Attendees */}
                {formatAttendees(event.attendees) && (
                  <div className="mt-1.5 flex items-center gap-2 text-slate-400">
                    <Users className="h-5 w-5" />
                    <span className="text-base">
                      {formatAttendees(event.attendees)}
                    </span>
                  </div>
                )}

                {/* Description (truncated) */}
                {event.description && (
                  <p className="mt-2 text-base leading-relaxed text-slate-400 line-clamp-2">
                    {event.description}
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
  );
}
