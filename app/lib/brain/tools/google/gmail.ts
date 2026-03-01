import {
  getEmail as getEmailGmail,
  listEmails as listEmailsGmail,
  sendEmail as sendEmailGmail,
  trashEmail as trashEmailGmail,
} from "@/app/lib/google-gmail";
import type { BrainContext } from "@/app/lib/brain/tools";
import type {
  DisplayEmailsCommand,
  EmailData,
  FocusEmailCommand,
  RemoveEmailCommand,
  UnfocusEmailCommand,
} from "@/app/types/ui-commands";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Factory: creates a get_emails tool that fetches inbox emails
 * and auto-pushes a DisplayEmailsCommand to ctx.uiCommands.
 */
export function createGetEmailsTool(ctx: BrainContext) {
  return tool(
    async ({ maxResults, query }): Promise<string> => {
      try {
        const list = await listEmailsGmail({
          maxResults: maxResults ?? 10,
          query: query ?? "is:unread in:inbox",
        });
        const messages = list ?? [];

        if (messages.length === 0) {
          // Push empty display command
          const uiCommand: DisplayEmailsCommand = {
            id: `email-${Date.now()}`,
            type: "display_emails",
            data: { emails: [] },
            timestamp: Date.now(),
          };
          ctx.uiCommands.push(uiCommand);
          return "No emails found matching the query.";
        }

        const fullEmails = await Promise.all(
          messages.map(async (msg) => {
            const email = await getEmailGmail(msg.id!);
            return {
              id: msg.id!,
              from: email.from,
              subject: email.subject,
              date: email.date,
              snippet: email.body.slice(0, 200),
              isUnread: true,
            } satisfies EmailData;
          }),
        );

        // Push UI command for frontend display
        const uiCommand: DisplayEmailsCommand = {
          id: `email-${Date.now()}`,
          type: "display_emails",
          data: { emails: fullEmails },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        const formatted = fullEmails
          .map((e) => {
            const fromName = e.from.replace(/<.*>/, "").trim() || e.from;
            return `- From: ${fromName} | Subject: ${e.subject} (id: ${e.id})`;
          })
          .join("\n");

        return `Here are the emails:\n${formatted}`;
      } catch (err) {
        console.error("[Brain:gmail:getEmails] Failed:", err);
        return "I wasn't able to check your emails right now.";
      }
    },
    {
      name: "get_emails",
      description:
        "Retrieves emails from the user's Gmail inbox. Use when the user asks to see their emails, check their inbox, or look for specific messages.",
      schema: z.object({
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of emails to return (default: 10)"),
        query: z
          .string()
          .optional()
          .describe(
            "Gmail search query filter, e.g. 'is:unread in:inbox', 'from:john@example.com'. Defaults to 'is:unread in:inbox'",
          ),
      }),
    },
  );
}

/**
 * Factory: creates a focus_email tool that fetches full email body
 * and pushes a FocusEmailCommand to show detail view.
 */
export function createFocusEmailTool(ctx: BrainContext) {
  return tool(
    async ({ emailId }): Promise<string> => {
      try {
        const email = await getEmailGmail(emailId);

        // Push focus command with body so the context can update display_emails data
        const uiCommand: FocusEmailCommand = {
          id: `email-focus-${Date.now()}`,
          type: "focus_email",
          data: { emailId, body: email.body },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        return `Email detail view is now displayed.\n\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\nBody:\n${email.body}`;
      } catch (err) {
        console.error("[Brain:gmail:focusEmail] Failed:", err);
        return "I wasn't able to load that email's details.";
      }
    },
    {
      name: "focus_email",
      description:
        "Shows the full detail view of a specific email, including the complete body text. Use when the user asks about a specific email, e.g. 'read that email from John' or 'what does the email about the project say'. The emailId must come from the displayed emails context.",
      schema: z.object({
        emailId: z
          .string()
          .describe(
            "The ID of the email to focus on, from the displayed emails context",
          ),
      }),
    },
  );
}

/**
 * Factory: creates an unfocus_email tool that returns to the email list view.
 * Pure UI — no API calls needed.
 */
export function createUnfocusEmailTool(ctx: BrainContext) {
  return tool(
    async (): Promise<string> => {
      const uiCommand: UnfocusEmailCommand = {
        id: `email-unfocus-${Date.now()}`,
        type: "unfocus_email",
        data: {} as Record<string, never>,
        timestamp: Date.now(),
      };
      ctx.uiCommands.push(uiCommand);

      return "Returned to the email list view.";
    },
    {
      name: "unfocus_email",
      description:
        "Returns from the email detail view back to the email list view. Use when the user wants to go back to their inbox or see all emails again, e.g. 'go back to my emails', 'show all emails', 'back to inbox'.",
      schema: z.object({}),
    },
  );
}

/**
 * Factory: creates a trash_email tool that moves an email to trash
 * and pushes a RemoveEmailCommand for exit animation.
 */
export function createTrashEmailTool(ctx: BrainContext) {
  return tool(
    async ({ emailId }): Promise<string> => {
      try {
        await trashEmailGmail(emailId);

        const uiCommand: RemoveEmailCommand = {
          id: `email-remove-${Date.now()}`,
          type: "remove_email",
          data: { emailId },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        return "Done! The email has been moved to trash.";
      } catch (err) {
        console.error("[Brain:gmail:trashEmail] Failed:", err);
        return "I wasn't able to delete that email right now.";
      }
    },
    {
      name: "trash_email",
      description:
        "Moves an email to the trash. Use when the user asks to delete, trash, or remove an email. The emailId must come from the displayed emails context.",
      schema: z.object({
        emailId: z
          .string()
          .describe(
            "The ID of the email to trash, from the displayed emails context",
          ),
      }),
    },
  );
}

/**
 * Factory: creates a send_email tool. Converted to factory pattern for consistency.
 */
export function createSendEmailTool(ctx: BrainContext) {
  void ctx; // ctx available for future UICommand pushes
  return tool(
    async ({ to, subject, body }): Promise<string> => {
      try {
        await sendEmailGmail({ to, subject, body });
        return "Email sent successfully.";
      } catch (err) {
        console.error("[Brain:gmail:sendEmail] Failed:", err);
        return "I wasn't able to send the email right now.";
      }
    },
    {
      name: "send_email",
      description: "Send an email to a contact.",
      schema: z.object({
        to: z.string().describe("The email address of the recipient"),
        subject: z.string().describe("The subject of the email"),
        body: z.string().describe("The body of the email"),
      }),
    },
  );
}
