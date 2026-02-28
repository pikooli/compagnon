"use client";

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div
      className="relative h-screen overflow-hidden text-white"
      style={{ background: "radial-gradient(circle at top, #0f1c3f, #070d1f 60%)" }}
    >
      {/* Waveform background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/waveform.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
      />

      {/* Nav */}
      <nav className="relative px-20 py-8 text-lg font-semibold tracking-widest text-blue-400">
        Compagnon
      </nav>

      {/* Hero */}
      <div
        className="relative flex items-center justify-center px-5 text-center"
        style={{ height: "calc(100vh - 80px)" }}
      >
        <div className="max-w-3xl">
          <small className="text-xs font-semibold uppercase text-blue-400" style={{ letterSpacing: "2px" }}>
            Welcome to Compagnon
          </small>

          <h1 className="my-5 text-5xl font-extrabold leading-tight">
            Turn Every Conversation Into Coordinated Action
          </h1>

          <p className="mb-10 text-lg leading-relaxed text-slate-400">
            Compagnon converts spoken updates into synchronized action across your sales
            stack — Gmail, Google Calendar and Contact List while building a
            persistent memory of every deal and stakeholder.
          </p>

          <p className="mb-8 text-base font-semibold text-slate-300">
            It listens. It remembers. It acts.
          </p>

          <button
            onClick={onGetStarted}
            className="rounded-2xl px-10 py-4 text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]"
            style={{ background: "linear-gradient(90deg, #2563eb, #3b82f6)" }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
