"use client";

import { useContext, useCallback, useEffect, useRef, useState } from "react";
import { FlowContext } from "@speechmatics/flow-client-react";
import {
  TOOLS,
  executeToolCall,
  type ToolInvokeMessage,
  type ToolResultMessage,
} from "@/app/lib/flow-tools";
import type { ToolCallEntry } from "@/app/types/admin-debug";
import type { CalendarEventData, EmailData, UICommand } from "@/app/types/ui-commands";

export type ToolCallStatus = {
  id: string;
  toolName: string;
  state: "executing" | "completed" | "failed";
  result?: string;
};

export interface ToolCallingCallbacks {
  onToolCallStart?: (entry: ToolCallEntry) => void;
  onToolCallEnd?: (id: string, update: Partial<ToolCallEntry>) => void;
  onUICommands?: (commands: UICommand[]) => void;
}

export interface ToolCallingContext {
  threadId?: string | null;
  assistantId?: string | null;
  displayedEvents?: CalendarEventData[];
  displayedEmails?: EmailData[];
  focusedEventId?: string | null;
  focusedEmailId?: string | null;
  conversationHistory?: { role: "user" | "agent"; text: string }[];
}

export function useFlowToolCalling(
  callbacks?: ToolCallingCallbacks,
  sessionContext?: ToolCallingContext,
) {
  const context = useContext(FlowContext);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallStatus | null>(
    null,
  );
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallEntry[]>([]);
  const patchedWsRef = useRef<WebSocket | null>(null);

  // Keep session context in a ref so the handler always sees the latest value
  const sessionContextRef = useRef(sessionContext);
  useEffect(() => {
    sessionContextRef.current = sessionContext;
  }, [sessionContext]);

  // Patch WebSocket.send to inject `tools` into the StartConversation message.
  // The SDK's `startConversation` doesn't support a `tools` param, so we
  // intercept the first JSON message on the wire and add it ourselves.
  useEffect(() => {
    if (!context) return;
    const { client } = context;

    const handleSocketInit = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws as WebSocket | null;
      if (!ws || ws === patchedWsRef.current) return;
      patchedWsRef.current = ws;

      const originalSend = ws.send.bind(ws);
      let intercepted = false;

      ws.send = (
        data: string | ArrayBufferLike | Blob | ArrayBufferView,
      ) => {
        if (!intercepted && typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            if (parsed.message === "StartConversation") {
              parsed.tools = TOOLS;
              data = JSON.stringify(parsed);
              intercepted = true;
            }
          } catch {
            // Not JSON — pass through
          }
        }
        return originalSend(data);
      };
    };

    client.addEventListener("socketInitialized", handleSocketInit);
    return () => {
      client.removeEventListener("socketInitialized", handleSocketInit);
    };
  }, [context]);

  // Handle a ToolInvoke message: execute the tool and send ToolResult back.
  const handleToolInvoke = useCallback(
    async (invokeMsg: ToolInvokeMessage) => {
      if (!context) return;
      const { client } = context;
      const { id, function: fn } = invokeMsg;
      const startTime = Date.now();

      setActiveToolCall({ id, toolName: fn.name, state: "executing" });

      const entry: ToolCallEntry = {
        id,
        toolName: fn.name,
        args: fn.arguments,
        status: "executing",
        startTime,
      };
      setToolCallHistory((prev) => [...prev, entry]);
      callbacks?.onToolCallStart?.(entry);

      let toolResult: ToolResultMessage;
      try {
        const result = await executeToolCall(
          fn.name,
          fn.arguments,
          sessionContextRef.current ?? undefined,
          callbacks?.onUICommands,
        );

        toolResult = {
          message: "ToolResult",
          id,
          status: "ok",
          content: result,
        };
        setActiveToolCall({
          id,
          toolName: fn.name,
          state: "completed",
          result,
        });

        const endTime = Date.now();
        setToolCallHistory((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: "completed" as const, result, endTime }
              : e,
          ),
        );
        callbacks?.onToolCallEnd?.(id, {
          status: "completed",
          result,
          endTime,
        });
      } catch (err) {
        const content = err instanceof Error ? err.message : String(err);
        toolResult = {
          message: "ToolResult",
          id,
          status: "failed",
          content,
        };
        setActiveToolCall({
          id,
          toolName: fn.name,
          state: "failed",
          result: content,
        });

        const endTime = Date.now();
        setToolCallHistory((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: "failed" as const, result: content, endTime }
              : e,
          ),
        );
        callbacks?.onToolCallEnd?.(id, {
          status: "failed",
          result: content,
          endTime,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).sendWebsocketMessage(toolResult);

      // Auto-clear after 3 s
      setTimeout(() => setActiveToolCall(null), 3000);
    },
    [context, callbacks],
  );

  return { activeToolCall, toolCallHistory, handleToolInvoke };
}
