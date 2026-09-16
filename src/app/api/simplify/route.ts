import { NextResponse } from "next/server";
import { clientFromEnv, extractJson, type LlmMessage } from "@/lib/llm";
import { SIMPLIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { mockSimplify } from "@/lib/mock";
import { rateLimitOrResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface SimplifyBody {
  letterType?: string;
  failedQuestions?: string[];
  language?: string;
}

export async function POST(request: Request) {
  const limited = rateLimitOrResponse(request);
  if (limited) return limited;

  let body: SimplifyBody;
  try {
    body = (await request.json()) as SimplifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const failed = (body.failedQuestions ?? []).slice(0, 3);
  const client = clientFromEnv();
  if (!client) {
    return NextResponse.json({ simpler: mockSimplify(body.letterType ?? "generic", failed), engine: "demo" });
  }

  try {
    const messages: LlmMessage[] = [
      { role: "system", content: SIMPLIFY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Letter type: ${body.letterType ?? "generic"}\nParent's language: ${body.language ?? "es"}\nQuestions answered wrong:\n${failed.map((q, i) => `${i + 1}. ${q}`).join("\n") || "(none provided)"}`,
      },
    ];
    const raw = await client.complete(messages, { temperature: 0.3 });
    const obj = extractJson(raw) as { simpler?: unknown };
    if (!obj?.simpler) throw new Error("Missing simpler payload");
    return NextResponse.json({ simpler: obj.simpler, engine: "llm" });
  } catch {
    return NextResponse.json({ simpler: mockSimplify(body.letterType ?? "generic", failed), engine: "demo-fallback" });
  }
}
