"use client";

import { useState, useEffect, useCallback } from "react";

interface GoogleCalendarConnectProps {
  disabled?: boolean;
}

export function GoogleCalendarConnect({ disabled }: GoogleCalendarConnectProps) {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  const checkStatus = useCallback(() => {
    fetch("/api/google-calendar/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.connected ? "connected" : "disconnected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  useEffect(() => {
    checkStatus();

    // Check if we just returned from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.has("calendar_connected")) {
      setStatus("connected");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.has("calendar_error")) {
      console.error("[GoogleCalendar] OAuth error:", params.get("calendar_error"));
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkStatus]);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/google-calendar/auth-url");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("[GoogleCalendar] Failed to get auth URL:", err);
    }
  };

  const handleDisconnect = async () => {
    await fetch("/api/google-calendar/disconnect", { method: "POST" });
    setStatus("disconnected");
  };

  if (status === "checking") {
    return <p className="text-sm text-foreground/50">Checking calendar...</p>;
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg text-green-500">&#10003;</span>
        <span className="text-base text-foreground">Google Calendar connected</span>
        <button
          onClick={handleDisconnect}
          disabled={disabled}
          className="ml-2 cursor-pointer text-sm text-red-400 underline hover:text-red-300 disabled:cursor-default disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={disabled}
      className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-lg text-white hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
    >
      Connect Google Calendar
    </button>
  );
}
