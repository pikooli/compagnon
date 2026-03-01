import { gmail_v1, google } from "googleapis";
import { createOAuth2Client, loadTokens, saveTokens, StoredTokens } from "./google-calendar";

export async function listEmails(options?: {
  maxResults?: number;
  query?: string;
}): Promise<gmail_v1.Schema$Message[]> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Gmail not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Auto-persist refreshed tokens
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
      console.log("[GoogleCalendar] Tokens auto-refreshed and saved");
    } catch (err) {
      console.error("[GoogleCalendar] Failed to save refreshed tokens:", err);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: options?.maxResults ?? 10,
    q: options?.query,
  });

  return res.data.messages ?? [];
}

export async function sendEmail(email: {
  to: string;
  subject: string;
  body: string;
}): Promise<gmail_v1.Schema$Message> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Gmail not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[GoogleGmail] Failed to save refreshed tokens:", err);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const message = [
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    email.body,
  ].join("\n");

  const encodedMessage = Buffer
    .from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return res.data;
}

export async function trashEmail(emailId: string): Promise<void> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Gmail not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[GoogleGmail] Failed to save refreshed tokens:", err);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  await gmail.users.messages.trash({ userId: "me", id: emailId });
}

function decode(data: string) {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(part: any): string | null {
  if (!part) return null;

  // priorité au text/plain
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decode(part.body.data);
  }

  if (part.parts) {
    for (const p of part.parts) {
      const result = extractBody(p);
      if (result) return result;
    }
  }

  return null;
}



export async function getEmail(emailId: string): Promise<{
  from: string;
  date: string;
  subject: string;
  body: string;
}> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Gmail not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const res = await gmail.users.messages.get({
    userId: "me",
    id: emailId,
    format: "full",
  });

  const payload = res.data.payload;
      const headers = payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const from = getHeader("From");
      const date = getHeader("Date");
      const subject = getHeader("Subject");

      const body = extractBody(payload) ?? "";

      return {
        from: from,
        date: date,
        subject: subject,
        body: body,
      };
}