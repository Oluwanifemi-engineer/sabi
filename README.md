# Sabi — Understand before you sign

**GatewayHacks 2026 | Cause Pillars: Accessibility & Health · Equity in Education**

Every year, millions of parents with limited English sign school documents they cannot read — consent forms for special-education evaluations, IEP meeting notices, discipline letters. District platforms (ParentSquare, TalkingPoints, ReachWell) translate the *words*, but nothing verifies the parent *understood what they are agreeing to*.

**Sabi closes the loop: explain → check understanding → sign with proof.**

> *Sabi* means **to understand** — because a signature should mean that you did.

---

## The problem, with receipts

- **5.3 million** US students are English learners — **10.6%** of public K–12 enrollment, up from 3.8M in 2000 (NCES Condition of Education). Spanish is the home language for 76% of them; the rest span 400+ languages.
- Among Spanish-speaking parents who **tried** to participate in their child's schooling, **69%** said a language barrier made it difficult (NCES 2024-132). They weren't disengaged — they were blocked.
- **59% of elementary** and **69% of secondary** schools reported difficulty filling ESL/bilingual positions for 2024–25 (NCES School Pulse Panel). The people who would translate consent forms are the people districts cannot hire.

The everyday workaround is the one the US Departments of Education and Justice explicitly warned against: relying on **students, siblings, friends, or untrained staff** as interpreters.

### A 13-year federal enforcement record

OCR keeps resolving the *same* complaint against districts of every size, and the diagnosis is nearly identical each time — **no documented process to identify which parents need language assistance, so the district defaults to English.**

| District | Docket | Year | What OCR required |
|---|---|---|---|
| Dearborn Public Schools (MI) | 15-10-5001 | 2012 | Build "a process for notifying LEP parents, in a language that the parents will understand, of the availability of free language assistance" |
| Mt. Diablo Unified (CA) | 09-09-5001 | 2013 | Parents must "receive accurate, **comprehensible**, and consistent information" |
| Tulsa Public Schools (OK) | 07105002 | — | Annually inform staff that **minor children may never be used as interpreters** |
| Douglas County RE-1 (CO) | 08-23-1217 | 2023 | "Continued communications with the Complainant in English, **without notice or inquiry into the need for language assistance**, raised further compliance concerns" |
| NYC Dept. of Education | — | 2019 | Translation/interpreter access for parents of students with disabilities — complaints filed **seven years earlier** |

Eleven years after Dearborn, Douglas County was resolving a complaint over the same root cause. The missing piece the government keeps naming is **not a translation gap — it is a comprehension-and-process gap.**

*The 2015 joint guidance package was rescinded in August 2025. The obligations remain: Title VI of the Civil Rights Act and the Equal Educational Opportunities Act are still federal law, and OCR enforced against exactly these failures for a decade under them.*

---

## What it does

1. **Explain** — Paste the letter, or **photograph it**. Sabi classifies it (consent / IEP / discipline / meeting), then explains it in the parent's language: what the school is asking, what happens if you sign, what happens if you wait, your rights, and the deadline. Text **plus read-aloud voice** — because reading is the barrier.
2. **Check** — Three comprehension questions generated from that letter's own facts. Miss one and Sabi re-explains at a **simpler tier** — calmer headline, shorter sentences, a clarification of the exact thing missed — then lets the parent retry. The loop that makes consent *informed*, not assumed.
3. **Sign** — An e-signature produces a timestamped, printable **bilingual receipt**: what was explained, in which language, the comprehension-check result, the deadline, and the signature — plus a polite English reply drafted for the school.

## Why it is different

- **Parent-side, not district-side.** Works on the letter the parent actually received, today, with no school adoption or SIS integration required.
- **Comprehension-verified consent.** Others translate; Sabi proves understanding *before* the signature.
- **The re-explanation loop.** Fail → auto-simplify → re-explain → retry. This loop is the product.
- **Fully multilingual interface.** Not just the explanation — the whole UI flips (Español · Français · Português · العربية · English) with correct **RTL** for Arabic. A parent who reads no English never sees English.
- **Voice-first.** Reading is the barrier — so the explanation speaks.
- **Privacy as a feature.** No database; letters stay on the device, with one-tap JSON export.

---

## Tech

- **Next.js (App Router) + TypeScript + Tailwind** — one-wizard flow, mobile-first, 18px base type, high-contrast warm palette, ARIA-labelled quiz radiogroups
- **LLM pipeline** — provider-agnostic OpenAI-compatible client (`LLM_API_KEY`), strict-JSON prompts, graceful fallback. **One model call per letter**: classify + explain + quiz generation in a single response, halving latency and cost
- **Vision OCR** — photograph a paper letter; the image goes to a vision model and the text flows into the same pipeline
- **Simplification endpoint** (`/api/simplify`) — the adaptive re-explanation tier, driven by which questions were missed
- **Demo engine** — runs the full flow with zero configuration, so judging never dead-ends
- **Web Speech API** — read-aloud (TTS) and voice input (STT), no cloud dependency
- **Bilingual receipts** — print-to-PDF acknowledgment with signature image and comprehension result
- No database: the family folder persists in `localStorage`, exportable as JSON

---

## Live demo

**https://sabi-teal.vercel.app** — no setup, no key. Tap a sample letter and walk the full loop.

## Run it locally

```bash
npm install
npm run dev
```

Open **http://localhost:4317** — the demo engine works immediately, no key needed. To use the live AI engine:

```bash
cp .env.example .env.local   # set LLM_API_KEY (any OpenAI-compatible provider)
```

Optional: `LLM_VISION_MODEL` if your provider needs a different model name for photo OCR.

---

## Judging criteria mapping

| Criterion (weight) | Where Sabi scores |
| --- | --- |
| Social Impact (40%) | 5.3M families; a 13-year OCR enforcement record naming exactly this gap; the receipt creates accountability that did not exist before |
| Technical Execution (30%) | Working end-to-end: photo OCR → classification → multilingual explanation + TTS → adaptive comprehension loop → e-signature → bilingual receipt → export |
| Innovation (20%) | First parent-side comprehension-verified consent loop; no incumbent owns "proof of understanding" |
| Design & UX (10%) | Voice-first, full UI i18n with RTL, 18px type, plain language, ARIA, warm high-contrast design for stressed parents |

---

## Docs

- [`docs/devpost.md`](docs/devpost.md) — submission copy
- [`docs/demo-script.md`](docs/demo-script.md) — timed video script
- [`docs/qa-checklist.md`](docs/qa-checklist.md) — end-to-end QA pass

Built for GatewayHacks 2026.
