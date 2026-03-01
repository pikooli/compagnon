/** Shared calendar event data — mirrors CalendarEvent but lives in a shared types file
 * to avoid client importing server-only google-calendar.ts at runtime */
export interface CalendarEventData {
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

export interface UICommand {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export interface DisplayCalendarData {
  events: CalendarEventData[];
  timeRange: string;
}

export interface DisplayCalendarCommand extends UICommand {
  type: "display_calendar";
  data: DisplayCalendarData;
}

export interface UpdateCalendarEventData {
  eventId: string;
  updatedEvent: CalendarEventData;
}

export interface UpdateCalendarEventCommand extends UICommand {
  type: "update_calendar_event";
  data: UpdateCalendarEventData;
}

export interface AddCalendarEventCommand extends UICommand {
  type: "add_calendar_event";
  data: { event: CalendarEventData };
}

export interface RemoveCalendarEventCommand extends UICommand {
  type: "remove_calendar_event";
  data: { eventId: string };
}

export interface FocusCalendarEventCommand extends UICommand {
  type: "focus_calendar_event";
  data: { eventId: string };
}

export interface UnfocusCalendarEventCommand extends UICommand {
  type: "unfocus_calendar_event";
  data: Record<string, never>;
}

// --- Email types ---

export interface EmailData {
  id: string;
  from: string;        // "John Doe <john@example.com>"
  subject: string;
  date: string;        // RFC 2822 date string
  snippet: string;     // ~200 char preview
  body?: string;       // full text/plain body (only populated on focus)
  isUnread: boolean;
}

export interface DisplayEmailsCommand extends UICommand {
  type: "display_emails";
  data: { emails: EmailData[] };
}

export interface FocusEmailCommand extends UICommand {
  type: "focus_email";
  data: { emailId: string; body?: string };
}

export interface UnfocusEmailCommand extends UICommand {
  type: "unfocus_email";
  data: Record<string, never>;
}

export interface RemoveEmailCommand extends UICommand {
  type: "remove_email";
  data: { emailId: string };
}

/** Union of all known UI command types — extend as new display types are added */
export type KnownUICommand =
  | DisplayCalendarCommand
  | UpdateCalendarEventCommand
  | AddCalendarEventCommand
  | RemoveCalendarEventCommand
  | FocusCalendarEventCommand
  | UnfocusCalendarEventCommand
  | DisplayEmailsCommand
  | FocusEmailCommand
  | UnfocusEmailCommand
  | RemoveEmailCommand;
