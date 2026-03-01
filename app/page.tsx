"use client";

import dynamic from "next/dynamic";
import { AdminDebugProvider } from "@/app/contexts/AdminDebugContext";
import { UICommandProvider } from "@/app/contexts/UICommandContext";
import { SplitLayout } from "@/app/components/SplitLayout";

const VoiceAgent = dynamic(
  () => import("./components/VoiceAgent").then((m) => m.VoiceAgent),
  { ssr: false },
);

const AdminPanel = dynamic(
  () => import("./components/admin/AdminPanel").then((m) => m.AdminPanel),
  { ssr: false },
);

const InteractivePanel = dynamic(
  () =>
    import("./components/interactive/InteractivePanel").then(
      (m) => m.InteractivePanel,
    ),
  { ssr: false },
);

export default function Home() {
  return (
    <main className="h-screen bg-background text-foreground">
      <UICommandProvider>
        <AdminDebugProvider>
          <SplitLayout
            left={
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto">
                  <VoiceAgent />
                </div>
                <div className="flex-shrink-0 border-t border-[#1e2d4a]">
                  <details className="group">
                    <summary className="cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300">
                      Debug Console
                    </summary>
                    <div className="max-h-[40vh] overflow-y-auto">
                      <AdminPanel />
                    </div>
                  </details>
                </div>
              </div>
            }
            right={<InteractivePanel />}
          />
        </AdminDebugProvider>
      </UICommandProvider>
    </main>
  );
}
