"use client";

import { useContext, useCallback, useEffect, useRef, useState } from "react";
import { FlowContext } from "@speechmatics/flow-client-react";
import {
  TOOLS,
  executeToolCall,
  type ToolInvokeMessage,
  type ToolResultMessage,
} from "@/app/lib/flow-tools";

export type ToolCallStatus = {
  id: string;
  toolName: string;
  state: "executing" | "completed" | "failed";
  result?: string;
};

export function useFlowToolCalling() {
  const context = useContext(FlowContext);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallStatus | null>(
    null,
  );
  const patchedWsRef = useRef<WebSocket | null>(null);

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

      setActiveToolCall({ id, toolName: fn.name, state: "executing" });

      let toolResult: ToolResultMessage;
      try {
        const result = await executeToolCall(fn.name, fn.arguments);
        toolResult = { message: "ToolResult", id, status: "ok", content: result };
        setActiveToolCall({ id, toolName: fn.name, state: "completed", result });
      } catch (err) {
        const content = err instanceof Error ? err.message : String(err);
        toolResult = { message: "ToolResult", id, status: "failed", content };
        setActiveToolCall({ id, toolName: fn.name, state: "failed", result: content });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).sendWebsocketMessage(toolResult);

      // Auto-clear after 3 s
      setTimeout(() => setActiveToolCall(null), 3000);
    },
    [context],
  );

  return { activeToolCall, handleToolInvoke };
}
