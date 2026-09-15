// Thin fetch client for Groq. No SDK wrappers — one function, one endpoint.
// Model choices are set at the call site so temperature and response_format
// stay visible in the pipeline that uses them.

import { requireEnv } from "./env";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  stop?: string[];
}

export interface GroqChoice {
  index: number;
  message: GroqMessage;
  finish_reason: string;
}

export interface GroqResponse {
  id: string;
  model: string;
  choices: GroqChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function groqChat(req: GroqRequest, signal?: AbortSignal): Promise<GroqResponse> {
  const key = requireEnv("GROQ_API_KEY");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as GroqResponse;
}

// Convenience for the JSON-only path used by /api/classify.
export async function groqJson<T>(
  system: string,
  user: string,
  opts: { model?: string; temperature?: number; max_tokens?: number } = {},
  signal?: AbortSignal
): Promise<T> {
  const res = await groqChat(
    {
      model: opts.model ?? "llama-3.3-70b-versatile",
      temperature: opts.temperature ?? 0,
      max_tokens: opts.max_tokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    signal
  );
  const content = res.choices[0]?.message?.content ?? "";
  return JSON.parse(content) as T;
}
