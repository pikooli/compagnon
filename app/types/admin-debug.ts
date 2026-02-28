import type { BackboardMemory, RetrievedMemory } from "@/app/lib/backboard";

export interface MirrorLogEntry {
  id: string;
  userText: string;
  agentText: string;
  status: "pending" | "sent" | "failed";
  timestamp: number;
  error?: string;
}

export interface ToolCallEntry {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "executing" | "completed" | "failed";
  result?: string;
  startTime: number;
  endTime?: number;
}

export interface RecallEntry {
  id: string;
  query: string;
  memories: RetrievedMemory[];
  timestamp: number;
}

export interface SessionInfo {
  threadId: string | null;
  assistantId: string | null;
  startedAt: number | null;
}

export type { BackboardMemory };
