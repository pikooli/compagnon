import type { BrainContext } from "@/app/lib/brain/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Factory: creates a show_ui tool that pushes a DisplayDynamicCommand
 * so the brain can render arbitrary HTML in the interactive panel.
 */
export function createShowUITool(ctx: BrainContext) {
  return tool(
    async ({ html, title }): Promise<string> => {
      console.log(
        `[Brain:show_ui] Pushing dynamic display${title ? ` — "${title}"` : ""}`,
      );

      ctx.uiCommands.push({
        id: `dynamic-${Date.now()}`,
        type: "display_dynamic",
        data: { html, title },
        timestamp: Date.now(),
      });

      return title
        ? `The "${title}" content is now displayed on screen.`
        : "The content is now displayed on screen.";
    },
    {
      name: "show_ui",
      description:
        "Displays rich HTML content in the user's interactive panel. Use this when you need to show the user formatted content that doesn't fit calendar or email displays — for example: email drafts, summaries, comparison tables, lists, instructions, or any structured information. The HTML will be rendered in a dark-themed panel. Use inline CSS only. Do NOT include <script>, <iframe>, or <form> tags.",
      schema: z.object({
        html: z
          .string()
          .describe(
            "The HTML string to display. Use inline CSS with dark theme colors: background #0f1c3f, text #e2e8f0, accent #60a5fa, borders #1e2d4a. Minimum font-size 18px. No scripts, iframes, or forms.",
          ),
        title: z
          .string()
          .optional()
          .describe(
            "Optional title shown above the content, e.g. 'Email Draft' or 'Daily Summary'",
          ),
      }),
    },
  );
}
