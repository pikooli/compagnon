"use client";

import { SessionInfo } from "./SessionInfo";
import { LiveFeed } from "./LiveFeed";

export function AdminPanel() {
  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground/60">
        Admin Debug
      </h2>

      {/* Session Info — top section */}
      <div className="mb-4 shrink-0">
        <SessionInfo />
      </div>

      {/* Separator */}
      <div className="mb-4 border-t border-foreground/10" />

      {/* Live Feed — bottom section, grows to fill */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LiveFeed />
      </div>
    </div>
  );
}
