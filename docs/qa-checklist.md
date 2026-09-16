# Sabi — QA pass & improvement tracker

**How to use this:** run the app (`npm run dev`), then walk every test below in order.
Mark each ✅ pass / ❌ fail / ⚠️ "works but feels off". Every ❌ and ⚠️ goes straight
to the improvement list — paste them back to the agent and they get fixed.
Time cost: ~45 minutes. Do it *before* recording the demo video.

---

## A. Install & boot (5 min)
- [ ] `npm install` completes with no errors
- [ ] `npm run dev` starts; app loads at localhost:4317 with no console errors (F12)
- [ ] Page looks right on a **phone-sized window** (judges and parents are on phones) — drag your browser narrow

## B. The core loop — run it 3× (15 min)
Do the full flow once per sample letter. Sabi's promise is only as good as its worst letter.
- [ ] Letter 1 (consent): intake → explanation appears
- [ ] Letter 2 (IEP): same
- [ ] Letter 3 (discipline): same
- [ ] Every explanation has all 5 blocks visible: **Ask / Sign consequences / Wait / Key facts / Rights**
- [ ] Urgency banner appears when the letter has a deadline
- [ ] 🔊 "Listen" button plays audio; **pulsing "Speaking…" indicator shows while playing**; Stop works; indicator clears when audio ends

## C. The comprehension loop — the innovation (10 min)
This is what the demo video's "money shot" depends on. It must be flawless.
- [ ] Answer a question **wrong on purpose** → honest feedback, no crash
- [ ] Click "Try again" → **simpler version appears**: softer headline, ultra-simple bullets, per-question clarifications
- [ ] Fail a second time → still works (loop is repeatable, not one-shot)
- [ ] Pass all 3 → unlock signature with a genuine sense of progress

## D. Signature & receipt (10 min)
- [ ] Draw a signature; "Clear" resets it; can't proceed with an empty signature
- [ ] Receipt PDF opens: check it contains **what was explained, language used, quiz score, timestamp, signature image**
- [ ] The drafted English reply reads like something a real parent would send — edit if needed
- [ ] Restart the browser → the letter is still in the **Family Folder** (localStorage persistence)

## E. The LLM engine (10 min) — only if you add a real key
- [ ] Copy `.env.example` → `.env.local`, add a real `LLM_API_KEY` (OpenRouter free tier works)
- [ ] Restart dev server; run one letter → response arrives in **under ~15 s** (if slower, we add streaming)
- [ ] Deliberately malformed input (paste gibberish, paste an empty string) → graceful error, never a white screen
- [ ] Toggle back to demo mode (remove key) — everything still works

## F. Judge-lens polish (10 min) — the 10% Design & UX score
- [ ] Show the app to one non-technical person for 60 seconds without explaining it. If they hesitate at any step, that step needs copy work
- [ ] All text is large and readable; warm palette; zero jargon anywhere
- [ ] All step transitions have the fade-in (nothing pops in abruptly)
- [ ] Every piece of visible English in the parent-language view is translated (no leaked English labels)

---

## Scoring the results
| Result | Meaning |
|---|---|
| All ✅ | Record the video. You're submission-ready. |
| Any ❌ in B–D | Blocker — fix before anything else. Paste it to the agent. |
| Any ⚠️ in F | Polish list — fix after blockers, before recording. |
| Anything in E slow | Add streaming — tell the agent, it's a small change. |
