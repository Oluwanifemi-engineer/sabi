export interface LlmMessage {
  role: "system" | "user";
  content: string;
}

export interface LlmClient {
  complete(messages: LlmMessage[], options?: { temperature?: number }): Promise<string>;
}

interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Minimal client for any OpenAI-compatible chat completions endpoint
 * (OpenAI, Azure OpenAI, OpenRouter, Groq, Together, local servers, ...).
 * Keeping it dependency-free means the repo builds anywhere, and we can swap
 * providers for the demo without code changes - just env vars.
 */
export function createOpenAiCompatibleClient(options: OpenAiCompatibleOptions): LlmClient {
  return {
    async complete(messages, opts) {
      const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: opts?.temperature ?? 0.2,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 200)}`);
      }
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM returned no content");
      return content;
    },
  };
}

/** Picks a client from env; returns null when no key is configured (mock mode). */
export function clientFromEnv(): LlmClient | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  return createOpenAiCompatibleClient({ baseUrl, apiKey, model });
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const sliced = candidate.slice(start);
  try {
    return JSON.parse(sliced);
  } catch {
    const lastBrace = Math.max(sliced.lastIndexOf("}"), sliced.lastIndexOf("]"));
    if (lastBrace > 0) {
      return JSON.parse(sliced.slice(0, lastBrace + 1));
    }
    throw new Error("Model output was not valid JSON");
  }
}
