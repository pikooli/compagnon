"use client";

import { useRef, useEffect } from "react";
import { useAdminDebug } from "@/app/contexts/AdminDebugContext";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    sent: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
    executing: "bg-yellow-500/20 text-yellow-300",
    completed: "bg-green-500/20 text-green-300",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[status] ?? "bg-foreground/10 text-slate-400"}`}
    >
      {status}
    </span>
  );
}

function MirrorLog() {
  const { mirrorLog } = useAdminDebug();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [mirrorLog]);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Mirror Log ({mirrorLog.length})
      </h3>
      {mirrorLog.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500 italic">
          No turns mirrored yet
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="mt-1 max-h-48 space-y-1 overflow-y-auto"
        >
          {mirrorLog.map((entry) => (
            <div
              key={entry.id}
              className="rounded border-l-2 bg-[#0f1c3f] p-2"
              style={{
                borderColor:
                  entry.status === "sent"
                    ? "rgb(34 197 94)"
                    : entry.status === "failed"
                      ? "rgb(239 68 68)"
                      : "rgb(234 179 8)",
              }}
            >
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} />
                <span className="text-[10px] text-slate-500">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-1 text-xs">
                <span className="text-slate-400">User: </span>
                <span className="text-slate-200">
                  {entry.userText.length > 80
                    ? entry.userText.slice(0, 80) + "..."
                    : entry.userText}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-slate-400">Agent: </span>
                <span className="text-slate-200">
                  {entry.agentText.length > 80
                    ? entry.agentText.slice(0, 80) + "..."
                    : entry.agentText}
                </span>
              </div>
              {entry.error && (
                <div className="mt-1 text-xs text-red-400">{entry.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallLog() {
  const { toolCallHistory } = useAdminDebug();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [toolCallHistory]);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Tool Calls ({toolCallHistory.length})
      </h3>
      {toolCallHistory.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500 italic">
          No tool calls yet
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="mt-1 max-h-48 space-y-1 overflow-y-auto"
        >
          {toolCallHistory.map((entry) => {
            const duration =
              entry.endTime && entry.startTime
                ? `${entry.endTime - entry.startTime}ms`
                : "...";

            return (
              <div
                key={entry.id}
                className="rounded border-l-2 bg-[#0f1c3f] p-2"
                style={{
                  borderColor:
                    entry.status === "completed"
                      ? "rgb(34 197 94)"
                      : entry.status === "failed"
                        ? "rgb(239 68 68)"
                        : "rgb(234 179 8)",
                }}
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <span className="font-mono text-xs text-blue-400">
                    {entry.toolName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {duration}
                  </span>
                </div>
                <div className="mt-1 text-xs">
                  <span className="text-slate-400">Args: </span>
                  <span className="font-mono text-slate-400">
                    {JSON.stringify(entry.args).slice(0, 100)}
                  </span>
                </div>
                {entry.result && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-400">
                      Result
                    </summary>
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">
                      {entry.result}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LiveFeed() {
  return (
    <div className="space-y-4">
      <MirrorLog />
      <ToolCallLog />
    </div>
  );
}
