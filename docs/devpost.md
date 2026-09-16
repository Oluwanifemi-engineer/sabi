# Devpost submission copy — Sabi

*(Paste into the Devpost project page. Bracketed spots are yours to fill.)*

---

## Project title
**Sabi — Understand before you sign**

## Tagline (short pitch)
Millions of parents with limited English sign school documents they cannot read. Sabi explains the letter in their language, verifies understanding, then turns the signature into proof of *informed* consent.

---

## The problem (the 40%)

**A consent form is a legal document. For millions of families, it is also unreadable.**

- **5.3 million US students are English learners** — 10.6% of public K–12 enrollment, up from 3.8M in 2000 (NCES Condition of Education). Spanish is the home language for 76% of them; the rest span 400+ languages.
- Among Spanish-speaking parents who *tried* to participate in school life, **69% said a language barrier made it difficult** (NCES 2024-132). The denominator matters: these are parents who were already trying. The barrier is mechanical, not motivational.
- **59% of elementary and 69% of secondary schools** reported difficulty filling ESL/bilingual roles for 2024–25 (NCES School Pulse Panel). The people who would translate consent forms are the people districts cannot hire.

The everyday workaround is the one the federal government explicitly warns against. The US Departments of Education and Justice told schools not to rely on **students, siblings, friends, or untrained staff** to interpret. Families do it anyway — a ten-year-old explaining a special-education evaluation to their mother — because there was no alternative in the parent's hands.

### This is not a theory. It is a 13-year enforcement record.

Since at least 2012, the Office for Civil Rights has resolved the *same* complaint against districts of every size, and the diagnosis is nearly identical each time: **no documented process to identify which parents need language assistance, so the district defaults to English.**

| District | Docket | Year | What OCR made them do |
|---|---|---|---|
| Dearborn Public Schools (MI) | 15-10-5001 | 2012 | Build from scratch "a process for notifying LEP parents, in a language that the parents will understand, of the availability of free language assistance" |
| Mt. Diablo Unified (CA) | 09-09-5001 | 2013 | Ensure parents "receive accurate, **comprehensible**, and consistent information" |
| Tulsa Public Schools (OK) | 07105002 | — | Annually inform staff that **minor children may never be used as interpreters** |
| Douglas County RE-1 (CO) | 08-23-1217 | 2023 | Found "continued communications with the Complainant in English, **without notice or inquiry into the need for language assistance**, raised further compliance concerns" |
| NYC Dept. of Education | — | 2019 | Translation/interpreter access for parents of students with disabilities — complaints filed **seven years earlier** |

Eleven years after Dearborn, Douglas County was resolving a complaint for the same root cause. The gap the government keeps describing is **not a translation gap. It is a comprehension-and-process gap.**

*Honest note: the 2015 joint guidance package was rescinded in August 2025. The obligations did not go anywhere — Title VI of the Civil Rights Act and the Equal Educational Opportunities Act remain federal law, and OCR enforced against exactly these failures for a decade under them.*

### Why existing tools don't close it

ParentSquare, TalkingPoints, and ReachWell are **district-side translation pipes**. They move text from the district to the family in bulk. Three things none of them do:

1. **They assume translation equals comprehension.** A machine-translated form is exactly as unreadable as the original if the parent cannot read *any* language fluently, or if the register is legal.
2. **They operate on the district's terms.** They require district adoption, district configuration, district rollout. The parent holding a letter today gets nothing.
3. **They produce no evidence of understanding.** Nothing in them verifies the parent grasped what they agreed to — so a signature means "I signed," not "I understood."

**Translation is not comprehension. A signature is not consent.**

---

## The solution

Sabi is a **parent-side consent loop** — it works on the letter in the parent's hands right now, with no district adoption required.

**1. Explain.** Paste the letter, or **photograph it**. Sabi classifies it (consent / IEP / discipline / meeting) and explains it in the parent's language: what the school is asking, what happens if you sign, what happens if you wait, and your rights. **Text and read-aloud voice** — because reading is the barrier.

**2. Check.** Three comprehension questions generated from *that letter's own facts* — deadlines, consequences, what's being consented to. Miss one and Sabi drops to a simpler tier: a calmer headline, shorter sentences, and a gentle clarification for each specific question missed. The parent can retry until they pass. **Understanding is verified, not assumed.**

**3. Acknowledge.** An e-signature produces a timestamped, printable receipt: what was explained, in which language, the comprehension-check result, the deadline, and the signature. Plus a polite English reply drafted for the school.

That receipt is the artifact that did not previously exist. It is proof of *informed* consent — accountability for the family **and** the school.

---

## Why it is unique

- **The unit of design is the parent's understanding, not the translation.** Every competitor optimizes the message; Sabi optimizes the moment of agreement.
- **The re-explanation loop.** Fail → auto-simplify → re-explain → retry. A consent wall, not a consent button. *This loop is the product.*
- **Parent-side, zero-adoption.** No SIS integration, no district procurement cycle. Works today, from a phone, on paper letters.
- **Truly multilingual, top to bottom.** Not just the explanation — the **entire interface** flips (Español, Français, Português, العربية, English) with correct **RTL layout** for Arabic. A parent who reads no English never sees a single English word.
- **Bilingual receipt.** A confirmation note in the parent's language, and the record itself in English for the school — one document that serves both parties.
- **Privacy as a feature.** No database. Letters and signatures stay on the family's device, with one-tap JSON export. No breach surface, no third-party access to a child's special-education record.

---

## How we built it

- **Next.js (App Router) + TypeScript + Tailwind** — one mobile-first wizard, 18px base type, warm high-contrast palette, ARIA-labelled radiogroups for the quiz
- **Provider-agnostic LLM pipeline** — any OpenAI-compatible endpoint via env vars. **One model call per letter**: classification, explanation, and quiz generation in a single strict-JSON response, halving latency and cost versus a two-call design
- **Vision OCR** — photograph a paper letter; the image goes to a vision-capable model and the extracted text flows straight into the same pipeline
- **Simplification endpoint** (`/api/simplify`) — the adaptive re-explanation tier, driven by which questions were missed
- **Built-in demo engine** — the full flow runs with **zero configuration**, so the experience is judge-proof even if a live API fails mid-demo
- **Web Speech API** for read-aloud and voice input — on-device, no cloud dependency
- **Print-to-PDF** acknowledgment receipts; **localStorage** family folder with export

---

## Challenges we ran into

- **Writing quiz questions that test consequences, not reading.** "What is the deadline" is trivia; "What happens if you don't return this form" is the thing a parent actually needs to know. Getting the model to generate the second kind took real prompt work.
- **Keeping strict JSON across five languages.** Model output drifts — we built a normalization layer that repairs truncated or malformed responses before they reach the UI, so a bad generation degrades instead of crashing.
- **Making the offline engine contract-identical to the live one.** The fallback returns the same shape, including the simplify tier, so no code path is demo-only fiction.
- **Inverting the accessibility problem.** Legal documents are written in a register that is hard for *anyone*. Explaining them clearly is not a translation task — it is a plain-language task, and the model has to do both at once.

## Accomplishments we're proud of

A complete, working consent loop — classification, multilingual explanation, read-aloud voice, adaptive comprehension check with re-explanation, e-signature, and a bilingual receipt — running end-to-end, including photo intake, built solo in under three weeks.

## What we learned

Language access is **civil-rights infrastructure**, not a translation feature. The hardest part was not explaining a letter. It was designing a way to *prove* that understanding happened — and then discovering that federal enforcement has been asking for exactly that, by name, since 2012 (Tulsa's order literally requires reminding staff that children may never interpret).

## What's next for Sabi

- **WhatsApp/SMS intake** — forward a photo of the letter; the highest-reach channel for the families who need this most
- **Direct-to-school receipt delivery** with acknowledgment tracking, so the paper trail closes both directions
- **District dashboard: which letters fail comprehension** — aggregate, anonymized signal that fixes the *source* document instead of only the symptom
- **Community-reviewed translations** and more languages, with the compiler-enforced string layer we already built
- **Voice-only mode** for parents who cannot read in any language

## Built by
[Your name] — [Your role(s)]

## Links
- **Live demo: https://sabi-teal.vercel.app** — running the live model; tap a sample letter and go. If the model is unavailable it degrades to the built-in demo engine instead of erroring.
- GitHub: https://github.com/Oluwanifemi-engineer/sabi
- Video: [URL]
