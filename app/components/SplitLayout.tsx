"use client";

import { useState } from "react";

export function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Main content — always visible, fills remaining space */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[#070d1f]">
        {left}
      </div>

      {/* ── Desktop right panel ── */}
      <div
        className={`hidden md:block flex-shrink-0 overflow-hidden bg-[#070d1f] transition-all duration-300 ${
          desktopOpen
            ? "w-1/2 border-l border-[#1e2d4a]"
            : "w-0 border-0"
        }`}
      >
        <div
          className={`h-full overflow-y-auto transition-opacity duration-200 ${
            desktopOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {right}
        </div>
      </div>

      {/* Desktop collapse/expand tab — rides the panel boundary */}
      <button
        onClick={() => setDesktopOpen((o) => !o)}
        aria-label={desktopOpen ? "Collapse debug panel" : "Expand debug panel"}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-50 h-14 w-5 items-center justify-center rounded-l-md border border-r-0 border-[#1e2d4a] bg-[#0f1c3f] text-blue-400 transition-all duration-300"
        style={{ right: desktopOpen ? "calc(50% - 1px)" : "0px" }}
      >
        <span
          className="text-base leading-none transition-transform duration-300 inline-block"
          style={{ transform: desktopOpen ? "rotate(0deg)" : "rotate(180deg)" }}
        >
          ›
        </span>
      </button>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile bottom sheet ── */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col bg-[#070d1f] border-t border-[#1e2d4a] transition-transform duration-300 ${
          mobileOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "72vh" }}
      >
        {/* Sheet header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#1e2d4a] px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            Debug Console
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl leading-none text-slate-400 hover:text-white"
            aria-label="Close debug panel"
          >
            ×
          </button>
        </div>
        {/* Sheet content */}
        <div className="flex-1 overflow-y-auto">
          {right}
        </div>
      </div>

      {/* Mobile floating "Debug" button */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className={`md:hidden fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[#1e2d4a] bg-[#0f1c3f] px-4 py-2.5 text-xs font-semibold text-blue-400 shadow-lg transition-all duration-200 ${
          mobileOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        aria-label="Open debug panel"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Debug
      </button>
    </div>
  );
}
