import {
  isCalendarConnected,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/app/lib/google-calendar";
import { tool } from "@langchain/core/tools";
import { z } from "zod";


export const getCalendarEvents = tool(
  async ({ timeRange, maxResults }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google Calendar is not connected. The user needs to connect their Google Calendar using the button in the app.";
      }

      const now = new Date();
      let timeMinISO = now.toISOString();
      let timeMaxISO: string | undefined;

      if (timeRange === "today") {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        timeMaxISO = endOfDay.toISOString();
      } else if (timeRange === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        timeMinISO = tomorrow.toISOString();
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);
        timeMaxISO = endOfTomorrow.toISOString();
      } else if (timeRange === "this_week") {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        timeMaxISO = endOfWeek.toISOString();
      }
      // "upcoming" = no timeMax, just next N events

      const events = await listCalendarEvents({
        maxResults: maxResults ?? 10,
        timeMinISO,
        timeMaxISO,
      });

      if (events.length === 0) {
        return `No events found for ${timeRange}.`;
      }

      const formatted = events
        .map((e) => {
          const startDate = new Date(e.start);
          const time = e.allDay
            ? "All day"
            : startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
          const date = startDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          let line = `- ${date} ${time}: ${e.summary}`;
          if (e.location) line += ` (at ${e.location})`;
          return line;
        })
        .join("\n");

      return `Here are the ${timeRange} events:\n${formatted}`;
    } catch (err) {
      console.error("[Brain:calendar] Failed:", err);
      return "I wasn't able to check the calendar right now.";
    }
  },
  {
    name: "get_calendar_events",
    description:
      "Retrieves upcoming events from the user's Google Calendar. Use when the user asks about their schedule, appointments, meetings, or what's coming up today, tomorrow, or this week.",
    schema: z.object({
      timeRange: z
        .enum(["today", "tomorrow", "this_week", "upcoming"])
        .describe("The time period to look up events for"),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of events to return (default: 10)"),
    }),
  },
);

export const createCalendarEventTool = tool(
  async ({ summary, startISO, endISO, description, location, timeZone }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google Calendar is not connected. The user needs to connect their Google Calendar using the button in the app.";
      }

      const event = await createCalendarEvent({
        summary,
        startISO,
        endISO,
        description,
        location,
        timeZone,
      });

      const startDate = new Date(event.start);
      const dateStr = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const timeStr = event.allDay
        ? "all day"
        : startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      return `Done! I've added "${event.summary}" to your calendar on ${dateStr} at ${timeStr}.`;
    } catch (err: unknown) {
      console.error("[Brain:calendar:create] Failed:", err);
      // 403 means the token was granted with read-only scope — user needs to reconnect
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't add the event because your Google Calendar connection needs to be updated. Please disconnect and reconnect your calendar in the app.";
      }
      return "I wasn't able to add the event to your calendar right now.";
    }
  },
  {
    name: "create_calendar_event",
    description:
      "Creates a new event on the user's Google Calendar. Use when the user asks to add, schedule, or book an appointment, meeting, reminder, or any event. You must convert natural language times into ISO 8601 format using today's date from the system context.",
    schema: z.object({
      summary: z.string().describe("The event title, e.g. 'Doctor appointment'"),
      startISO: z.string().describe("Event start time in ISO 8601 format, e.g. '2026-03-01T15:00:00'"),
      endISO: z.string().describe("Event end time in ISO 8601 format, e.g. '2026-03-01T16:00:00'"),
      description: z.string().optional().describe("Optional event description or notes"),
      location: z.string().optional().describe("Optional event location"),
      timeZone: z.string().optional().describe("IANA timezone, e.g. 'America/New_York'. Use the user's local timezone if known."),
    }),
  },
);

export const updateCalendarEventTool = tool(
  async ({ eventTitle, summary, startISO, endISO, description, location, timeZone }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google Calendar is not connected. The user needs to connect their Google Calendar using the button in the app.";
      }

      // Search upcoming 30 days for an event matching the given title
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const events = await listCalendarEvents({
        maxResults: 50,
        timeMinISO: new Date().toISOString(),
        timeMaxISO: thirtyDaysFromNow.toISOString(),
      });

      const needle = eventTitle.toLowerCase();
      const match = events.find((e) => e.summary.toLowerCase().includes(needle));

      if (!match) {
        return `I couldn't find an event called "${eventTitle}" in the next 30 days. Please check the title and try again.`;
      }

      const updated = await updateCalendarEvent(match.id, {
        summary,
        startISO,
        endISO,
        description,
        location,
        timeZone,
      });

      const startDate = new Date(updated.start);
      const dateStr = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const timeStr = updated.allDay
        ? "all day"
        : startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      return `Done! I've updated "${updated.summary}" — it's now on ${dateStr} at ${timeStr}.`;
    } catch (err: unknown) {
      console.error("[Brain:calendar:update] Failed:", err);
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't update the event because your Google Calendar connection needs to be updated. Please disconnect and reconnect your calendar in the app.";
      }
      return "I wasn't able to update the event right now.";
    }
  },
  {
    name: "update_calendar_event",
    description:
      "Updates an existing event on the user's Google Calendar. Use when the user asks to reschedule, move, rename, or change details of an existing event. Search by event title. Only include the fields that should change.",
    schema: z.object({
      eventTitle: z.string().describe("The current title of the event to find and update, e.g. 'Doctor appointment'"),
      summary: z.string().optional().describe("New event title if the user wants to rename it"),
      startISO: z.string().optional().describe("New start time in ISO 8601 format, e.g. '2026-03-05T15:00:00'"),
      endISO: z.string().optional().describe("New end time in ISO 8601 format, e.g. '2026-03-05T16:00:00'"),
      description: z.string().optional().describe("New event description"),
      location: z.string().optional().describe("New event location"),
      timeZone: z.string().optional().describe("IANA timezone, e.g. 'America/New_York'"),
    }),
  },
);

export const deleteCalendarEventTool = tool(
  async ({ eventTitle }): Promise<string> => {
    try {
      const connected = await isCalendarConnected();
      if (!connected) {
        return "Google Calendar is not connected. The user needs to connect their Google Calendar using the button in the app.";
      }

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const events = await listCalendarEvents({
        maxResults: 50,
        timeMinISO: new Date().toISOString(),
        timeMaxISO: thirtyDaysFromNow.toISOString(),
      });

      const needle = eventTitle.toLowerCase();
      const match = events.find((e) => e.summary.toLowerCase().includes(needle));

      if (!match) {
        return `I couldn't find an event called "${eventTitle}" in the next 30 days. Please check the title and try again.`;
      }

      await deleteCalendarEvent(match.id);

      return `Done! I've removed "${match.summary}" from your calendar.`;
    } catch (err: unknown) {
      console.error("[Brain:calendar:delete] Failed:", err);
      if (err instanceof Error && err.message.includes("403")) {
        return "I couldn't delete the event because your Google Calendar connection needs to be updated. Please disconnect and reconnect your calendar in the app.";
      }
      return "I wasn't able to delete the event right now.";
    }
  },
  {
    name: "delete_calendar_event",
    description:
      "Deletes an existing event from the user's Google Calendar. Use when the user asks to cancel, remove, or delete an appointment or event. Search by event title.",
    schema: z.object({
      eventTitle: z.string().describe("The title of the event to find and delete, e.g. 'Doctor appointment'"),
    }),
  },
);
