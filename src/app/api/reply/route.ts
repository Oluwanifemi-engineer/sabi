import { NextResponse } from "next/server";
import { clientFromEnv } from "@/lib/llm";
import { REPLY_SYSTEM_PROMPT, languageName } from "@/lib/prompts";
import type { LlmMessage } from "@/lib/llm";
import type { LanguageCode } from "@/lib/types";

export const runtime = "nodejs";

interface ReplyBody {
  letterType?: string;
  headline?: string;
  signed?: boolean;
  questions?: string[];
  language?: LanguageCode;
}

const DEMO_REPLY_SIGNED = `Hello, thank you for the letter about my child. I have read it, talked about it together, and I understand what you are asking. I am signing the form and sending it back with my child. Please send me all future letters and reports in my language, and call me if you need anything.`;

const DEMO_REPLY_UNSIGNED = `Hello, thank you for the letter about my child. I received it and I understand what you are asking. I have some questions first, written below, before I decide. Please answer me or call with an interpreter. I would also like all future letters in my language.`;

export async function POST(request: Request) {
  let body: ReplyBody;
  try {
    body = (await request.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = clientFromEnv();
  if (!client) {
    return NextResponse.json({ reply: body.signed ? DEMO_REPLY_SIGNED : DEMO_REPLY_UNSIGNED, engine: "demo" });
  }

  try {
    const messages: LlmMessage[] = [
      { role: "system", content: REPLY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Letter type: ${body.letterType ?? "generic"}\nSummary: ${body.headline ?? ""}\nParent signed: ${body.signed ? "yes" : "not yet"}\nParent's language: ${languageName(body.language ?? "es")}\nQuestions the parent wants to ask: ${(body.questions ?? []).join(" | ") || "none"}`,
      },
    ];
    const reply = await client.complete(messages, { temperature: 0.4 });
    return NextResponse.json({ reply: reply.trim(), engine: "llm" });
  } catch {
    return NextResponse.json({ reply: body.signed ? DEMO_REPLY_SIGNED : DEMO_REPLY_UNSIGNED, engine: "demo-fallback" });
  }
}
