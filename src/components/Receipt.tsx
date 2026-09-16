"use client";

import type { Acknowledgment, Explanation, LanguageCode } from "@/lib/types";
import { LANGUAGES } from "@/lib/types";

interface ReceiptInput {
  sourceName: string;
  letterType: string;
  explanation: Explanation;
  acknowledgment: Acknowledgment;
}

const TYPE_LABELS: Record<string, string> = {
  consent: "Consent form",
  iep: "IEP / meeting notice",
  discipline: "Discipline notice",
  meeting: "Meeting notice",
  generic: "School letter",
};

/** Confirmation text in the parent's language — generated from data, no LLM needed. */
const CONFIRM: Record<LanguageCode, (school: string, date: string) => string> = {
  es: (s, d) => `Este recibo confirma que ${s} le explicó esta carta en español el ${d}. Usted confirmó su comprensión completando una verificación de comprensión antes de firmar.`,
  fr: (s, d) => `Ce reçu confirme que ${s} vous a expliqué cette lettre en français le ${d}. Vous avez confirmé votre compréhension en réussissant une vérification de compréhension avant de signer.`,
  pt: (s, d) => `Este recibo confirma que ${s} explicou esta carta em português no dia ${d}. Você confirmou seu entendimento completando uma verificação de compreensão antes de assinar.`,
  ar: (s, d) => `هذا الإيصال يؤكد أن ${s} شرح لك هذه الرسالة بالعربية في ${d}. لقد أكدت فهمك بإتمام فحص الفهم قبل التوقيع.`,
  en: (s, d) => `This receipt confirms that ${s} explained this letter to you in English on ${d}. You confirmed your understanding by passing a comprehension check before signing.`,
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Opens a print window with the acknowledgment receipt.
 *
 * Design: The confirmation note at the top is in the PARENT's language
 * (so they can verify what they agreed to). The rest of the document
 * is in English (so the school can read it). This is the bilingual
 * receipt that closes the "receipt is only in English" attack vector.
 */
export function openReceipt(input: ReceiptInput): void {
  const lang = LANGUAGES.find((l) => l.code === input.acknowledgment.language);
  const when = new Date(input.acknowledgment.signedAt);
  const a = input.acknowledgment;
  const dateStr = when.toLocaleDateString(lang?.tts ?? "en-US", { year: "numeric", month: "long", day: "numeric" });
  const confirmFn = CONFIRM[input.acknowledgment.language] ?? CONFIRM.en;
  const confirmText = confirmFn(input.sourceName, dateStr);

  const row = (label: string, value: string) =>
    `<tr><td class="lbl">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sabi Acknowledgment - ${escapeHtml(input.sourceName)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #26211b; max-width: 720px; margin: 40px auto; padding: 0 24px; font-size: 15px; line-height: 1.6; }
  .brand { display: flex; align-items: baseline; gap: 10px; border-bottom: 3px solid #0d7a6f; padding-bottom: 12px; margin-bottom: 24px; }
  .brand h1 { font-size: 26px; margin: 0; color: #0d7a6f; }
  .brand span { color: #6b6257; font-size: 13px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6257; margin: 28px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #eee5d8; }
  td.lbl { font-weight: bold; width: 200px; color: #4a4237; }
  .summary { background: #faf6f0; border-left: 4px solid #0d7a6f; padding: 12px 16px; border-radius: 0 8px 8px 0; }
  .confirm { background: #e8f5f3; border-left: 4px solid #0d7a6f; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-style: italic; }
  .sig { margin-top: 24px; text-align: center; }
  .sig img { max-width: 300px; border-bottom: 2px solid #26211b; padding-bottom: 4px; }
  .note { font-size: 12px; color: #6b6257; margin-top: 32px; border-top: 1px solid #eee5d8; padding-top: 12px; }
  .badge { display: inline-block; background: ${a.quizPassed ? "#0d7a6f" : "#e8a13a"}; color: white; border-radius: 999px; padding: 2px 12px; font-size: 12px; font-weight: bold; }
  .save-hint { background: #fff8e1; border: 1px dashed #e8a13a; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #6b6257; }
</style></head>
<body>
  <div class="brand"><h1>Sabi</h1><span>Understand before you sign · Informed consent acknowledgment</span></div>

  <div class="save-hint">
    💾 <strong>To save:</strong> Press <strong>Ctrl+P</strong> (or Cmd+P on Mac) → choose <strong>"Save as PDF"</strong> → click Save.
  </div>

  <div class="confirm">
    ${escapeHtml(confirmText)}
  </div>

  <h2>Letter</h2>
  <table>
    ${row("From", input.sourceName)}
    ${row("Letter type", TYPE_LABELS[input.letterType] ?? input.letterType)}
    ${row("Explanation language", lang ? `${lang.native} (${lang.label})` : input.acknowledgment.language)}
    ${row("Explained on", when.toLocaleString())}
  </table>

  <h2>What was explained</h2>
  <div class="summary">
    <p><strong>${escapeHtml(input.explanation.headline)}</strong></p>
    <p>${escapeHtml(input.explanation.summary)}</p>
    <p><strong>What the school asks:</strong> ${escapeHtml(input.explanation.whatTheyAsk)}</p>
  </div>

  <h2>Understanding check</h2>
  <table>
    <tr><td class="lbl">Result</td><td><span class="badge">${a.quizPassed ? "PASSED" : "ASSISTED"}</span></td></tr>
    <tr><td class="lbl">Attempts used</td><td>${String(a.quizAttempts)}</td></tr>
  </table>

  <h2>Reply sent to school</h2>
  <div class="summary"><p>${escapeHtml(a.replyText)}</p></div>

  <h2>Signature</h2>
  <div class="sig">
    <img src="${a.signatureDataUrl}" alt="Parent signature" />
    <p>Signed electronically on ${when.toLocaleString()}</p>
  </div>

  <p class="note">Generated by Sabi (GatewayHacks 2026). This document records that the letter was explained in the parent's preferred language and comprehension was verified before signing. It is a communication aid, not legal advice.</p>

  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
