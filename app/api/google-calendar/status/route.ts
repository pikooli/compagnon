import { NextResponse } from "next/server";
import { isCalendarConnected } from "@/app/lib/google-calendar";

export async function GET() {
  try {
    const connected = await isCalendarConnected();
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
