"use client";

import dynamic from "next/dynamic";

const VoiceAgent = dynamic(
  () => import("./components/VoiceAgent").then((m) => m.VoiceAgent),
  { ssr: false },
);

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <VoiceAgent />
    </main>
  );
}
