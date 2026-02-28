import { google } from "googleapis";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";

const TOKEN_PATH = join(process.cwd(), ".google-calendar-tokens.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  allDay: boolean;
}

function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/google-calendar/callback`
  );
}

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth credentials not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

// --- Token persistence ---

interface StoredTokens {
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
async function loadTokens(): Promise<StoredTokens | null> {
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

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

// --- Public API ---

export function getAuthUrl(): string {
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
      await saveTokens({ ...existing, ...newTokens });
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
  }));
}
