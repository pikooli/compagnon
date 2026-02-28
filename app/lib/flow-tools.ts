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
// TEMPORARY: get_data is a hardcoded testing tool. It will be replaced with
// real data-fetching tools in a future version.

export const TOOLS: FlowToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_data",
      description:
        "Retrieves the user's schedule or reminders for today. Call this when the user asks about their plans, schedule, reminders, or what they need to do.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// --- Tool executor ---
// TEMPORARY: hardcoded responses with fake delay for testing. Will be replaced.

export async function executeToolCall(
  name: string,
  _args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "get_data":
      // TEMPORARY: simulate 3s processing with hardcoded response
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return "Today you need to go fishing with your son at 2pm. Don't forget to bring the red tackle box.";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
