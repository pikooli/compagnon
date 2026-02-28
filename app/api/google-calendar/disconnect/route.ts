import { NextResponse } from "next/server";
import { disconnectCalendar } from "@/app/lib/google-calendar";

export async function POST() {
  try {
    await disconnectCalendar();
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    console.error("[API:google-calendar:disconnect] Error:", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
