import { connectMongo } from "@/app/lib/mongoose/mongoose";
import { ChatCerebras } from "@langchain/cerebras";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createBrainTools, type BrainContext } from "./tools";

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

const SYSTEM_PROMPT =
  "You are a helpful. ALWAYS CALL TOOLS" 

/**
 * Invokes the brain agent with a user message.
 * Creates fresh tools per request to close over the session context (threadId, assistantId).
 * The LLM instance is cached and reused.
 */
export async function invokeBrain(
  message: string,
  ctx: BrainContext,
): Promise<string> {
  await connectMongo();
  const model = getModel();
  const tools = createBrainTools(ctx);

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: SYSTEM_PROMPT,
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
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg._getType() === "ai" &&
      typeof msg.content === "string" &&
      msg.content.length > 0
    ) {
      return msg.content;
    }
  }

  return "I wasn't able to process that right now.";
}
