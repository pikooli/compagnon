import { NextRequest, NextResponse } from "next/server";
import { invokeBrain } from "@/app/lib/brain";
import type { CalendarEventData, EmailData } from "@/app/types/ui-commands";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, threadId, assistantId, displayedEvents, displayedEmails } = body as {
      message?: string;
      threadId?: string;
      assistantId?: string;
      displayedEvents?: CalendarEventData[];
      displayedEmails?: EmailData[];
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 },
      );
    }

    // Prepend displayed calendar events and emails as structured context so the brain
    // can match references like "my 2pm meeting" or "that email from John" to exact IDs
    let enrichedMessage = message;
    const contextParts: string[] = [];

    if (displayedEvents && displayedEvents.length > 0) {
      const eventLines = displayedEvents.map((e) => {
        const start = new Date(e.start);
        const time = e.allDay
          ? "All day"
          : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return `- "${e.summary}" at ${time} (id: ${e.id})`;
      });
      contextParts.push(`[Currently displayed calendar events:\n${eventLines.join("\n")}]`);
    }

    if (displayedEmails && displayedEmails.length > 0) {
      const emailLines = displayedEmails.map((e) => {
        const fromName = e.from.replace(/<.*>/, "").trim() || e.from;
        return `- From: ${fromName} | Subject: "${e.subject}" (id: ${e.id})`;
      });
      contextParts.push(`[Currently displayed emails:\n${emailLines.join("\n")}]`);
    }

    if (contextParts.length > 0) {
      enrichedMessage = `${contextParts.join("\n\n")}\n\nUser says: ${message}`;
    }

    const result = await invokeBrain(enrichedMessage, {
      threadId: threadId ?? null,
      assistantId: assistantId ?? null,
      uiCommands: [],
    });

    return NextResponse.json({
      response: result.response,
      uiCommands: result.uiCommands,
    });
  } catch (err) {
    console.error("[API:brain] Error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
