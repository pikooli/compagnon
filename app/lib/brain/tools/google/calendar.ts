import {
  isCalendarConnected,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/app/lib/google-calendar";
import type { BrainContext } from "@/app/lib/brain/tools";
import type { AddCalendarEventCommand, DisplayCalendarCommand, FocusCalendarEventCommand, RemoveCalendarEventCommand, UnfocusCalendarEventCommand, UpdateCalendarEventCommand } from "@/app/types/ui-commands";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Factory: creates a get_calendar_events tool that auto-pushes a UICommand
 * to ctx.uiCommands when events are successfully fetched.
 */
export function createGetCalendarEventsTool(ctx: BrainContext) {
  return tool(
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

        // Auto-push UI command for the frontend to display calendar cards
        const uiCommand: DisplayCalendarCommand = {
          id: `cal-${Date.now()}`,
          type: "display_calendar",
          data: {
            events: events.map((e) => ({
              id: e.id,
              summary: e.summary,
              description: e.description,
              location: e.location,
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              attendees: e.attendees,
            })),
            timeRange,
          },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        if (events.length === 0) {
          return `No events found for ${timeRange}.`;
        }

        // Use Europe/Paris as default since the target user is in Paris
        const tz = "Europe/Paris";
        const formatted = events
          .map((e) => {
            const startDate = new Date(e.start);
            const endDate = new Date(e.end);
            const timeFmt = { hour: "numeric" as const, minute: "2-digit" as const, timeZone: tz };
            const startTime = e.allDay
              ? "All day"
              : startDate.toLocaleTimeString("en-US", timeFmt);
            const endTime = e.allDay
              ? ""
              : ` – ${endDate.toLocaleTimeString("en-US", timeFmt)}`;
            const date = startDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: tz,
            });
            let line = `- ${date} ${startTime}${endTime}: ${e.summary}`;
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
}

/**
 * Factory: creates a create_calendar_event tool that auto-pushes
 * an AddCalendarEventCommand to ctx.uiCommands after a successful creation.
 */
export function createCreateCalendarEventTool(ctx: BrainContext) {
  return tool(
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

        // Push UI command so the frontend can animate the new card in
        const uiCommand: AddCalendarEventCommand = {
          id: `cal-add-${Date.now()}`,
          type: "add_calendar_event",
          data: {
            event: {
              id: event.id,
              summary: event.summary,
              description: event.description,
              location: event.location,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              attendees: event.attendees,
            },
          },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        const eventTimeZone = timeZone ?? "Europe/Paris";
        const startDate = new Date(event.start);
        const dateStr = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: eventTimeZone,
        });
        const timeStr = event.allDay
          ? "all day"
          : startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: eventTimeZone });

        return `Done! I've added "${event.summary}" to your calendar on ${dateStr} at ${timeStr}.`;
      } catch (err: unknown) {
        console.error("[Brain:calendar:create] Failed:", err);
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
}

/**
 * Factory: creates an update_calendar_event tool that auto-pushes
 * an UpdateCalendarEventCommand to ctx.uiCommands after a successful update.
 */
export function createUpdateCalendarEventTool(ctx: BrainContext) {
  return tool(
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

        // Push UI command so the frontend can animate the update in-place
        const uiCommand: UpdateCalendarEventCommand = {
          id: `cal-update-${Date.now()}`,
          type: "update_calendar_event",
          data: {
            eventId: match.id,
            updatedEvent: {
              id: updated.id,
              summary: updated.summary,
              description: updated.description,
              location: updated.location,
              start: updated.start,
              end: updated.end,
              allDay: updated.allDay,
              attendees: updated.attendees,
            },
          },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

        const updateTimeZone = timeZone ?? "Europe/Paris";
        const startDate = new Date(updated.start);
        const dateStr = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: updateTimeZone,
        });
        const timeStr = updated.allDay
          ? "all day"
          : startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: updateTimeZone });

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
}

/**
 * Factory: creates a delete_calendar_event tool that auto-pushes
 * a RemoveCalendarEventCommand to ctx.uiCommands after a successful deletion.
 */
export function createDeleteCalendarEventTool(ctx: BrainContext) {
  return tool(
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

        // Push UI command so the frontend can animate the card removal
        const uiCommand: RemoveCalendarEventCommand = {
          id: `cal-remove-${Date.now()}`,
          type: "remove_calendar_event",
          data: { eventId: match.id },
          timestamp: Date.now(),
        };
        ctx.uiCommands.push(uiCommand);

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
}

/**
 * Factory: creates a focus_calendar_event tool that pushes a FocusCalendarEventCommand
 * to show the detail view of a specific calendar event. No API calls needed.
 */
export function createFocusCalendarEventTool(ctx: BrainContext) {
  return tool(
    async ({ eventId }): Promise<string> => {
      const uiCommand: FocusCalendarEventCommand = {
        id: `cal-focus-${Date.now()}`,
        type: "focus_calendar_event",
        data: { eventId },
        timestamp: Date.now(),
      };
      ctx.uiCommands.push(uiCommand);

      return "The detail view for this event is now displayed to the user. You can describe the event details in your response.";
    },
    {
      name: "focus_calendar_event",
      description:
        "Shows the full detail view of a specific calendar event, including all attendees with their response status, full description, and location. Use when the user asks about a specific event's details, e.g. 'tell me about my 3pm meeting' or 'what's the details on the team standup'. The eventId must come from the displayed events context.",
      schema: z.object({
        eventId: z.string().describe("The ID of the calendar event to focus on, from the displayed events context"),
      }),
    },
  );
}

/**
 * Factory: creates an unfocus_calendar_event tool that pushes an UnfocusCalendarEventCommand
 * to return to the calendar list view. No API calls needed.
 */
export function createUnfocusCalendarEventTool(ctx: BrainContext) {
  return tool(
    async (): Promise<string> => {
      const uiCommand: UnfocusCalendarEventCommand = {
        id: `cal-unfocus-${Date.now()}`,
        type: "unfocus_calendar_event",
        data: {} as Record<string, never>,
        timestamp: Date.now(),
      };
      ctx.uiCommands.push(uiCommand);

      return "Returned to the calendar list view.";
    },
    {
      name: "unfocus_calendar_event",
      description:
        "Returns from the event detail view back to the calendar list view. Use when the user wants to go back to their schedule or see all events again, e.g. 'go back to my schedule', 'show all my events', 'back to the list'.",
      schema: z.object({}),
    },
  );
}
