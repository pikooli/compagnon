import type { CalendarEventData, EmailData, UICommand } from "@/app/types/ui-commands";

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
        "ALWAYS call this tool for EVERYTHING the user says. This includes: retrieving data, sending mail, performing actions, AND navigation commands like 'go back', 'return to list', 'show all'. NEVER respond without calling this tool first. The USER LIVE IN PARIS, SO ALWAYSUSE THE TIMEZONE OF PARIS",
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

// --- Navigation intercept ---

const NAV_BACK_PATTERN = /\b(go back|back to|return to|show all)\b/i;

interface ExecuteContext {
  threadId?: string | null;
  assistantId?: string | null;
  displayedEvents?: CalendarEventData[];
  displayedEmails?: EmailData[];
  focusedEventId?: string | null;
  focusedEmailId?: string | null;
  conversationHistory?: { role: string; text: string }[];
}

/**
 * Fast-path: intercept "go back" navigation phrases before hitting the brain.
 * Returns a result string if handled, or null to fall through to brain.
 */
function tryNavigateBack(
  message: string,
  context: ExecuteContext | undefined,
  onUICommands?: (commands: UICommand[]) => void,
): string | null {
  if (!NAV_BACK_PATTERN.test(message)) return null;
  if (!context) return null;

  if (context.focusedEventId) {
    onUICommands?.([{
      id: `cal-unfocus-${Date.now()}`,
      type: "unfocus_calendar_event",
      data: {},
      timestamp: Date.now(),
    }]);
    return "Returned to the calendar list.";
  }

  if (context.focusedEmailId) {
    onUICommands?.([{
      id: `email-unfocus-${Date.now()}`,
      type: "unfocus_email",
      data: {},
      timestamp: Date.now(),
    }]);
    return "Returned to the email list.";
  }

  // Nothing focused — fall through to brain (user might mean something else)
  return null;
}

// --- Tool executor ---

/**
 * Executes a tool call by calling the brain API route.
 * Takes optional session context to pass along to the brain.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  context?: ExecuteContext,
  onUICommands?: (commands: UICommand[]) => void,
): Promise<string> {
  switch (name) {
    case "ask_brain": {
      const message = (args.message as string) ?? "";

      // Fast-path: intercept "go back" navigation before hitting the brain
      const navResult = tryNavigateBack(message, context, onUICommands);
      if (navResult) return navResult;

      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          threadId: context?.threadId,
          assistantId: context?.assistantId,
          displayedEvents: context?.displayedEvents,
          displayedEmails: context?.displayedEmails,
          conversationHistory: context?.conversationHistory,
        }),
      });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Brain API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      console.log("res", JSON.stringify(data, null, 2));

      // Forward any UI commands from the brain to the callback
      if (data.uiCommands?.length && onUICommands) {
        onUICommands(data.uiCommands);
      }

      return data.response ?? "No response from brain.";
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
