"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AdminDebugProvider } from "@/app/contexts/AdminDebugContext";
import { SplitLayout } from "@/app/components/SplitLayout";
import { LandingPage } from "@/app/components/LandingPage";

const VoiceAgent = dynamic(
  () => import("./components/VoiceAgent").then((m) => m.VoiceAgent),
  { ssr: false },
);

const AdminPanel = dynamic(
  () => import("./components/admin/AdminPanel").then((m) => m.AdminPanel),
  { ssr: false },
);

export default function Home() {
  const [showApp, setShowApp] = useState(false);

  if (!showApp) {
    return <LandingPage onGetStarted={() => setShowApp(true)} />;
  }

  return (
    <main className="h-screen bg-background text-foreground">
      <AdminDebugProvider>
        <SplitLayout
          left={<VoiceAgent />}
          right={<AdminPanel />}
        />
      </AdminDebugProvider>
    </main>
  );
}
