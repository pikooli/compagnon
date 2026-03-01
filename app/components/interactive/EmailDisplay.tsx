"use client";

import { useUICommands } from "@/app/contexts/UICommandContext";
import type { EmailData } from "@/app/types/ui-commands";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock, Mail, User } from "lucide-react";

function parseSenderName(from: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  const match = from.match(/^(.+?)\s*<.*>$/);
  return match ? match[1].trim() : from;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmailDetailView({
  email,
  onBack,
}: {
  email: EmailData;
  onBack: () => void;
}) {
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
        Back to emails
      </button>

      {/* Subject */}
      <h2 className="text-3xl font-bold text-white">{email.subject}</h2>

      {/* From */}
      <div className="flex items-center gap-3 text-slate-200">
        <User className="h-6 w-6 text-blue-400" />
        <span className="text-xl">{email.from}</span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-3 text-slate-200">
        <Clock className="h-6 w-6 text-blue-400" />
        <span className="text-xl">{formatFullDate(email.date)}</span>
      </div>

      {/* Body */}
      <div className="rounded-xl border border-[#1e2d4a] bg-[#0a1228]/60 p-6">
        <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-300">
          {email.body || email.snippet}
        </p>
      </div>
    </motion.div>
  );
}

export function EmailDisplay({ data }: { data: { emails: EmailData[] } }) {
  const { emails } = data;
  const {
    focusedEmailId,
    setFocusedEmailId,
    recentlyRemovedEmailIds,
  } = useUICommands();

  const focusedEmail = focusedEmailId
    ? emails.find((e) => e.id === focusedEmailId)
    : null;

  if (focusedEmail) {
    return (
      <EmailDetailView
        email={focusedEmail}
        onBack={() => setFocusedEmailId(null)}
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
        <Mail className="h-7 w-7 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Emails</h2>
      </motion.div>

      {/* Empty state */}
      {emails.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-[#1e2d4a] bg-[#0f1c3f]/50 p-8 text-center"
        >
          <Mail className="mx-auto mb-3 h-12 w-12 text-slate-500" />
          <p className="text-xl text-slate-400">No emails found</p>
          <p className="mt-1 text-base text-slate-500">
            Your inbox is clear!
          </p>
        </motion.div>
      )}

      {/* Email cards */}
      <AnimatePresence>
        {emails.map((email, i) => {
          const isRemoving = recentlyRemovedEmailIds.has(email.id);

          return (
            <motion.div
              key={email.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: isRemoving ? 0.5 : 1,
                y: 0,
                x: 0,
                borderColor: "#1e2d4a",
                boxShadow: "0 0 0px 0px rgba(59, 130, 246, 0)",
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
                exit: { duration: 0.35, ease: "easeIn" },
              }}
              className="mb-4 rounded-2xl border border-[#1e2d4a] bg-[#0f1c3f]/80 p-5"
            >
              {/* Sender + date row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {email.isUnread && (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  )}
                  <span className="text-lg font-semibold text-white">
                    {parseSenderName(email.from)}
                  </span>
                </div>
                <span className="text-base text-slate-400">
                  {formatRelativeDate(email.date)}
                </span>
              </div>

              {/* Subject */}
              <h3 className="mt-1.5 text-xl font-semibold text-slate-200">
                {email.subject}
              </h3>

              {/* Snippet */}
              <p className="mt-1 text-base leading-relaxed text-slate-400 line-clamp-2">
                {email.snippet}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
