import { NextResponse } from "next/server";
import { getAuthUrl } from "@/app/lib/google-calendar";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[API:google-calendar:auth-url] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate auth URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
