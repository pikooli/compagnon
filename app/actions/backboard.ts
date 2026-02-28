"use server";

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { BackboardClient } from "@/app/lib/backboard";

const ASSISTANT_ID_FILE = join(process.cwd(), ".backboard-assistant-id");

// Module-level cache (persists across requests in the same server process)
let cachedClient: BackboardClient | null = null;
let cachedAssistantId: string | null = null;

function getClient(): BackboardClient {
  if (!cachedClient) {
    const apiKey = process.env.BACKBOARD_API_KEY;
    if (!apiKey) {
      throw new Error("BACKBOARD_API_KEY is not set");
    }
    cachedClient = new BackboardClient(apiKey);
  }
  return cachedClient;
}

async function getAssistantId(): Promise<string> {
  if (cachedAssistantId) return cachedAssistantId;

  // Try reading from local file
  try {
    const stored = (await readFile(ASSISTANT_ID_FILE, "utf-8")).trim();
    if (stored) {
      cachedAssistantId = stored;
      console.log(`[Backboard] Loaded assistant from file: ${stored}`);
      return stored;
    }
  } catch {
    // File doesn't exist yet — will create after first assistant creation
  }

  // Auto-create assistant on first run
  const client = getClient();
  console.log("[Backboard] No assistant found — creating one...");
  const assistant = await client.createAssistant(
    "Elderly Care Voice Agent",
    "You are a caring voice assistant for elderly people. You remember personal details, family members, routines, and preferences shared across conversations.",
  );
  cachedAssistantId = assistant.assistant_id;

  // Persist to file so it survives server restarts
  await writeFile(ASSISTANT_ID_FILE, assistant.assistant_id, "utf-8");
  console.log(`[Backboard] Created and saved assistant: ${assistant.assistant_id}`);
  return assistant.assistant_id;
}

// Current session thread — set by createBackboardThread, read by recallMemories.
// Single-user hackathon scope; no need for per-user isolation.
let currentThreadId: string | null = null;

/**
 * Creates a new Backboard thread for this voice session.
 * Returns the thread_id, or null if Backboard is unavailable.
 */
export async function createBackboardThread(): Promise<string | null> {
  try {
    const client = getClient();
    const assistantId = await getAssistantId();
    const thread = await client.createThread(assistantId);
    currentThreadId = thread.thread_id;
    console.log(`[Backboard] Created thread: ${thread.thread_id}`);
    return thread.thread_id;
  } catch (err) {
    console.error("[Backboard] Failed to create thread:", err);
    return null;
  }
}

/**
 * Mirrors a conversation turn (user + agent text) to Backboard for memory extraction.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function mirrorTurnToBackboard(
  threadId: string,
  userText: string,
  agentText: string,
): Promise<void> {
  try {
    const client = getClient();
    // Send user message (Backboard uses its default model for memory extraction)
    await client.sendMessage(threadId, userText, { memory: "Auto" });
    // Send agent message (so Backboard sees both sides of the conversation)
    await client.sendMessage(threadId, agentText, { memory: "Auto" });
    console.log(`[Backboard] Mirrored turn to thread ${threadId}`);
  } catch (err) {
    console.error("[Backboard] Failed to mirror turn:", err);
  }
}

/**
 * Recalls relevant memories using Backboard's LLM (Cerebras) to filter.
 *
 * Primary: sends the query as a Readonly message on the current thread.
 * Backboard searches stored memories, Cerebras picks the relevant ones,
 * and returns a contextual response. The mirrored conversation gives
 * Backboard full context about what was discussed this session.
 *
 * Fallback: if no active thread, dumps all memories via GET /memories.
 */
export async function recallMemories(query: string): Promise<string> {
  try {
    const client = getClient();

    // Send a Readonly message to Backboard. The response includes
    // `retrieved_memories` — scored memories from Backboard's vector search.
    // We use those directly (no need for Backboard's LLM to reformulate).
    if (currentThreadId) {
      const response = await client.sendMessage(
        currentThreadId,
        query || "What do you remember about this user?",
        { memory: "Readonly" },
      );

      const memories = response.retrieved_memories;
      console.log(
        `[Backboard] Recalled ${memories?.length ?? 0} memories for: "${query}"`,
      );

      if (memories && memories.length > 0) {
        // Deduplicate by memory text (Backboard can return duplicates)
        const unique = [...new Map(memories.map((m) => [m.memory, m])).values()];
        const formatted = unique.map((m) => `- ${m.memory}`).join("\n");
        return `Here is what I remember about the user:\n${formatted}`;
      }

      return "No memories stored yet. This is a new user — I don't have any prior information about them.";
    }

    // Fallback: no thread, dump all memories via GET
    console.warn("[Backboard] No active thread — falling back to GET /memories");
    const assistantId = await getAssistantId();
    const allMemories = await client.listMemories(assistantId);

    if (allMemories.length === 0) {
      return "No memories stored yet. This is a new user — I don't have any prior information about them.";
    }

    const formatted = allMemories.map((m) => `- ${m.content}`).join("\n");
    return `Here is what I remember about the user:\n${formatted}`;
  } catch (err) {
    console.error("[Backboard] Failed to recall memories:", err);
    return "I wasn't able to access memories right now. Please continue the conversation normally.";
  }
}
