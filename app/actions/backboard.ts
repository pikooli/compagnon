"use server";

import { BackboardClient, type BackboardAssistant, type BackboardMemory } from "@/app/lib/backboard";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

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
  const assistant = await client.createAssistant(
    "Voice Agent",
    "You are a caring voice assistant. You remember personal details, family members, routines, and preferences shared across conversations.",
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
