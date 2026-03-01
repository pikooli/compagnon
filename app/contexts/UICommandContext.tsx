"use client";

import type {
  AddCalendarEventCommand,
  DisplayCalendarCommand,
  DisplayCalendarData,
  DisplayEmailsCommand,
  EmailData,
  FocusCalendarEventCommand,
  FocusEmailCommand,
  RemoveCalendarEventCommand,
  RemoveEmailCommand,
  UICommand,
  UpdateCalendarEventCommand,
} from "@/app/types/ui-commands";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface UICommandContextValue {
  commands: UICommand[];
  pushCommands: (cmds: UICommand[]) => void;
  dismissCommand: (id: string) => void;
  clearCommands: () => void;
  recentlyUpdatedEventIds: Set<string>;
  recentlyAddedEventIds: Set<string>;
  recentlyRemovedEventIds: Set<string>;
  focusedEventId: string | null;
  setFocusedEventId: (id: string | null) => void;
  focusedEmailId: string | null;
  setFocusedEmailId: (id: string | null) => void;
  recentlyRemovedEmailIds: Set<string>;
}

const UICommandContext = createContext<UICommandContextValue | null>(null);

export function UICommandProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<UICommand[]>([]);
  const [recentlyUpdatedEventIds, setRecentlyUpdatedEventIds] = useState<
    Set<string>
  >(new Set());
  const [recentlyAddedEventIds, setRecentlyAddedEventIds] = useState<
    Set<string>
  >(new Set());
  const [recentlyRemovedEventIds, setRecentlyRemovedEventIds] = useState<
    Set<string>
  >(new Set());
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [focusedEmailId, setFocusedEmailId] = useState<string | null>(null);
  const [recentlyRemovedEmailIds, setRecentlyRemovedEmailIds] = useState<
    Set<string>
  >(new Set());
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = clearTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  const markEventUpdated = useCallback((eventId: string) => {
    setRecentlyUpdatedEventIds((prev) => new Set(prev).add(eventId));

    // Clear any existing timer for this eventId
    const existing = clearTimersRef.current.get(eventId);
    if (existing) clearTimeout(existing);

    // Auto-clear after 2s
    const timer = setTimeout(() => {
      setRecentlyUpdatedEventIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      clearTimersRef.current.delete(eventId);
    }, 2000);
    clearTimersRef.current.set(eventId, timer);
  }, []);

  const markEventAdded = useCallback((eventId: string) => {
    setRecentlyAddedEventIds((prev) => new Set(prev).add(eventId));

    const timerKey = `add-${eventId}`;
    const existing = clearTimersRef.current.get(timerKey);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setRecentlyAddedEventIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      clearTimersRef.current.delete(timerKey);
    }, 2000);
    clearTimersRef.current.set(timerKey, timer);
  }, []);

  const scheduleEventRemoval = useCallback((eventId: string) => {
    setFocusedEventId((prev) => (prev === eventId ? null : prev));
    setRecentlyRemovedEventIds((prev) => new Set(prev).add(eventId));

    const timerKey = `remove-${eventId}`;
    const existing = clearTimersRef.current.get(timerKey);
    if (existing) clearTimeout(existing);

    // After 400ms (exit animation duration), actually remove the event from the array
    const timer = setTimeout(() => {
      setCommands((prev) =>
        prev.map((cmd) => {
          if (cmd.type !== "display_calendar") return cmd;
          const calCmd = cmd as DisplayCalendarCommand;
          const filtered = calCmd.data.events.filter((e) => e.id !== eventId);
          if (filtered.length === calCmd.data.events.length) return cmd;
          return {
            ...calCmd,
            data: { ...calCmd.data, events: filtered } as DisplayCalendarData,
          };
        }),
      );
      setRecentlyRemovedEventIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      clearTimersRef.current.delete(timerKey);
    }, 400);
    clearTimersRef.current.set(timerKey, timer);
  }, []);

  const scheduleEmailRemoval = useCallback((emailId: string) => {
    setFocusedEmailId((prev) => (prev === emailId ? null : prev));
    setRecentlyRemovedEmailIds((prev) => new Set(prev).add(emailId));

    const timerKey = `remove-email-${emailId}`;
    const existing = clearTimersRef.current.get(timerKey);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setCommands((prev) =>
        prev.map((cmd) => {
          if (cmd.type !== "display_emails") return cmd;
          const emailCmd = cmd as DisplayEmailsCommand;
          const filtered = emailCmd.data.emails.filter((e) => e.id !== emailId);
          if (filtered.length === emailCmd.data.emails.length) return cmd;
          return {
            ...emailCmd,
            data: { emails: filtered },
          };
        }),
      );
      setRecentlyRemovedEmailIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
      clearTimersRef.current.delete(timerKey);
    }, 400);
    clearTimersRef.current.set(timerKey, timer);
  }, []);

  const pushCommands = useCallback(
    (cmds: UICommand[]) => {
      const regularCmds: UICommand[] = [];
      const updateCmds: UpdateCalendarEventCommand[] = [];
      const addCmds: AddCalendarEventCommand[] = [];
      const removeCmds: RemoveCalendarEventCommand[] = [];
      const removeEmailCmds: RemoveEmailCommand[] = [];

      for (const cmd of cmds) {
        if (cmd.type === "focus_calendar_event") {
          setFocusedEventId((cmd as FocusCalendarEventCommand).data.eventId);
        } else if (cmd.type === "unfocus_calendar_event") {
          setFocusedEventId(null);
        } else if (cmd.type === "focus_email") {
          const focusCmd = cmd as FocusEmailCommand;
          setFocusedEmailId(focusCmd.data.emailId);
          // If focus command includes a body, update the email in display_emails
          if (focusCmd.data.body !== undefined) {
            setCommands((prev) =>
              prev.map((c) => {
                if (c.type !== "display_emails") return c;
                const emailCmd = c as DisplayEmailsCommand;
                const emails = emailCmd.data.emails.map((e) =>
                  e.id === focusCmd.data.emailId
                    ? { ...e, body: focusCmd.data.body }
                    : e,
                );
                return { ...emailCmd, data: { emails } };
              }),
            );
          }
        } else if (cmd.type === "unfocus_email") {
          setFocusedEmailId(null);
        } else if (cmd.type === "update_calendar_event") {
          updateCmds.push(cmd as UpdateCalendarEventCommand);
        } else if (cmd.type === "add_calendar_event") {
          addCmds.push(cmd as AddCalendarEventCommand);
        } else if (cmd.type === "remove_calendar_event") {
          removeCmds.push(cmd as RemoveCalendarEventCommand);
        } else if (cmd.type === "remove_email") {
          removeEmailCmds.push(cmd as RemoveEmailCommand);
        } else {
          regularCmds.push(cmd);
        }
      }

      const hasMutations =
        updateCmds.length > 0 || addCmds.length > 0 || removeCmds.length > 0 || removeEmailCmds.length > 0;

      // Display commands replace older ones of the same type and go to the front
      const displayTypes = new Set(
        regularCmds
          .filter((c) => c.type === "display_calendar" || c.type === "display_emails")
          .map((c) => c.type),
      );

      if (!hasMutations) {
        setCommands((prev) => {
          const filtered = displayTypes.size > 0
            ? prev.filter((c) => !displayTypes.has(c.type))
            : prev;
          return [...regularCmds, ...filtered];
        });
        return;
      }

      // Process mutation commands by mutating existing display_calendar commands
      setCommands((prev) => {
        const filtered = displayTypes.size > 0
          ? prev.filter((c) => !displayTypes.has(c.type))
          : prev;
        let updated = [...regularCmds, ...filtered];

        // Handle updates (replace event in-place)
        for (const updateCmd of updateCmds) {
          const { eventId, updatedEvent } = updateCmd.data;

          for (let i = updated.length - 1; i >= 0; i--) {
            const cmd = updated[i];
            if (cmd.type !== "display_calendar") continue;
            const calCmd = cmd as DisplayCalendarCommand;
            const eventIndex = calCmd.data.events.findIndex(
              (e) => e.id === eventId,
            );
            if (eventIndex === -1) continue;

            const newEvents = [...calCmd.data.events];
            newEvents[eventIndex] = updatedEvent;
            newEvents.sort(
              (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime(),
            );

            const newData: DisplayCalendarData = {
              ...calCmd.data,
              events: newEvents,
            };
            updated[i] = { ...calCmd, data: newData };
            break;
          }

          markEventUpdated(eventId);
        }

        // Handle adds (append event to last display_calendar, re-sort)
        for (const addCmd of addCmds) {
          const { event } = addCmd.data;

          for (let i = updated.length - 1; i >= 0; i--) {
            const cmd = updated[i];
            if (cmd.type !== "display_calendar") continue;
            const calCmd = cmd as DisplayCalendarCommand;

            const newEvents = [...calCmd.data.events, event];
            newEvents.sort(
              (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime(),
            );

            const newData: DisplayCalendarData = {
              ...calCmd.data,
              events: newEvents,
            };
            updated[i] = { ...calCmd, data: newData };
            break;
          }

          markEventAdded(event.id);
        }

        return updated;
      });

      // Handle removals (mark for exit animation, then splice after delay)
      for (const removeCmd of removeCmds) {
        scheduleEventRemoval(removeCmd.data.eventId);
      }

      // Handle email removals
      for (const removeCmd of removeEmailCmds) {
        scheduleEmailRemoval(removeCmd.data.emailId);
      }
    },
    [markEventUpdated, markEventAdded, scheduleEventRemoval, scheduleEmailRemoval],
  );

  const dismissCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearCommands = useCallback(() => {
    setCommands([]);
    setFocusedEventId(null);
    setFocusedEmailId(null);
  }, []);

  return (
    <UICommandContext.Provider
      value={{
        commands,
        pushCommands,
        dismissCommand,
        clearCommands,
        recentlyUpdatedEventIds,
        recentlyAddedEventIds,
        recentlyRemovedEventIds,
        focusedEventId,
        setFocusedEventId,
        focusedEmailId,
        setFocusedEmailId,
        recentlyRemovedEmailIds,
      }}
    >
      {children}
    </UICommandContext.Provider>
  );
}

export function useUICommands() {
  const ctx = useContext(UICommandContext);
  if (!ctx) {
    throw new Error("useUICommands must be used within a UICommandProvider");
  }
  return ctx;
}
