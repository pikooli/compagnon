"use client";

import dynamic from "next/dynamic";
import { AdminDebugProvider } from "@/app/contexts/AdminDebugContext";
import { UICommandProvider } from "@/app/contexts/UICommandContext";

const AppShell = dynamic(
  () => import("./components/AppShell").then((m) => m.AppShell),
  { ssr: false },
);

export default function Home() {
  return (
    <main className="h-screen bg-background text-foreground">
      <UICommandProvider>
        <AdminDebugProvider>
          <AppShell />
        </AdminDebugProvider>
      </UICommandProvider>
    </main>
  );
}
