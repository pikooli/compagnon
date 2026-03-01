import { connectMongo } from "@/app/lib/mongoose/mongoose";
import { readRules } from "@/app/lib/rules";
import type { UICommand } from "@/app/types/ui-commands";
import { ChatCerebras } from "@langchain/cerebras";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createBrainTools, type BrainContext } from "./tools";

export interface BrainResult {
  response: string;
  uiCommands: UICommand[];
}

// Singleton LLM instance — reused across requests
let cachedModel: ChatCerebras | null = null;

function getModel(): ChatCerebras {
  if (!cachedModel) {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error("CEREBRAS_API_KEY is not set");
    }
    cachedModel = new ChatCerebras({
      apiKey,
      model: "gpt-oss-120b",
    });
  }
  return cachedModel;
}

function getSystemPrompt(rulesText: string): string {
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let prompt = `You are a helpful assistant. ALWAYS CALL TOOLS.
Today's date is ${today}. The current time is ${currentTime}.
When the user references calendar events (e.g. "my 2pm meeting"), match them to the exact event title from the displayed events context. Use that exact title when calling update_calendar_event or delete_calendar_event.
When the user asks about a specific event's details (e.g. "tell me about my 3pm meeting", "what's in that meeting"), use focus_calendar_event with the event's ID from the displayed events context. When they want to go back to the list (e.g. "go back to my schedule", "show all events"), use unfocus_calendar_event.
When the user asks to see their emails, use get_emails. When they ask about a specific email (e.g. "read that email from John", "what does the project email say"), use focus_email with the email ID from the displayed emails context. When they want to go back to the email list (e.g. "go back to my emails", "show all emails"), use unfocus_email. When they want to delete or trash an email, use trash_email with the email ID from the displayed emails context.

## Smart Scheduling
Before creating any calendar event, ALWAYS call get_calendar_events first for the target day to see what's already booked.
- If the user specified an exact time: check for conflicts. If there's a conflict, warn them and suggest the nearest free slot.
- If the user did NOT specify a time (e.g. "schedule a coffee on Thursday"): find a free slot that respects their rules/preferences, and suggest it. Pick a reasonable default duration (1 hour for meetings, 30 min for coffee/calls) if not specified.
- When suggesting a time, briefly explain why (e.g. "Your morning is free" or "You're booked until 3pm, how about 3-4pm?").
- NEVER suggest a time slot that is in the past. Only suggest times after the current time.
- After the user confirms (or if they gave an exact time with no conflict), proceed with create_calendar_event.`;

  prompt += `

## User Preferences & Rules — CRITICAL
You MUST actively detect and save user preferences. This is one of your most important jobs.

**When to call save_rule:** Call save_rule IMMEDIATELY when the user says ANYTHING that reveals a recurring preference. This includes:
- Explicit rules: "don't schedule meetings after 6pm", "I prefer morning slots"
- Implicit preferences hidden in conversation: "it's always before 9am when I take a coffee", "I never do calls on Fridays", "I like to keep mornings free"
- Patterns with "always", "never", "I prefer", "I like", "I don't like", "I usually", "I hate"
- Corrections that imply a preference: "no, not in the morning!" → save that they don't want morning events

**IMPORTANT:** When the user states a preference AND requests an action in the same message, you must do BOTH:
1. Call save_rule to persist the preference for future sessions
2. Perform the requested action (e.g. create the calendar event)
Do NOT skip save_rule just because you already acted on the preference in this conversation.

When an action you are about to take would violate one of the user's rules, WARN them before proceeding. Explain which rule would be violated and ask if they want to proceed anyway. If they confirm, proceed with the action.
When the user wants to change or remove a preference, use remove_rule.`;

  if (rulesText.trim()) {
    prompt += `

The user has the following saved preferences and rules — respect these in all actions:
${rulesText}`;
  } else {
    prompt += `

The user has no saved preferences yet.`;
  }

  return prompt;
}

/**
 * Invokes the brain agent with a user message.
 * Creates fresh tools per request to close over the session context (threadId, assistantId).
 * The LLM instance is cached and reused.
 */
export async function invokeBrain(
  message: string,
  ctx: BrainContext,
): Promise<BrainResult> {
  await connectMongo();
  const model = getModel();
  const tools = createBrainTools(ctx);

  const rulesText = await readRules();

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: getSystemPrompt(rulesText),
  });

  // Build conversation history from prior turns (exclude last entry — it's the current user message
  // which is already represented by the enriched `message` parameter).
  // Cap at last 10 turns to avoid blowing through Cerebras token limits.
  const rawHistory = (ctx.conversationHistory ?? []).slice(0, -1);
  const historyMessages = rawHistory.slice(-10).map((msg) => ({
    role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
    content: msg.text,
  }));

  console.log(`[Brain] --- New invocation ---`);
  console.log(`[Brain] System prompt (first 200 chars): "${getSystemPrompt(rulesText).slice(0, 200)}..."`);
  console.log(`[Brain] Rules loaded: "${rulesText || "(none)"}"`);
  console.log(`[Brain] Conversation history (${historyMessages.length} prior msgs):`);
  for (const hm of historyMessages) {
    console.log(`[Brain]   ${hm.role}: "${hm.content.slice(0, 120)}${hm.content.length > 120 ? "..." : ""}"`);
  }
  console.log(`[Brain] Current message: "${message.slice(0, 200)}${message.length > 200 ? "..." : ""}"`);
  console.log(`[Brain] Tools available: [${tools.map((t) => t.name).join(", ")}]`);

  const startTime = Date.now();

  const result = await agent.invoke({
    messages: [...historyMessages, { role: "user", content: message }],
  });

  const elapsed = Date.now() - startTime;

  // Log the full LangGraph message trace
  const messages = result.messages;
  console.log(`[Brain] Completed in ${elapsed}ms — ${messages.length} messages in trace:`);
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const type = msg._getType();
    const content = typeof msg.content === "string" ? msg.content.slice(0, 150) : JSON.stringify(msg.content).slice(0, 150);
    // Log tool calls on AI messages
    const toolCalls = (msg as Record<string, unknown>).tool_calls as Array<{ name: string; args: unknown }> | undefined;
    if (toolCalls && toolCalls.length > 0) {
      const callNames = toolCalls.map((tc) => `${tc.name}(${JSON.stringify(tc.args).slice(0, 80)})`).join(", ");
      console.log(`[Brain]   [${i}] ${type}: tool_calls=[${callNames}]`);
    } else {
      console.log(`[Brain]   [${i}] ${type}: "${content}${content.length >= 150 ? "..." : ""}"`);
    }
  }

  // Extract the last AI message content
  let response = "I wasn't able to process that right now.";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg._getType() === "ai" &&
      typeof msg.content === "string" &&
      msg.content.length > 0
    ) {
      response = msg.content;
      break;
    }
  }

  console.log(`[Brain] Final response: "${response.slice(0, 200)}${response.length > 200 ? "..." : ""}"`);
  console.log(`[Brain] UI commands queued: ${ctx.uiCommands.length}`);

  return { response, uiCommands: ctx.uiCommands };
}
