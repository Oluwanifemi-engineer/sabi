import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mockExplain, mockSimplify } from "../../src/lib/mock.ts";
import { SAMPLE_LETTERS } from "../../src/lib/samples.ts";
import { UI } from "../../src/lib/ui-strings.ts";
import { LANGUAGES } from "../../src/lib/types.ts";

describe("demo engine contract (mockExplain)", () => {
  const types = ["consent", "iep", "discipline"] as const;

  for (const [i, type] of types.entries()) {
    it(`classifies the ${type} sample letter and returns the full contract`, () => {
      const out = mockExplain(SAMPLE_LETTERS[i].text);
      assert.equal(out.analysis.type, type);

      // Analysis shape the UI and receipt depend on.
      assert.ok(["action-required", "response-needed-by", "fyi"].includes(out.analysis.urgency));
      assert.ok(out.analysis.keyFacts.length >= 1, "keyFacts present");
      assert.ok(out.analysis.rights.length >= 1, "rights present");
      assert.ok(Array.isArray(out.analysis.risksOfSigning));

      // All five explanation blocks the UI renders.
      for (const key of ["headline", "summary", "whatTheyAsk", "ifYouSign", "ifYouDontSign"] as const) {
        assert.ok(out.explanation[key].length > 0, `explanation.${key} non-empty`);
      }
      assert.ok(out.explanation.questionsToAsk.length >= 1);

      // Exactly three quiz questions, each with three options and one correct.
      assert.equal(out.questions.length, 3);
      for (const q of out.questions) {
        assert.equal(q.options.length, 3);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 3);
        assert.ok(q.question.length > 0);
        assert.ok(q.why.length > 0);
      }
    });
  }

  it("falls back to the generic contract for unclassifiable text", () => {
    const out = mockExplain("School is closed on Friday for a staff development day.");
    assert.equal(out.analysis.type, "generic");
    assert.equal(out.analysis.urgency, "fyi");
    assert.equal(out.questions.length, 3);
  });
});

describe("simplify pass (mockSimplify)", () => {
  it("returns one clarification per failed question, in order", () => {
    const failed = ["By what date must you return the form?", "What happens if you sign?"];
    const out = mockSimplify("consent", failed);
    assert.equal(out.aboutWrong.length, failed.length);
    assert.ok(out.aboutWrong[0].includes(failed[0].slice(0, 60)));
    assert.ok(out.headline.length > 0);
    assert.ok(out.bullets.length >= 2);
  });

  it("keeps the panel empty-safe when nothing failed", () => {
    const out = mockSimplify("iep", []);
    assert.equal(out.aboutWrong.length, 0);
  });

  it("covers every letter type with a headline", () => {
    for (const type of ["consent", "iep", "discipline", "meeting", "generic"]) {
      assert.ok(mockSimplify(type, []).headline.length > 0, type);
    }
  });
});

describe("interface translations (UI)", () => {
  it("provides every UI string in every advertised language", () => {
    for (const lang of LANGUAGES) {
      const strings = UI[lang.code];
      for (const [key, value] of Object.entries(UI.en)) {
        assert.ok(key in strings, `${lang.code} missing key "${key}"`);
        assert.ok(String(value).length > 0, `${lang.code} has empty key "${key}"`);
      }
    }
  });

  it("translates, not just copies, the core labels", () => {
    assert.equal(UI.es.explainBtn.includes("Explicar"), true);
    assert.equal(UI.fr.explainBtn.includes("Expliquer"), true);
    assert.notEqual(UI.ar.quizTitle, UI.en.quizTitle);
  });

  it("marks Arabic as the RTL language", () => {
    assert.equal(LANGUAGES.find((l) => l.code === "ar")?.rtl, true);
    assert.equal(LANGUAGES.filter((l) => l.rtl).length, 1);
  });

  it("discloses where data goes on the intake screen, in every language", () => {
    for (const lang of LANGUAGES) {
      assert.ok(UI[lang.code].privacyNote.length > 40, `${lang.code} privacyNote present`);
    }
  });
});
