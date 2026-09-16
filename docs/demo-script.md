# Sabi — 5-minute demo video script (GatewayHacks)

**Rules:** ≤ 5 minutes hard cap. Story before features, always. Record 1080p, browser zoom 110%, bookmarks bar hidden, captions burned in, loudness normalized.

**The one rule that decides this video:** every second before 0:45 is *the parent's* problem, not our product. If our logo appears before the 40-second mark, we've lost the room.

---

## 0:00–0:50 — The problem (no product yet)

**[Visual: a real-looking special-education consent form fills the screen, slow zoom on the signature line. No UI, no logo, no music.]**

> "This is a consent form. It authorizes a special-education evaluation for a child. That's a decision that shapes a child's school life for years.
>
> Now look at who signs it."

**[Cut: text on black — "5.3 million US students are English learners." then "69% of Spanish-speaking parents who tried to engage said a language barrier stopped them."]**

> "Five point three million students come from homes where English isn't the first language. And here's the number that should bother you: among Spanish-speaking parents who *tried* to participate in their child's school, roughly seven in ten said a language barrier got in the way. They weren't disengaged. They were blocked.
>
> So what happens? The workaround every immigrant family knows. The kid translates. A ten-year-old explaining a legal consent form to their mother."

**[Cut: text on black — "Tulsa Public Schools was ordered to remind staff annually that minor children may never be used as interpreters."]**

> "That's not an anecdote. In a federal civil-rights settlement, a school district was ordered to remind its staff every single year that children must never be used as interpreters. It keeps happening because families had no other option."

**[Cut: title card — "Sabi. Understand before you sign."]**

> "So we built the option."

---

## 0:50–2:00 — Explain (the product, fast)

**[Screen recording. Pre-load the consent sample before recording.]**

**0:50–1:05 — Intake.**
- Tap the consent sample → letter text appears
- **Click the language picker → choose Español → the entire interface flips to Spanish**
> "Nothing about this app is in English, because English is the barrier."

**1:05–1:20 — Photo intake (the 10-second showstopper).**
- Tap 📷 → capture the paper letter → loading → extracted text fills the field
> "Or photograph the letter from the kitchen table. Paper, phone, done."

**1:20–1:50 — Explanation.**
- Show the cards: headline, plain summary, **"What they're asking" / "If you sign" / "If you wait"**, rights, deadline banner
- **Click "Read aloud" — let it SPEAK in Spanish. Hold 3 full seconds of audible speech.**
> "Voice-first. Because for many of these parents, reading — in *any* language — is the real barrier."

**1:50–2:00 — Wait on the content.** Let judges read one card fully. Do not narrate over it.

---

## 2:00–3:10 — Verify (the part nobody else has)

> "Here is what no translation tool does."

- Land on the comprehension check: three questions generated from *this letter's* facts
- **Answer one WRONG on purpose.** Let the fail state land.
- The simpler tier appears: calmer headline, shorter sentences, a clarification of the exact thing missed
> "It didn't just mark me wrong. It explained it differently — simpler — and let me try again."
- Click **Try again** → answers reset → answer correctly → green pass
> "That loop is the product. Consent is verified, not assumed. A signature means the parent *understood*."

---

## 3:10–4:00 — Acknowledge (the artifact)

**[Switch back to English UI for the receipt so judges can read it.]**

- Draw a readable signature ("Maria L.")
- Sign → **receipt renders on screen**
- Slow-scroll the receipt so viewers read: what was explained, language, **Understanding check: PASSED**, deadline, signature, timestamp
- Point at the top: the confirmation note **in the parent's language**, the record in English
> "One document. The parent's language for the parent, English for the school. This receipt didn't exist before — it's proof that consent was informed."
- Show the drafted English reply, then the 💾 Export all button
> "No database. The letters never leave this device, and the family can export everything any time."

---

## 4:00–4:30 — How it works (30 seconds, no more)

> "Next.js and TypeScript. One language-model call per letter — classify, explain, generate the quiz — behind a strict JSON contract. It speaks any OpenAI-compatible model; swap providers with one env var. Vision OCR for photos. Speech runs on-device. And if the network dies, a built-in demo engine keeps every step working — this demo cannot dead-end."

---

## 4:30–4:50 — Close

> "ParentSquare and TalkingPoints translate words. Sabi proves understanding.
>
> Five million families are one comprehension check away from real consent.
>
> Sabi. *Understand before you sign.*"

**[End card: title + tagline + live URL + QR code]**

---

## Production checklist

**Before recording**
- [ ] `npm run dev` → confirm `localhost:4317` loads, no console errors
- [ ] Pre-run the consent sample once so the LLM/OCR path is warmed
- [ ] Test TTS volume; confirm 3 full seconds of audible Spanish
- [ ] Rehearse the deliberate wrong answer 3× — timing is the money shot
- [ ] Close every other tab; hide the bookmarks bar; zoom 110%

**Capturing**
- [ ] Screen-record at 1080p, 30fps minimum, cursor visible but calm
- [ ] Record the audio in one take — energy matters more than perfection
- [ ] Keep the runtime under 5:00 (target 4:45); cut features before cutting the problem

**After**
- [ ] Burn in captions (judges often watch muted)
- [ ] Normalize loudness; no copyrighted music
- [ ] Upload unlisted to YouTube; put the link in the Devpost page and README
