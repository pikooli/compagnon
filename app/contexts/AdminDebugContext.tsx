"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type {
  MirrorLogEntry,
  ToolCallEntry,
  RecallEntry,
  SessionInfo,
  BackboardMemory,
} from "@/app/types/admin-debug";

interface AdminDebugContextValue {
  // Session
  session: SessionInfo;
  setSession: (info: Partial<SessionInfo>) => void;

  // Mirror log
  mirrorLog: MirrorLogEntry[];
  addMirrorEntry: (entry: MirrorLogEntry) => void;
  updateMirrorEntry: (id: string, update: Partial<MirrorLogEntry>) => void;

  // Tool calls
  toolCallHistory: ToolCallEntry[];
  addToolCall: (entry: ToolCallEntry) => void;
  updateToolCall: (id: string, update: Partial<ToolCallEntry>) => void;

  // Memories
  allMemories: BackboardMemory[];
  setAllMemories: (memories: BackboardMemory[]) => void;
  recallResults: RecallEntry[];
  addRecallResult: (entry: RecallEntry) => void;

  // Reset
  resetSession: () => void;
}

const AdminDebugContext = createContext<AdminDebugContextValue | null>(null);

const INITIAL_SESSION: SessionInfo = {
  threadId: null,
  assistantId: null,
  startedAt: null,
};

export function AdminDebugProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionInfo>(INITIAL_SESSION);
  const [mirrorLog, setMirrorLog] = useState<MirrorLogEntry[]>([]);
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallEntry[]>([]);
  const [allMemories, setAllMemories] = useState<BackboardMemory[]>([]);
  const [recallResults, setRecallResults] = useState<RecallEntry[]>([]);

  const setSession = useCallback((info: Partial<SessionInfo>) => {
    setSessionState((prev) => ({ ...prev, ...info }));
  }, []);

  const addMirrorEntry = useCallback((entry: MirrorLogEntry) => {
    setMirrorLog((prev) => [...prev, entry]);
  }, []);

  const updateMirrorEntry = useCallback(
    (id: string, update: Partial<MirrorLogEntry>) => {
      setMirrorLog((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...update } : e)),
      );
    },
    [],
  );

  const addToolCall = useCallback((entry: ToolCallEntry) => {
    setToolCallHistory((prev) => [...prev, entry]);
  }, []);

  const updateToolCall = useCallback(
    (id: string, update: Partial<ToolCallEntry>) => {
      setToolCallHistory((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...update } : e)),
      );
    },
    [],
  );

  const addRecallResult = useCallback((entry: RecallEntry) => {
    setRecallResults((prev) => [...prev, entry]);
  }, []);

  const resetSession = useCallback(() => {
    setSessionState(INITIAL_SESSION);
    setMirrorLog([]);
    setToolCallHistory([]);
    setAllMemories([]);
    setRecallResults([]);
  }, []);

  return (
    <AdminDebugContext.Provider
      value={{
        session,
        setSession,
        mirrorLog,
        addMirrorEntry,
        updateMirrorEntry,
        toolCallHistory,
        addToolCall,
        updateToolCall,
        allMemories,
        setAllMemories,
        recallResults,
        addRecallResult,
        resetSession,
      }}
    >
      {children}
    </AdminDebugContext.Provider>
  );
}

export function useAdminDebug(): AdminDebugContextValue {
  const ctx = useContext(AdminDebugContext);
  if (!ctx) {
    throw new Error("useAdminDebug must be used within AdminDebugProvider");
  }
  return ctx;
}
