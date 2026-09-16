import { NextResponse } from "next/server";
import { SAMPLE_LETTERS } from "@/lib/samples";
import { clientFromEnv, type LlmMessage } from "@/lib/llm";

export const runtime = "nodejs";

const OCR_SYSTEM = `You are a school-letter OCR assistant. You receive a photo of a school letter. Extract the FULL text of the letter as accurately as possible — preserve all names, dates, and formatting. Return ONLY the extracted text, nothing else. No commentary, no markdown, no quotes.`;

interface OcrBody {
  image?: string; // base64 data URL
}

/**
 * POST /api/ocr — extract text from a photographed school letter.
 *
 * Demo mode (no LLM_API_KEY): returns a realistic sample letter so the
 * full camera → OCR → explain flow is demoable without any external key.
 *
 * Live mode: sends the image to a vision-capable model (gpt-4o, gemini-1.5,
 * claude-3.5, etc.) via the same OpenAI-compatible client the rest of the
 * app uses. Set LLM_VISION_MODEL in .env.local if your provider needs a
 * different model for images (defaults to LLM_MODEL or gpt-4o-mini).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OcrBody;
    if (!body.image) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    const client = clientFromEnv();

    // ── Demo mode: return a sample letter as "extracted" text ──────────
    if (!client) {
      const sample = SAMPLE_LETTERS[Math.floor(Math.random() * SAMPLE_LETTERS.length)];
      // Simulate a brief OCR delay so the UI loading state is visible
      await new Promise((r) => setTimeout(r, 1200));
      return NextResponse.json({ text: sample.text });
    }

    // ── Live mode: send image to a vision-capable LLM ─────────────────
    const messages: LlmMessage[] = [
      { role: "system", content: OCR_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the full text from this school letter:" },
          { type: "image_url", image_url: { url: body.image } },
        ] as unknown as string, // LlmMessage.content is string but OpenAI API accepts array
      },
    ];

    // Build the request manually since our minimal client only sends strings.
    // We reuse the same env vars and endpoint — just with the multimodal payload.
    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.LLM_VISION_MODEL ?? process.env.LLM_MODEL ?? "gpt-4o-mini";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: OCR_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the full text from this school letter:" },
              { type: "image_url", image_url: { url: body.image } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Vision API failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Vision model returned no text.");

    return NextResponse.json({ text: text.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OCR failed." },
      { status: 500 }
    );
  }
}
