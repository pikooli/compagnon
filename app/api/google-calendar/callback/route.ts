import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/app/lib/google-calendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (error) {
    console.error("[API:google-calendar:callback] OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/?calendar_error=${encodeURIComponent(error)}`, baseUrl),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?calendar_error=no_code", baseUrl),
    );
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(
      new URL("/?calendar_connected=true", baseUrl),
    );
  } catch (err) {
    console.error("[API:google-calendar:callback] Token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/?calendar_error=token_failed", baseUrl),
    );
  }
}
