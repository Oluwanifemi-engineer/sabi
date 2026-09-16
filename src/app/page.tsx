"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import SignaturePad from "@/components/SignaturePad";
import { openReceipt } from "@/components/Receipt";
import {
  folderSnapshot,
  newId,
  saveLetter,
  serverFolderSnapshot,
  subscribeFolder,
} from "@/lib/store";
import { speak, stopSpeaking } from "@/lib/speech";
import PhotoIntake from "@/components/PhotoIntake";
import { UI } from "@/lib/ui-strings";
import {
  LANGUAGES,
  type Acknowledgment,
  type Analysis,
  type Explanation,
  type LanguageCode,
  type LetterRecord,
  type QuizQuestion,
  type QuizResult,
} from "@/lib/types";
import { SAMPLE_LETTERS } from "@/lib/samples";

type Step = 0 | 1 | 2 | 3 | 4;

interface AnalyzeResponse {
  analysis: Analysis;
  explanation: Explanation;
  questions: QuizQuestion[];
  engine: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>(0);
  // Family folder lives in localStorage (an external store), so it is read
  // through useSyncExternalStore rather than mirrored into component state.
  const folder = useSyncExternalStore(subscribeFolder, folderSnapshot, serverFolderSnapshot);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Intake
  const [letterText, setLetterText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("es");
  const [photoMode, setPhotoMode] = useState(false);

  // Pipeline results
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Quiz
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Signature + reply
  const [signature, setSignature] = useState<string | null>(null);
  const [reply, setReply] = useState<string>("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [simpler, setSimpler] = useState<{ headline: string; bullets: string[]; aboutWrong: string[] } | null>(null);
  const [simplifyLoading, setSimplifyLoading] = useState(false);
  const [finalAck, setFinalAck] = useState<Acknowledgment | null>(null);

  const engineBadge = useMemo(() => {
    if (!result) return null;
    if (result.engine === "llm") return null;
    return true;
  }, [result]);

  function readAloud(text: string) {
    const meta = LANGUAGES.find((l) => l.code === language);
    stopSpeaking();
    speak(text, meta?.tts ?? "en-US", () => setSpeaking(false));
    setSpeaking(true);
  }

  async function analyze() {
    const t = UI[language];
    if (letterText.trim().length < 40) {
      setError(t.errPaste);
      return;
    }
    setLoading(true);
    setLoadStage(0);
    setError(null);
    const timers = [setTimeout(() => setLoadStage(1), 900), setTimeout(() => setLoadStage(2), 2000)];
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: letterText, language }),
      });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? t.errGeneric);
      setResult(data);
      setAnswers([null, null, null]);
      setQuizResult(null);
      setRevealed(false);
      setSimpler(null);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : UI[language].errGeneric);
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  }

  function gradeQuiz() {
    if (!result) return;
    const wrong: number[] = [];
    result.questions.forEach((q, i) => {
      if (answers[i] !== q.correctIndex) wrong.push(i);
    });
    const passed = wrong.length === 0;
    const resultData: QuizResult = { passed, attempts: (quizResult?.attempts ?? 0) + 1, wrong };
    setQuizResult(resultData);
    setRevealed(true);
    if (passed) {
      setTimeout(() => setStep(3), 1400);
    }
  }

  /** Entering the quiz always starts a fresh attempt — fixes the stuck-after-fail bug. */
  function enterQuiz() {
    setAnswers([null, null, null]);
    setQuizResult(null);
    setRevealed(false);
    setStep(2);
  }

  async function retryQuiz() {
    // Capture wrong indices before clearing so the simplify call still works.
    const wrongIndices = quizResult?.wrong ?? [];
    setAnswers([null, null, null]);
    setQuizResult(null);
    setRevealed(false);
    // Fetch the simplified re-explanation once, based on what was missed.
    if (!simpler && result) {
      setSimplifyLoading(true);
      try {
        const failedTexts = wrongIndices
          .map((i) => result.questions[i]?.question)
          .filter((q): q is string => Boolean(q));
        const res = await fetch("/api/simplify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          letterType: result.analysis.type,
          letterText,
          keyFacts: result.analysis.keyFacts,
          failedQuestions: failedTexts,
          language,
        }),
        });
        const data = (await res.json()) as { simpler?: { headline: string; bullets: string[]; aboutWrong: string[] } };
        setSimpler(data.simpler ?? null);
      } catch {
        setSimpler(null);
      } finally {
        setSimplifyLoading(false);
      }
    }
  }

  async function generateReply(signed: boolean) {
    setReplyLoading(true);
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterType: result?.analysis.type,
          headline: result?.explanation.headline,
          signed,
          questions: signed ? [] : result?.explanation.questionsToAsk ?? [],
          language,
        }),
      });
      const data = (await res.json()) as { reply?: string };
      setReply(data.reply ?? "");
    } finally {
      setReplyLoading(false);
    }
  }

  function finish() {
    if (!signature || !result) return;
    const record: LetterRecord = {
      id: currentId ?? newId(),
      createdAt: Date.now(),
      sourceName: sourceName || "School",
      parentLanguage: language,
      rawText: letterText,
      status: "signed",
      analysis: result.analysis,
      explanation: result.explanation,
      quiz: result.questions,
      quizResult: quizResult ?? undefined,
      acknowledgment: {
        signedAt: Date.now(),
        signatureDataUrl: signature,
        language,
        quizPassed: quizResult?.passed ?? false,
        quizAttempts: quizResult?.attempts ?? 1,
        replyText: reply,
      },
    };
    setFinalAck(record.acknowledgment ?? null);
    saveLetter(record);
    setStep(4);
  }

  function openExisting(record: LetterRecord) {
    setCurrentId(record.id);
    setLetterText(record.rawText);
    setSourceName(record.sourceName);
    setLanguage(record.parentLanguage);
    if (record.status === "signed" && record.explanation) {
      setResult({
        analysis: record.analysis ?? { type: "generic", urgency: "fyi", actions: [], keyFacts: [], risksOfSigning: [], rights: [] },
        explanation: record.explanation,
        questions: record.quiz ?? [],
        engine: "demo",
      });
      setQuizResult(record.quizResult ?? null);
      setReply(record.acknowledgment?.replyText ?? "");
      setSignature(record.acknowledgment?.signatureDataUrl ?? null);
      setFinalAck(record.acknowledgment ?? null);
      setSimpler(null);
      setStep(4);
    } else {
      setStep(0);
    }
  }

  function reset() {
    setStep(0);
    setLetterText("");
    setSourceName("");
    setResult(null);
    setQuizResult(null);
    setAnswers([null, null, null]);
    setSignature(null);
    setReply("");
    setFinalAck(null);
    setCurrentId(null);
    setSimpler(null);
    setSpeaking(false);
    stopSpeaking();
  }

  const langMeta = LANGUAGES.find((l) => l.code === language);
  const t = UI[language];
  const rtl = langMeta?.rtl ? "rtl" : "ltr";

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24">
      {/* Header */}
      <header className="pt-10 pb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold" style={{ color: "var(--teal-deep)" }}>
            Sabi
          </h1>
          <p className="mt-1 text-lg opacity-70">{t.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold opacity-60">{t.folder}</p>
          <p className="text-3xl font-extrabold" style={{ color: "var(--teal)" }}>
            {folder.length}
          </p>
        </div>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6" aria-hidden>
        {t.steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`step-dot ${i === step ? "active" : i < step ? "done" : ""}`}>{i < step ? "✓" : i + 1}</div>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-bold" : "opacity-50"}`}>{label}</span>
            {i < t.steps.length - 1 && <div className="h-0.5 flex-1" style={{ background: "var(--line)" }} />}
          </div>
        ))}
      </div>

      {/* STEP 0: INTAKE */}
      {step === 0 && (
        <section className="card p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold">{t.intakeTitle}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sample letters">
            {SAMPLE_LETTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn-ghost text-sm"
                aria-label={`Load sample: ${s.label}`}
                onClick={() => {
                  setLetterText(s.text);
                  setSourceName(s.sourceName);
                  setPhotoMode(false);
                  setError(null);
                }}
              >
                📄 {s.label}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost text-sm"
              aria-pressed={photoMode}
              style={photoMode ? { borderColor: "var(--teal)", background: "color-mix(in srgb, var(--teal) 12%, white)" } : undefined}
              onClick={() => { setPhotoMode((v) => !v); setError(null); }}
            >
              📷 {photoMode ? "Paste instead" : "Take a photo"}
            </button>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" htmlFor="source">
              {t.schoolName}
            </label>
            <input
              id="source"
              className="w-full rounded-xl border p-3"
              style={{ borderColor: "var(--line)" }}
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t.schoolNamePh}
            />
          </div>
          {photoMode ? (
            <PhotoIntake
              onExtracted={(text) => {
                setLetterText(text);
                setPhotoMode(false);
                setError(null);
              }}
            />
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1" htmlFor="letter">
                {t.pasteLabel}
              </label>
              <textarea
                id="letter"
                className="w-full rounded-xl border p-3 min-h-44"
                style={{ borderColor: "var(--line)" }}
                dir={rtl}
                value={letterText}
                onChange={(e) => setLetterText(e.target.value)}
                placeholder={t.pastePh}
              />
            </div>
          )}
          <div>
            <p className="block text-sm font-semibold mb-1">{t.wantLang}</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className="btn-ghost text-sm"
                  style={language === l.code ? { borderColor: "var(--teal)", background: "color-mix(in srgb, var(--teal) 12%, white)" } : undefined}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm font-semibold" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
          <button type="button" className="btn-primary w-full" onClick={analyze} disabled={loading}>
            {loading ? (loadStage === 0 ? t.stage1 : loadStage === 1 ? t.stage2 : t.stage3) : t.explainBtn}
          </button>
        </section>
      )}

      {/* STEP 1: EXPLANATION */}
      {step === 1 && result && (
        <section className="space-y-4">
          <div className="card p-6 fade-in" dir={rtl}>
            <div className="flex items-center justify-between mb-3">
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "var(--teal)" }}>
                {result.analysis.type.toUpperCase()}
              </span>
              {engineBadge && <span className="text-xs opacity-50">{t.demoEngine}</span>}
            </div>

            {result.analysis.urgency !== "fyi" && (
              <div
                className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-semibold"
                style={{ background: "color-mix(in srgb, var(--coral) 12%, white)", color: "var(--coral)" }}
              >
                ⏰ {result.analysis.urgency === "action-required" ? t.urgencyAction : t.urgencyResponse}
                {result.analysis.deadline ? ` — ${t.by} ${result.analysis.deadline}` : ""}
              </div>
            )}

            <h2 className="font-display text-2xl font-bold mb-2">{result.explanation.headline}</h2>
            <p className="text-lg">{result.explanation.summary}</p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--amber) 14%, white)" }}>
                <p className="font-bold text-sm">{t.askWhat}</p>
                <p>{result.explanation.whatTheyAsk}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--teal) 10%, white)" }}>
                  <p className="font-bold text-sm">{t.ifSign}</p>
                  <p>{result.explanation.ifYouSign}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--coral) 10%, white)" }}>
                  <p className="font-bold text-sm">{t.ifWait}</p>
                  <p>{result.explanation.ifYouDontSign}</p>
                </div>
              </div>
              {result.analysis.keyFacts.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--amber) 10%, white)" }}>
                  <p className="font-bold text-sm mb-1">{t.keyFacts}</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.analysis.keyFacts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.analysis.risksOfSigning.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--coral) 8%, white)" }}>
                  <p className="font-bold text-sm mb-1">{t.risks}</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.analysis.risksOfSigning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.analysis.rights.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--teal) 8%, white)" }}>
                  <p className="font-bold text-sm mb-1">{t.rights}</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.analysis.rights.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() =>
                  readAloud(
                    `${result.explanation.headline}. ${result.explanation.summary} ${result.explanation.whatTheyAsk} ${result.explanation.ifYouSign} ${result.explanation.ifYouDontSign}`
                  )
                }
              >
                {t.readAloud}
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={() => { stopSpeaking(); setSpeaking(false); }}>
                {t.stop}
              </button>
              {speaking && (
                <span className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: "var(--coral)" }}>
                  <span className="speaking-dot" /> {t.speaking}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="btn-primary w-full" onClick={enterQuiz}>
            {t.toQuiz}
          </button>
        </section>
      )}

      {/* STEP 2: QUIZ */}
      {step === 2 && result && (
        <section className="space-y-4">
          <div className="card p-6" dir={rtl}>
            <h2 className="font-display text-2xl font-bold mb-1">{t.quizTitle}</h2>
            <p className="opacity-60 mb-4">{t.quizSub}</p>
            {result.questions.map((q, qi) => (
              <div key={qi} className="mb-5">
                <p className="font-bold mb-2">
                  {qi + 1}. {q.question}
                </p>
                <div className="grid gap-2" role="radiogroup" aria-label={q.question}>
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi] === oi;
                    const isCorrect = revealed && oi === q.correctIndex;
                    const isWrongChoice = revealed && chosen && oi !== q.correctIndex;
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        disabled={revealed}
                        onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                        className="text-left rounded-xl border-2 p-3 transition-colors"
                        style={{
                          borderColor: isCorrect ? "var(--teal)" : isWrongChoice ? "var(--coral)" : chosen ? "var(--teal)" : "var(--line)",
                          background: isCorrect ? "color-mix(in srgb, var(--teal) 12%, white)" : isWrongChoice ? "color-mix(in srgb, var(--coral) 10%, white)" : "white",
                        }}
                      >
                        {opt}
                        {isCorrect && <span className="ml-2">✅</span>}
                        {isWrongChoice && <span className="ml-2">❌</span>}
                      </button>
                    );
                  })}
                </div>
                {revealed && quizResult?.wrong.includes(qi) && <p className="text-sm mt-1 opacity-75">💡 {q.why}</p>}
              </div>
            ))}
          </div>
          {quizResult?.passed ? (
            <div className="card p-6 text-center" style={{ background: "color-mix(in srgb, var(--teal) 10%, white)" }}>
              <p className="text-2xl font-extrabold" style={{ color: "var(--teal-deep)" }}>
                {t.passed}
              </p>
              <p className="opacity-70">{t.toSign}</p>
            </div>
          ) : quizResult ? (
            <div className="card p-6 text-center" style={{ background: "color-mix(in srgb, var(--amber) 12%, white)" }}>
              <p className="font-bold mb-2">{t.almost.replace("{n}", String(quizResult.wrong.length))}</p>
              <div className="flex gap-2 justify-center">
                <button type="button" className="btn-primary" onClick={retryQuiz}>
                  {t.tryAgain}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setStep(1);
                    readAloud(`${result.explanation.headline}. ${result.explanation.summary}`);
                  }}
                >
                  {t.explainAgain}
                </button>
              </div>
              {(simplifyLoading || simpler) && (
                <div className="mt-4 text-left rounded-xl p-4 fade-in bg-white" dir={rtl}>
                  {simplifyLoading ? (
                    <p className="opacity-60">{t.simplerLoading}</p>
                  ) : (
                    simpler && (
                      <>
                        <p className="font-bold mb-1">{simpler.headline}</p>
                        <ul className="list-disc pl-5 space-y-0.5 mb-2">
                          {simpler.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                        {simpler.aboutWrong.map((w, i) => (
                          <p key={i} className="text-sm opacity-75">
                            {w}
                          </p>
                        ))}
                      </>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={gradeQuiz} disabled={answers.some((a) => a === null)}>
              {answers.some((a) => a === null) ? t.answerAll : t.checkAnswers}
            </button>
          )}
        </section>
      )}

      {/* STEP 3: SIGN */}
      {step === 3 && (
        <section className="space-y-4">
          <div className="card p-6 space-y-5">
            <h2 className="font-display text-2xl font-bold">{t.signTitle}</h2>
            <p className="opacity-70">{t.signSub}</p>
            <SignaturePad
              onChange={setSignature}
              labels={{ hint: t.signHint, captured: t.signatureCaptured, clear: t.clearBtn }}
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{t.replyLabel}</p>
                <button type="button" className="btn-ghost text-xs" onClick={() => generateReply(!!signature)} disabled={replyLoading}>
                  {replyLoading ? t.drafting : t.draft}
                </button>
              </div>
              <textarea
                className="w-full rounded-xl border p-3 min-h-28"
                style={{ borderColor: "var(--line)" }}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t.replyPh}
              />
            </div>
          </div>
          <button type="button" className="btn-primary w-full" onClick={finish} disabled={!signature}>
            {signature ? t.signBtn : t.signFirst}
          </button>
        </section>
      )}

      {/* STEP 4: DONE */}
      {step === 4 && result && (
        <section className="space-y-4">
          <div className="card p-8 text-center">
            <p className="text-5xl mb-3">🤝</p>
            <h2 className="font-display text-2xl font-bold" style={{ color: "var(--teal-deep)" }}>
              {t.doneTitle}
            </h2>
            <p className="opacity-70 mt-2">{t.doneSub}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!result || !finalAck) return;
                  openReceipt({
                    sourceName: sourceName || "School",
                    letterType: result.analysis.type,
                    explanation: result.explanation,
                    acknowledgment: finalAck,
                  });
                }}
              >
                {t.receipt}
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                {t.newLetter}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* FAMILY FOLDER */}
      {folder.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold">📁 {t.folder}</h3>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                const blob = new Blob([JSON.stringify(folder, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sabi-family-folder-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              💾 Export all
            </button>
          </div>
          <div className="grid gap-2">
            {folder.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => openExisting(l)}
                className="card p-4 text-left flex items-center justify-between hover:opacity-90"
              >
                <div>
                  <p className="font-bold">{l.sourceName}</p>
                  <p className="text-sm opacity-60">
                    {new Date(l.createdAt).toLocaleDateString()} · {LANGUAGES.find((x) => x.code === l.parentLanguage)?.native}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ background: l.status === "signed" ? "var(--teal)" : "var(--amber)" }}
                >
                  {l.status === "signed" ? t.signed : t.draftStatus}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-16 text-center text-sm opacity-50">
        Sabi · GatewayHacks 2026 · Explain → Check → Sign · Built for parents with limited English
      </footer>
    </main>
  );
}
