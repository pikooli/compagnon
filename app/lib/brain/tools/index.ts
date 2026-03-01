import { BackboardClient } from "@/app/lib/backboard";
import type { UICommand } from "@/app/types/ui-commands";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { tools as contactTools } from "./contact";
import { createCreateCalendarEventTool, createDeleteCalendarEventTool, createFocusCalendarEventTool, createGetCalendarEventsTool, createUnfocusCalendarEventTool, createUpdateCalendarEventTool } from "./google/calendar";
import { createDocTool, readDocTool, readSpreadsheetTool } from "./google/docs";
import { createGetEmailsTool, createFocusEmailTool, createUnfocusEmailTool, createTrashEmailTool, createSendEmailTool } from './google/gmail';
import { tools as productTools } from "./product";
import { createSaveRuleTool, createRemoveRuleTool, createListRulesTool } from "./rules";

export interface BrainContext {
  threadId?: string | null;
  assistantId?: string | null;
  uiCommands: UICommand[];
  conversationHistory?: { role: string; text: string }[];
}

/**
 * Creates brain tools with the given session context.
 * Tools are re-created per request so they close over the current threadId/assistantId.
 */
export function createBrainTools(ctx: BrainContext) {
  const recallMemories = tool(
    async ({ query }): Promise<string> => {
      const apiKey = process.env.BACKBOARD_API_KEY;
      if (!apiKey) {
        return "Memory system is unavailable (no API key configured).";
      }

      const client = new BackboardClient(apiKey);

      try {
        if (!ctx.assistantId) {
          return "Memory system is not connected for this session.";
        }

        // Direct GET /memories — fast, no LLM round-trip on Backboard's side
        const allMemories = await client.listMemories(ctx.assistantId);
        console.log(
          `[Brain:recall] Retrieved ${allMemories.length} memories for: "${query}"`,
        );

        if (allMemories.length === 0) {
          return "No memories stored yet. This is a new user — I don't have any prior information about them.";
        }

        const formatted = allMemories.map((m) => `- ${m.content}`).join("\n");
        return `Here is what I remember about the user:\n${formatted}`;
      } catch (err) {
        console.error("[Brain:recall] Failed:", err);
        return "I wasn't able to access memories right now.";
      }
    },
    {
      name: "recall_memories",
      description:
        "Retrieves stored memories about the user from previous conversations. Use this when the user asks if you remember something, references past conversations, or when you need personal context (family members, preferences, routines, past events).",
      schema: z.object({
        query: z
          .string()
          .describe(
            "The user's question or topic to recall memories about, e.g. 'my grandson' or 'what I like to eat'",
          ),
      }),
    },
  );

  return [recallMemories, createGetCalendarEventsTool(ctx), createCreateCalendarEventTool(ctx), createUpdateCalendarEventTool(ctx), createDeleteCalendarEventTool(ctx), createFocusCalendarEventTool(ctx), createUnfocusCalendarEventTool(ctx), createGetEmailsTool(ctx), createFocusEmailTool(ctx), createUnfocusEmailTool(ctx), createTrashEmailTool(ctx), createSendEmailTool(ctx), readDocTool, createDocTool, readSpreadsheetTool, ...contactTools, ...productTools, createSaveRuleTool(ctx), createRemoveRuleTool(ctx), createListRulesTool(ctx)];
}
