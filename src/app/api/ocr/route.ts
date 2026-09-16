import { NextResponse } from "next/server";
import { SAMPLE_LETTERS } from "@/lib/samples";
import { rateLimitOrResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const OCR_SYSTEM = `You are a school-letter OCR assistant. You receive a photo of a school letter. Extract the FULL text of the letter as accurately as possible — preserve all names, dates, and formatting. Return ONLY the extracted text, nothing else. No commentary, no markdown, no quotes.`;

interface OcrBody {
  image?: string; // base64 data URL
}

/**
 * POST /api/ocr — extract text from a photographed school letter.
 *
 * Live OCR requires LLM_VISION_MODEL to be set explicitly. That is deliberate:
 * a text-only model cannot read a photo, and defaulting to some vendor's vision
 * model name would fail on every single request against a provider that does
 * not host it. With no vision model configured we fall back to a realistic
 * sample extraction so the camera → explain flow stays demoable.
 *
 * Failures return 502 with a message a parent can act on, never a raw error.
 */
export async function POST(request: Request) {
  const limited = rateLimitOrResponse(request);
  if (limited) return limited;

  let body: OcrBody;
  try {
    body = (await request.json()) as OcrBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  const apiKey = process.env.LLM_API_KEY;
  const visionModel = process.env.LLM_VISION_MODEL;

  // ── Demo extraction: no key, or the provider has no vision model ──────
  if (!apiKey || !visionModel) {
    const sample = SAMPLE_LETTERS[Math.floor(Math.random() * SAMPLE_LETTERS.length)];
    // Brief delay so the UI loading state is visible.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return NextResponse.json({ text: sample.text, engine: "demo" });
  }

  // ── Live vision ──────────────────────────────────────────────────────
  // The minimal client in lib/llm.ts only sends string content, so the
  // multimodal payload is built by hand here — same env vars, same endpoint.
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
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
      console.error(`Vision OCR failed (${response.status}): ${detail.slice(0, 200)}`);
      return NextResponse.json(
        {
          error:
            "We could not read that photo. Please try again with better light and the whole page in frame, or type the letter instead.",
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "We could not read any text in that photo. Please type the letter instead." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: text.trim(), engine: "vision" });
  } catch (error) {
    console.error("Vision OCR request failed:", error);
    return NextResponse.json(
      {
        error:
          "We could not read that photo. Please try again with better light and the whole page in frame, or type the letter instead.",
      },
      { status: 502 }
    );
  }
}
