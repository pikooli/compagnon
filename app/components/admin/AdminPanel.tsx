"use client";

import { SessionInfo } from "./SessionInfo";
import { LiveFeed } from "./LiveFeed";

export function AdminPanel() {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-5 border-b border-[#1e2d4a] pb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
          Debug Console
        </span>
      </div>

      {/* Session Info — top section */}
      <div className="mb-4 shrink-0">
        <SessionInfo />
      </div>

      {/* Separator */}
      <div className="mb-4 border-t border-[#162040]" />

      {/* Live Feed — bottom section, grows to fill */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LiveFeed />
      </div>
    </div>
  );
}
