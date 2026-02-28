"use client";

import { useEffect, useRef } from "react";
import {
  createBackboardThread,
  mirrorTurnToBackboard,
} from "@/app/actions/backboard";

interface Message {
  role: "user" | "agent";
  text: string;
}

export interface MirrorCallbacks {
  onThreadCreated?: (threadId: string) => void;
  onMirrorStart?: (id: string, userText: string, agentText: string) => void;
  onMirrorComplete?: (id: string) => void;
  onMirrorFail?: (id: string, error: string) => void;
}

let mirrorIdCounter = 0;

/**
 * Mirrors completed conversation turns to Backboard for memory extraction.
 *
 * - Creates a new Backboard thread when the conversation starts
 * - Detects completed turn pairs (user → agent) and fires mirror calls
 * - All Backboard calls are fire-and-forget — never block the voice pipeline
 * - Resets on conversation stop so the next session gets a fresh thread
 */
export function useConversationMirror(
  messages: Message[],
  isActive: boolean,
  callbacks?: MirrorCallbacks,
) {
  const threadIdRef = useRef<string | null>(null);
  const mirroredCountRef = useRef(0);
  const creatingThreadRef = useRef(false);

  // Create thread when conversation starts, reset on stop
  useEffect(() => {
    if (isActive && !threadIdRef.current && !creatingThreadRef.current) {
      creatingThreadRef.current = true;
      createBackboardThread().then((id) => {
        threadIdRef.current = id;
        creatingThreadRef.current = false;
        if (id) callbacks?.onThreadCreated?.(id);
      });
    }

    if (!isActive) {
      threadIdRef.current = null;
      mirroredCountRef.current = 0;
      creatingThreadRef.current = false;
    }
  }, [isActive, callbacks]);

  // Mirror completed turn pairs
  useEffect(() => {
    if (!threadIdRef.current || messages.length === 0) return;

    // Find completed turn pairs we haven't mirrored yet.
    // A turn pair = a user message followed by an agent message.
    // We scan from the beginning using mirroredCountRef to track progress.
    let idx = mirroredCountRef.current;

    while (idx + 1 < messages.length) {
      const first = messages[idx];
      const second = messages[idx + 1];

      if (first.role === "user" && second.role === "agent") {
        const threadId = threadIdRef.current;
        const userText = first.text;
        const agentText = second.text;
        const mirrorId = `mirror-${++mirrorIdCounter}`;

        callbacks?.onMirrorStart?.(mirrorId, userText, agentText);

        // Fire-and-forget with status reporting
        mirrorTurnToBackboard(threadId, userText, agentText)
          .then(() => callbacks?.onMirrorComplete?.(mirrorId))
          .catch((err) =>
            callbacks?.onMirrorFail?.(
              mirrorId,
              err instanceof Error ? err.message : String(err),
            ),
          );
        idx += 2;
      } else {
        // Skip non-pair messages (e.g. consecutive user or agent messages)
        idx += 1;
      }
    }

    mirroredCountRef.current = idx;
  }, [messages, callbacks]);
}
