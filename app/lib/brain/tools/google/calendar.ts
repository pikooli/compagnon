import {
    isCalendarConnected,
    listCalendarEvents,
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