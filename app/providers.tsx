"use client";

import { ReactNode, useMemo } from "react";
import { FlowProvider } from "@speechmatics/flow-client-react";
import { PCMAudioRecorderProvider } from "@speechmatics/browser-audio-input-react";
import { PCMPlayerProvider } from "@speechmatics/web-pcm-player-react";

export function Providers({ children }: { children: ReactNode }) {
  const audioContexts = useMemo(() => {
    if (typeof window === "undefined") return null;
    return {
      recorder: new AudioContext({ sampleRate: 16000 }),
      player: new AudioContext({ sampleRate: 16000 }),
    };
  }, []);

  if (!audioContexts) {
    return <>{children}</>;
  }

  return (
    <FlowProvider appId="hackathon-activate-voice-proto">
      <PCMAudioRecorderProvider
        audioContext={audioContexts.recorder}
        workletScriptURL="/pcm-audio-worklet.min.js"
      >
        <PCMPlayerProvider audioContext={audioContexts.player}>
          {children}
        </PCMPlayerProvider>
      </PCMAudioRecorderProvider>
    </FlowProvider>
  );
}
