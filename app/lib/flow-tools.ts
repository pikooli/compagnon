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
      name: "recall_memories",
      description:
        "Retrieves stored memories about the user from previous conversations. Call this when the user asks if you remember something, references past conversations, or when you need personal context (family members, preferences, routines, past events) to give a better answer. Pass the user's question or topic as the query so the memory system can find the most relevant memories.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The user's question or topic to recall memories about, e.g. 'my grandson' or 'what I like to eat'",
          },
        },
        required: ["query"],
      },
    },
  },
];

// --- Tool executor ---

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  // Dynamic import to keep server action out of the client bundle
  const { recallMemories } = await import("@/app/actions/backboard");

  switch (name) {
    case "recall_memories":
      return recallMemories((args.query as string) ?? "");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
