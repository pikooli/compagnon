"use client";

import { useState, useEffect } from "react";
import { useAdminDebug } from "@/app/contexts/AdminDebugContext";
import { fetchAllMemories } from "@/app/actions/backboard";

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function SessionTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono">{formatDuration(now - startedAt)}</span>;
}

export function SessionInfo() {
  const {
    session,
    allMemories,
    setAllMemories,
    recallResults,
    mirrorLog,
  } = useAdminDebug();

  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

  // Check calendar connection status on mount
  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then((res) => res.json())
      .then((data) => setCalendarConnected(data.connected))
      .catch(() => setCalendarConnected(false));
  }, []);

  // Fetch memories on session start
  useEffect(() => {
    if (session.threadId) {
      setMemoriesLoading(true);
      fetchAllMemories()
        .then(setAllMemories)
        .finally(() => setMemoriesLoading(false));
    }
  }, [session.threadId, setAllMemories]);

  // Re-fetch memories after each successful mirror (with delay)
  useEffect(() => {
    const sentCount = mirrorLog.filter((e) => e.status === "sent").length;
    if (sentCount === 0) return;

    const timer = setTimeout(() => {
      fetchAllMemories().then(setAllMemories);
    }, 1500);
    return () => clearTimeout(timer);
  }, [mirrorLog, setAllMemories]);

  const handleRefresh = async () => {
    setMemoriesLoading(true);
    try {
      const memories = await fetchAllMemories();
      setAllMemories(memories);
    } finally {
      setMemoriesLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* IDs + Duration */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Session
        </h3>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-foreground/50">Thread</span>
          <span className="font-mono truncate">
            {session.threadId ?? "—"}
          </span>
          <span className="text-foreground/50">Assistant</span>
          <span className="font-mono truncate">
            {session.assistantId ?? "—"}
          </span>
          <span className="text-foreground/50">Duration</span>
          <span>
            {session.startedAt ? (
              <SessionTimer startedAt={session.startedAt} />
            ) : (
              "—"
            )}
          </span>
          <span className="text-foreground/50">Calendar</span>
          <span>
            {calendarConnected === null
              ? "..."
              : calendarConnected
                ? <span className="text-green-500">Connected</span>
                : "Not connected"}
          </span>
        </div>
      </div>

      {/* All Stored Memories */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Stored Memories ({allMemories.length})
          </h3>
          <button
            onClick={handleRefresh}
            disabled={memoriesLoading}
            className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            {memoriesLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {allMemories.length === 0 ? (
          <p className="mt-1 text-xs text-foreground/30 italic">
            No memories yet
          </p>
        ) : (
          <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
            {allMemories.map((m) => (
              <div
                key={m.id}
                className="rounded bg-foreground/5 px-2 py-1 text-xs"
              >
                <span>{m.content}</span>
                {m.created_at && (
                  <span className="ml-2 text-foreground/30">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recall Results */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Recall Results ({recallResults.length})
        </h3>
        {recallResults.length === 0 ? (
          <p className="mt-1 text-xs text-foreground/30 italic">
            No recalls yet
          </p>
        ) : (
          <div className="mt-1 max-h-48 space-y-2 overflow-y-auto">
            {recallResults.map((r) => (
              <div
                key={r.id}
                className="rounded border border-foreground/10 bg-foreground/5 p-2"
              >
                <div className="text-xs font-medium text-purple-400">
                  &quot;{r.query}&quot;
                </div>
                <div className="text-[10px] text-foreground/30">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </div>
                {r.memories.length === 0 ? (
                  <p className="mt-1 text-xs text-foreground/30 italic">
                    No matches
                  </p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {r.memories.map((m, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="shrink-0 rounded bg-purple-500/20 px-1 text-[10px] text-purple-300">
                          {m.score.toFixed(2)}
                        </span>
                        <span className="text-foreground/70">{m.memory}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
