"use server";

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { BackboardClient, type BackboardAssistant, type BackboardMemory, type RetrievedMemory } from "@/app/lib/backboard";

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

// Current session thread — set by createBackboardThread, used for mirroring + admin panel.
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
    // Send user message with memory extraction enabled
    await client.sendMessage(threadId, userText, { memory: "Auto" });
    // Send agent message with memory OFF — only user messages should trigger storage
    await client.sendMessage(threadId, agentText, { memory: "Off" });
    console.log(`[Backboard] Mirrored turn to thread ${threadId}`);
  } catch (err) {
    console.error("[Backboard] Failed to mirror turn:", err);
  }
}

/**
 * Returns the current session's assistant ID and thread ID.
 */
export async function getBackboardSessionInfo(): Promise<{
  assistantId: string | null;
  threadId: string | null;
}> {
  try {
    const assistantId = await getAssistantId();
    return { assistantId, threadId: currentThreadId };
  } catch {
    return { assistantId: null, threadId: null };
  }
}

/**
 * Fetches all stored memories for the current assistant.
 */
export async function fetchAllMemories(): Promise<BackboardMemory[]> {
  try {
    const client = getClient();
    const assistantId = await getAssistantId();
    const result = await client.listMemories(assistantId);
    // Defensive: ensure we always return an array
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("[Backboard] Failed to fetch memories:", err);
    return [];
  }
}

/**
 * Lists all assistants from Backboard for the current API key.
 */
export async function listAssistants(): Promise<BackboardAssistant[]> {
  try {
    const client = getClient();
    return await client.listAssistants();
  } catch (err) {
    console.error("[Backboard] Failed to list assistants:", err);
    return [];
  }
}

/**
 * Sets the active assistant ID (persists to file + cache).
 * Next thread creation will use this assistant.
 */
export async function setActiveAssistant(assistantId: string): Promise<void> {
  cachedAssistantId = assistantId;
  currentThreadId = null;
  await writeFile(ASSISTANT_ID_FILE, assistantId, "utf-8");
  console.log(`[Backboard] Switched to assistant: ${assistantId}`);
}

/**
 * Creates a new assistant with the given name, switches to it, and returns it.
 */
export async function createNewAssistant(
  name: string,
): Promise<BackboardAssistant | null> {
  try {
    const client = getClient();
    const assistant = await client.createAssistant(
      name,
      "You are a caring voice assistant for elderly people. You remember personal details, family members, routines, and preferences shared across conversations.",
    );
    // Switch to the new assistant
    cachedAssistantId = assistant.assistant_id;
    currentThreadId = null;
    await writeFile(ASSISTANT_ID_FILE, assistant.assistant_id, "utf-8");
    console.log(`[Backboard] Created new assistant "${name}": ${assistant.assistant_id}`);
    return assistant;
  } catch (err) {
    console.error("[Backboard] Failed to create assistant:", err);
    return null;
  }
}

/**
 * Recalls memories via Backboard's native memory=Readonly mode.
 * Returns structured data: `text` for Flow, `memories` array for admin panel.
 *
 * Primary: sends query as a Readonly message on the current thread.
 * Backboard searches stored memories and returns `retrieved_memories`.
 * Fallback: if no active thread, dumps all memories via GET /memories.
 */
export async function recallMemoriesStructured(
  query: string,
): Promise<{ text: string; memories: RetrievedMemory[] }> {
  try {
    const client = getClient();

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
        const unique = [...new Map(memories.map((m) => [m.memory, m])).values()];
        const formatted = unique.map((m) => `- ${m.memory}`).join("\n");
        return {
          text: `Here is what I remember about the user:\n${formatted}`,
          memories: unique,
        };
      }

      return {
        text: "No memories stored yet. This is a new user — I don't have any prior information about them.",
        memories: [],
      };
    }

    // Fallback: no thread, dump all memories via GET
    console.warn("[Backboard] No active thread — falling back to GET /memories");
    const assistantId = await getAssistantId();
    const allMemories = await client.listMemories(assistantId);

    if (allMemories.length === 0) {
      return {
        text: "No memories stored yet. This is a new user — I don't have any prior information about them.",
        memories: [],
      };
    }

    const formatted = allMemories.map((m) => `- ${m.content}`).join("\n");
    return {
      text: `Here is what I remember about the user:\n${formatted}`,
      memories: allMemories.map((m) => ({ id: m.id, memory: m.content, score: 0 })),
    };
  } catch (err) {
    console.error("[Backboard] Failed to recall memories:", err);
    return {
      text: "I wasn't able to access memories right now. Please continue the conversation normally.",
      memories: [],
    };
  }
}

/**
 * Recalls relevant memories using Backboard's native memory=Readonly mode.
 * Backboard handles vector search and LLM filtering internally (using Cerebras behind the scenes).
 *
 * Primary: sends the query as a Readonly message on the current thread.
 * Fallback: if no active thread, dumps all memories via GET /memories.
 */
export async function recallMemories(query: string): Promise<string> {
  try {
    const client = getClient();

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
