import { isCalendarConnected, listDriveFiles, readGoogleDoc, createGoogleDoc, readSpreadsheet } from "@/app/lib/google-calendar";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const readDocTool = tool(
  async ({ documentName, documentId }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google is not connected. The user needs to connect their Google account using the button in the app.";
      }

      let docId = documentId;
      if (!docId && documentName) {
        const files = await listDriveFiles(documentName);
        if (files.length === 0) {
          return `I couldn't find a document called "${documentName}" in Google Drive.`;
        }
        docId = files[0].id;
      }

      if (!docId) return "Please provide a document name or ID.";

      const text = await readGoogleDoc(docId);
      const trimmed = text.slice(0, 4000);
      return `Here is the content of the document:\n\n${trimmed}`;
    } catch (err: unknown) {
      console.error("[Brain:docs:read] Failed:", err);
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't read the document because your Google connection needs to be updated. Please disconnect and reconnect in the app.";
      }
      return "I wasn't able to read the document right now.";
    }
  },
  {
    name: "read_google_doc",
    description:
      "Reads the content of a Google Doc. Search by document name (finds it in Drive) or provide the document ID directly.",
    schema: z.object({
      documentName: z
        .string()
        .optional()
        .describe("Name or partial name of the document to find in Google Drive"),
      documentId: z
        .string()
        .optional()
        .describe("The Google Doc ID if already known"),
    }),
  },
);

export const createDocTool = tool(
  async ({ title, content }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google is not connected. The user needs to connect their Google account using the button in the app.";
      }

      const doc = await createGoogleDoc(title, content);
      return `Done! I've created a new document called "${title}". You can open it here: ${doc.url}`;
    } catch (err: unknown) {
      console.error("[Brain:docs:create] Failed:", err);
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't create the document because your Google connection needs to be updated. Please disconnect and reconnect in the app.";
      }
      return "I wasn't able to create the document right now.";
    }
  },
  {
    name: "create_google_doc",
    description:
      "Creates a new Google Doc with an optional initial content. Use when the user asks to create, write, or draft a document.",
    schema: z.object({
      title: z.string().describe("The title of the new document"),
      content: z
        .string()
        .optional()
        .describe("Optional initial text content for the document"),
    }),
  },
);

export const readSpreadsheetTool = tool(
  async ({ name }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google is not connected. The user needs to connect their Google account using the button in the app.";
      }

      const { rows, title } = await readSpreadsheet(name);
      if (rows.length === 0) return `The spreadsheet "${title}" appears to be empty.`;

      const text = rows.map((row) => row.join("\t")).join("\n");
      return `Here is the content of "${title}":\n\n${text.slice(0, 4000)}`;
    } catch (err: unknown) {
      console.error("[Brain:sheets:read] Failed:", err);
      if (err instanceof Error && err.message.includes("not found")) {
        return (err as Error).message;
      }
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't read the spreadsheet because your Google connection needs to be updated. Please disconnect and reconnect in the app.";
      }
      return "I wasn't able to read the spreadsheet right now.";
    }
  },
  {
    name: "read_spreadsheet",
    description:
      "Reads the content of a Google Sheets spreadsheet by its exact name. Use when the user asks to look at, read, or check a spreadsheet.",
    schema: z.object({
      name: z.string().describe("The exact name of the spreadsheet in Google Drive"),
    }),
  },
);
