import { getCalendarAuthUrl } from "@/app/lib/google-calendar";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = getCalendarAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[API:google-calendar:auth-url] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate auth URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
