import { readFile, unlink, writeFile } from "fs/promises";
import { google } from "googleapis";
import { join } from "path";

const TOKEN_PATH = join(process.cwd(), ".google-calendar-tokens.json");
  
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send"
];

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  allDay: boolean;
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
  }[];
}

export function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/google-calendar/callback`
  );
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth credentials not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

// --- Token persistence ---

export interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Load tokens from file, falling back to env vars if no file exists yet.
 * This lets you bootstrap from GOOGLE_ACCESS_TOKEN / GOOGLE_REFRESH_TOKEN in .env.
 */
export async function loadTokens(): Promise<StoredTokens | null> {
  // Try file first
  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    // No file — fall back to env vars
  }

  // Seed from env vars if available
  if (process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_ACCESS_TOKEN) {
    const tokens: StoredTokens = {
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      expiry_date: process.env.GOOGLE_EXPIRY_DATE
        ? Number(process.env.GOOGLE_EXPIRY_DATE)
        : undefined,
      token_type: "Bearer",
    };
    // Persist to file so future reads are faster and auto-refresh works
    await saveTokens(tokens);
    console.log("[GoogleCalendar] Seeded tokens from env vars → saved to file");
    return tokens;
  }

  return null;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

// --- Public API ---

export function getCalendarAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await saveTokens(tokens as StoredTokens);
  console.log("[GoogleCalendar] Tokens saved after OAuth exchange");
}

export async function isCalendarConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return !!tokens?.access_token;
}

export async function disconnectCalendar(): Promise<void> {
  try {
    await unlink(TOKEN_PATH);
    console.log("[GoogleCalendar] Tokens deleted — disconnected");
  } catch {
    // File may not exist
  }
}

export async function listCalendarEvents(options?: {
  maxResults?: number;
  timeMinISO?: string;
  timeMaxISO?: string;
}): Promise<CalendarEvent[]> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Calendar not connected");
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

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: options?.timeMinISO ?? new Date().toISOString(),
    timeMax: options?.timeMaxISO,
    maxResults: options?.maxResults ?? 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = res.data.items ?? [];
  return items.map((e) => ({
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
    attendees: e.attendees?.map((a) => ({
      email: a.email ?? "",
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    })),
  }));
}

export async function createCalendarEvent(event: {
  summary: string;
  startISO: string;
  endISO: string;
  description?: string;
  location?: string;
  timeZone?: string;
}): Promise<CalendarEvent> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Calendar not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[GoogleCalendar] Failed to save refreshed tokens:", err);
    }
  });

  const timeZone = event.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startISO, timeZone },
      end: { dateTime: event.endISO, timeZone },
    },
  });

  const e = res.data;
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
  };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Calendar not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[GoogleCalendar] Failed to save refreshed tokens:", err);
    }
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.events.delete({ calendarId: "primary", eventId });
}

// --- Google Drive ---

export async function listDriveFiles(name: string): Promise<{ id: string; name: string }[]> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) throw new Error("Google not connected");

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const res = await drive.files.list({
    q: `name contains '${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 10,
  });

  return (res.data.files ?? []).map((f) => ({ id: f.id ?? "", name: f.name ?? "" }));
}

// --- Google Docs ---

export async function readGoogleDoc(documentId: string): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) throw new Error("Google not connected");

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  const docs = google.docs({ version: "v1", auth: oauth2Client });
  const res = await docs.documents.get({ documentId });

  const content = res.data.body?.content ?? [];
  return content
    .flatMap((el) =>
      el.paragraph
        ? (el.paragraph.elements ?? []).map((pe) => pe.textRun?.content ?? "")
        : [],
    )
    .join("");
}

export async function createGoogleDoc(
  title: string,
  content?: string,
): Promise<{ id: string; url: string }> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) throw new Error("Google not connected");

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  const docs = google.docs({ version: "v1", auth: oauth2Client });
  const res = await docs.documents.create({ requestBody: { title } });
  const docId = res.data.documentId ?? "";

  if (content && docId) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: [{ insertText: { location: { index: 1 }, text: content } }] },
    });
  }

  return { id: docId, url: `https://docs.google.com/document/d/${docId}/edit` };
}

// --- Google Sheets ---

export async function readSpreadsheet(name: string): Promise<{ rows: string[][]; title: string }> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) throw new Error("Google not connected");

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const driveRes = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  const file = driveRes.data.files?.[0];
  if (!file?.id) throw new Error(`Spreadsheet "${name}" not found`);

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: file.id,
    range: "A1:Z200",
  });

  return { rows: res.data.values ?? [], title: file.name ?? name };
}

export async function updateCalendarEvent(
  eventId: string,
  updates: {
    summary?: string;
    startISO?: string;
    endISO?: string;
    description?: string;
    location?: string;
    timeZone?: string;
  },
): Promise<CalendarEvent> {
  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error("Google Calendar not connected");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const existing = (await loadTokens()) ?? {};
      await saveTokens({ ...existing, ...newTokens } as StoredTokens);
    } catch (err) {
      console.error("[GoogleCalendar] Failed to save refreshed tokens:", err);
    }
  });

  const timeZone = updates.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Build only the fields that are being changed
  const requestBody: Record<string, unknown> = {};
  if (updates.summary !== undefined) requestBody.summary = updates.summary;
  if (updates.description !== undefined) requestBody.description = updates.description;
  if (updates.location !== undefined) requestBody.location = updates.location;
  if (updates.startISO !== undefined) requestBody.start = { dateTime: updates.startISO, timeZone };
  if (updates.endISO !== undefined) requestBody.end = { dateTime: updates.endISO, timeZone };

  const res = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody,
  });

  const e = res.data;
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
  };
}