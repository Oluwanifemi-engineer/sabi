import { NextResponse } from "next/server";
import { clientFromEnv, extractJson, type LlmMessage } from "@/lib/llm";
import { ANALYZE_SYSTEM_PROMPT, languageName } from "@/lib/prompts";
import { mockExplain } from "@/lib/mock";
import { rateLimitOrResponse } from "@/lib/rate-limit";
import type { Analysis, Explanation, LanguageCode, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";

interface AnalyzeBody {
  text?: string;
  language?: string;
}

function normalize(raw: unknown): { analysis: Analysis; explanation: Explanation; questions: QuizQuestion[] } {
  const obj = raw as { analysis?: Analysis; explanation?: Explanation; questions?: QuizQuestion[] };
  if (!obj?.analysis || !obj?.explanation) throw new Error("Output missing fields");
  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  if (questions.length === 0) throw new Error("Output missing questions");
  return {
    analysis: obj.analysis,
    explanation: obj.explanation,
    questions: questions.slice(0, 3).map((q) => ({
      question: String(q.question),
      options: q.options.slice(0, 3).map(String),
      correctIndex: Math.min(Math.max(0, Number(q.correctIndex)), 2),
      why: String(q.why ?? ""),
    })),
  };
}

export async function POST(request: Request) {
  const limited = rateLimitOrResponse(request);
  if (limited) return limited;

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const lang = (body.language ?? "es") as LanguageCode;
  if (text.length < 40) {
    return NextResponse.json({ error: "Letter text is too short to analyze" }, { status: 400 });
  }

  const client = clientFromEnv();
  if (!client) {
    return NextResponse.json({ ...mockExplain(text), engine: "demo" });
  }

  try {
    const messages: LlmMessage[] = [
      { role: "system", content: ANALYZE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Parent's preferred language: ${languageName(lang)} (${lang}).\n\nSCHOOL LETTER:\n"""\n${text.slice(0, 6000)}\n"""`,
      },
    ];
    const raw = await client.complete(messages, { temperature: 0.2 });
    return NextResponse.json({ ...normalize(extractJson(raw)), engine: "llm" });
  } catch (error) {
    // Graceful degradation: a failed live call falls back to the demo engine so
    // the flow never dead-ends mid-demo.
    return NextResponse.json({
      ...mockExplain(text),
      engine: "demo-fallback",
      note: error instanceof Error ? error.message : "unknown error",
    });
  }
}
