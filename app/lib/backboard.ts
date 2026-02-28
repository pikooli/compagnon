const BASE_URL = "https://app.backboard.io/api";

// --- Response types ---

export interface BackboardAssistant {
  assistant_id: string;
  name: string;
  system_prompt: string;
}

export interface BackboardThread {
  thread_id: string;
}

export interface RetrievedMemory {
  id: string;
  memory: string;
  score: number;
}

export interface BackboardMessage {
  content: string;
  status?: string;
  retrieved_memories?: RetrievedMemory[] | null;
}

export interface BackboardMemory {
  id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

// --- Client ---

export class BackboardClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `Backboard ${method} ${path} failed (${res.status}): ${text}`,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Backboard ${method} ${path} returned non-JSON: ${text.slice(0, 200)}`,
      );
    }
  }

  async createAssistant(
    name: string,
    systemPrompt: string,
  ): Promise<BackboardAssistant> {
    return this.request<BackboardAssistant>("POST", "/assistants", {
      name,
      system_prompt: systemPrompt,
    });
  }

  async createThread(assistantId: string): Promise<BackboardThread> {
    return this.request<BackboardThread>(
      "POST",
      `/assistants/${assistantId}/threads`,
      {},
    );
  }

  async sendMessage(
    threadId: string,
    content: string,
    options?: {
      memory?: "Auto" | "On" | "Off" | "Readonly";
      llm_provider?: string;
      model_name?: string;
    },
  ): Promise<BackboardMessage> {
    return this.request<BackboardMessage>(
      "POST",
      `/threads/${threadId}/messages`,
      {
        content,
        stream: false,
        memory: options?.memory ?? "Auto",
        ...(options?.llm_provider && { llm_provider: options.llm_provider }),
        ...(options?.model_name && { model_name: options.model_name }),
      },
    );
  }

  async listMemories(assistantId: string): Promise<BackboardMemory[]> {
    return this.request<BackboardMemory[]>(
      "GET",
      `/assistants/${assistantId}/memories`,
    );
  }
}
