"use client";

import type { CalendarEventData } from "@/app/types/ui-commands";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  CircleDashed,
  Clock,
  FileText,
  HelpCircle,
  MapPin,
  Users,
  XCircle,
} from "lucide-react";

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatFullTimeRange(
  start: string,
  end: string,
  allDay: boolean,
): string {
  if (allDay) return "All Day";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function ResponseStatusIcon({
  status,
}: {
  status?: string;
}) {
  switch (status) {
    case "accepted":
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    case "declined":
      return <XCircle className="h-5 w-5 text-red-400" />;
    case "tentative":
      return <HelpCircle className="h-5 w-5 text-yellow-400" />;
    default:
      return <CircleDashed className="h-5 w-5 text-slate-500" />;
  }
}

function responseStatusLabel(status?: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "tentative":
      return "Maybe";
    default:
      return "No response";
  }
}

interface MeetingDetailViewProps {
  event: CalendarEventData;
  onBack: () => void;
}

export function MeetingDetailView({ event, onBack }: MeetingDetailViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 rounded-2xl border border-[#1e2d4a] bg-[#0f1c3f]/80 p-8"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-medium text-blue-400 transition-colors hover:bg-blue-400/10"
      >
        <ArrowLeft className="h-6 w-6" />
        Back to schedule
      </button>

      {/* Title */}
      <h2 className="text-3xl font-bold text-white">{event.summary}</h2>

      {/* Date */}
      <div className="flex items-center gap-3 text-slate-200">
        <Calendar className="h-6 w-6 text-blue-400" />
        <span className="text-xl">{formatFullDate(event.start)}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-3 text-slate-200">
        <Clock className="h-6 w-6 text-blue-400" />
        <span className="text-xl">
          {formatFullTimeRange(event.start, event.end, event.allDay)}
        </span>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-3 text-slate-200">
          <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-blue-400" />
          <span className="text-xl">{event.location}</span>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="flex items-start gap-3 text-slate-300">
          <FileText className="mt-0.5 h-6 w-6 shrink-0 text-blue-400" />
          <p className="whitespace-pre-wrap text-lg leading-relaxed">
            {event.description}
          </p>
        </div>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-slate-200">
            <Users className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-semibold">
              Attendees ({event.attendees.length})
            </span>
          </div>
          <div className="ml-9 space-y-2">
            {event.attendees.map((attendee) => (
              <div
                key={attendee.email}
                className="flex items-center gap-3 text-lg"
              >
                <ResponseStatusIcon status={attendee.responseStatus} />
                <span className="text-slate-200">
                  {attendee.displayName || attendee.email.split("@")[0]}
                </span>
                <span className="text-base text-slate-500">
                  {responseStatusLabel(attendee.responseStatus)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
