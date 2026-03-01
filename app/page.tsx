"use client";

import dynamic from "next/dynamic";
import { AdminDebugProvider } from "@/app/contexts/AdminDebugContext";
import { SplitLayout } from "@/app/components/SplitLayout";

const VoiceAgent = dynamic(
  () => import("./components/VoiceAgent").then((m) => m.VoiceAgent),
  { ssr: false },
);

const AdminPanel = dynamic(
  () => import("./components/admin/AdminPanel").then((m) => m.AdminPanel),
  { ssr: false },
);

export default function Home() {
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
