/** Tool definition sent in StartConversation.tools[] */
export interface FlowToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: "string" | "integer" | "number" | "boolean";
          description: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

/** Server-sent ToolInvoke message */
export interface ToolInvokeMessage {
  message: "ToolInvoke";
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Client-sent ToolResult message */
export interface ToolResultMessage {
  message: "ToolResult";
  id: string;
  status: "ok" | "failed" | "rejected";
  content: string;
}

// --- Tool registry ---

export const TOOLS: FlowToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "ask_brain",
      description:
        "Routes any question that needs deeper thinking, memory recall, calculations, or external lookups to the brain. Use this whenever the user asks something you can't answer from the current conversation alone — for example, recalling past conversations, personal details, family members, preferences, or routines.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The full question or context to send to the brain for processing",
          },
        },
        required: ["message"],
      },
    },
  },
];

// --- Tool executor ---

/**
 * Executes a tool call by calling the brain API route.
 * Takes optional session context to pass along to the brain.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  context?: { threadId?: string | null; assistantId?: string | null },
): Promise<string> {
  switch (name) {
    case "ask_brain": {
      const message = (args.message as string) ?? "";
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          threadId: context?.threadId,
          assistantId: context?.assistantId,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Brain API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      return data.response ?? "No response from brain.";
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
