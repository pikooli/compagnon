import { connectMongo } from "@/app/lib/mongoose/mongoose";
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

function getSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `You are a helpful assistant. ALWAYS CALL TOOLS.
Today's date is ${today}.
When the user references calendar events (e.g. "my 2pm meeting"), match them to the exact event title from the displayed events context. Use that exact title when calling update_calendar_event or delete_calendar_event.
When the user asks about a specific event's details (e.g. "tell me about my 3pm meeting", "what's in that meeting"), use focus_calendar_event with the event's ID from the displayed events context. When they want to go back to the list (e.g. "go back to my schedule", "show all events"), use unfocus_calendar_event.
When the user asks to see their emails, use get_emails. When they ask about a specific email (e.g. "read that email from John", "what does the project email say"), use focus_email with the email ID from the displayed emails context. When they want to go back to the email list (e.g. "go back to my emails", "show all emails"), use unfocus_email. When they want to delete or trash an email, use trash_email with the email ID from the displayed emails context.`;
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

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: getSystemPrompt(),
  });

  console.log(`[Brain] Invoking with message: "${message.slice(0, 100)}"`);
  const startTime = Date.now();

  const result = await agent.invoke({
    messages: [{ role: "user", content: message }],
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Brain] Completed in ${elapsed}ms`);

  // Extract the last AI message content
  const messages = result.messages;
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

  return { response, uiCommands: ctx.uiCommands };
}
