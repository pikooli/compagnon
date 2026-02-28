import { NextRequest, NextResponse } from "next/server";
import { invokeBrain } from "@/app/lib/brain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, threadId, assistantId } = body as {
      message?: string;
      threadId?: string;
      assistantId?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 },
      );
    }

    const response = await invokeBrain(message, {
      threadId: threadId ?? null,
      assistantId: assistantId ?? null,
    });

    return NextResponse.json({ response });
  } catch (err) {
    console.error("[API:brain] Error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
