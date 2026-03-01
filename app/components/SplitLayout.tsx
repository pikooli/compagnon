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

      <button
        onClick={() => setDesktopOpen((o) => !o)}
        aria-label={desktopOpen ? "Collapse display panel" : "Expand display panel"}
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
            Display
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl leading-none text-slate-400 hover:text-white"
            aria-label="Close display panel"
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
        aria-label="Open display panel"
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
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        Display
      </button>
    </div>
  );
}