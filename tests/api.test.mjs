/**
 * API contract tests against a REAL running server in demo mode.
 * These are the guarantees the fallback design promises — verified, not assumed:
 *   - malformed input never 500s
 *   - every success carries the shape the UI depends on
 * Run: npm run test:api   (boots its own server on a private port, then kills it)
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
const PORT = 4653;
const BASE = `http://127.0.0.1:${PORT}`;
// fileURLToPath, not URL.pathname — the latter percent-encodes spaces, and a
// nonexistent cwd makes spawn fail with a misleading ENOENT on the binary.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NEXT_CLI = "node_modules/next/dist/bin/next";
let server;
/**
 * Demo mode is the contract under test. Set the provider vars to empty rather
 * than deleting them: Next.js loads .env.local on boot and dotenv-style loaders
 * never override vars already present in the environment, so empty strings win
 * over whatever the developer has configured locally.
 */
function envWithoutKey() {
  return {
    ...process.env,
    LLM_API_KEY: "",
    LLM_BASE_URL: "",
    LLM_MODEL: "",
    LLM_VISION_MODEL: "",
  };
}
function waitForReady(child, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error("server did not become ready: " + out.slice(-400))), timeoutMs);
    const onData = (d) => {
      out += d.toString();
      if (/Ready in|✓ Ready|started server/i.test(out)) {
        clearTimeout(timer);
        resolve(out);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error("spawn failed: " + err.message));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}): ` + out.slice(-400)));
    });
  });
}
before(async () => {
  // Spawn Next's CLI with the running node binary directly — `npx` is not a
  // real executable in every environment this repo is cloned into.
  let child = spawn(process.execPath, [NEXT_CLI, "start", "-p", String(PORT)], {
    env: envWithoutKey(),
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForReady(child, 30000);
  } catch {
    child.kill("SIGKILL");
    await sleep(1000);
    child = spawn(process.execPath, [NEXT_CLI, "dev", "-p", String(PORT)], {
      env: envWithoutKey(),
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForReady(child, 90000);
  }
  server = child;
  // Warm-up request; first compile in dev mode can take a while.
  const warm = await fetch(BASE);
  assert.equal(warm.status, 200, "home page boots");
});
after(() => {
  if (server) server.kill("SIGKILL");
});
async function post(path, body, { raw = false } = {}) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body is a valid observation for a test to assert on */
  }
  return { status: res.status, json };
}
const CONSENT = `LINCOLN MIDDLE SCHOOL - STUDENT SUPPORT SERVICES. Based on classroom observations, the Student Support Team recommends an individual evaluation for your child. Please sign the enclosed Consent for Evaluation form (Form SE-3). Federal and state regulations allow fourteen (14) calendar days from the date of this notice for written consent.`;
function assertExplainContract(d) {
  assert.ok(d && typeof d === "object", "response is a JSON object");
  assert.ok(d.engine, "engine is reported");
  const a = d.analysis ?? {};
  assert.ok(["consent", "iep", "discipline", "meeting", "generic"].includes(a.type), `analysis.type valid (${a.type})`);
  assert.ok(["action-required", "response-needed-by", "fyi"].includes(a.urgency));
  assert.ok(Array.isArray(a.keyFacts) && a.keyFacts.length > 0, "keyFacts non-empty");
  assert.ok(Array.isArray(a.rights) && a.rights.length > 0, "rights non-empty");
  const e = d.explanation ?? {};
  for (const k of ["headline", "summary", "whatTheyAsk", "ifYouSign", "ifYouDontSign"]) {
    assert.ok(typeof e[k] === "string" && e[k].length > 0, `explanation.${k} non-empty`);
  }
  assert.equal(d.questions?.length, 3);
  for (const q of d.questions) {
    assert.equal(q.options?.length, 3);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 3);
  }
}
describe("POST /api/analyze", () => {
  it("explains a consent letter with the full contract", async () => {
    const { status, json } = await post("/api/analyze", { text: CONSENT, language: "es" });
    assert.equal(status, 200);
    assertExplainContract(json);
    assert.equal(json.analysis.type, "consent");
  });
  it("returns the generic contract for long gibberish, never a 500", async () => {
    const gibberish = "asdkjhqwe98 zzzz 1231 !!! qwerty ipsum zork blorp snard 42 ?? ...xx.. aaaa bbbb cccc dddd";
    const { status, json } = await post("/api/analyze", { text: gibberish, language: "en" });
    assert.equal(status, 200);
    assertExplainContract(json);
    assert.equal(json.analysis.type, "generic");
  });
  it("400s on empty letter text", async () => {
    const { status } = await post("/api/analyze", { text: "   ", language: "en" });
    assert.equal(status, 400);
  });
  it("400s on missing letter text", async () => {
    const { status } = await post("/api/analyze", { language: "en" });
    assert.equal(status, 400);
  });
  it("400s on malformed JSON body", async () => {
    const { status } = await post("/api/analyze", "{not json", { raw: true });
    assert.equal(status, 400);
  });
});
describe("POST /api/simplify", () => {
  it("simplifies with one clarification per failed question", async () => {
    const { status, json } = await post("/api/simplify", {
      letterType: "consent",
      failedQuestions: ["How many days do you have to decide?", "Can you cancel consent later?"],
      language: "es",
    });
    assert.equal(status, 200);
    assert.ok(json.simpler, "simpler payload present");
    assert.ok(json.simpler.headline.length > 0);
    assert.ok(json.simpler.bullets.length >= 2);
    assert.equal(json.simpler.aboutWrong.length, 2, "one clarification per failed question");
  });
  it("serves the generic simplify tier when nothing failed (documented contract)", async () => {
    const { status, json } = await post("/api/simplify", { letterType: "consent", failedQuestions: [] });
    assert.equal(status, 200);
    assert.equal(json.simpler.aboutWrong.length, 0);
  });
  it("400s on malformed JSON", async () => {
    const { status } = await post("/api/simplify", "]not json{", { raw: true });
    assert.equal(status, 400);
  });
});
describe("POST /api/ocr", () => {
  it("400s with no image", async () => {
    const { status } = await post("/api/ocr", {});
    assert.equal(status, 400);
  });
  it("400s on malformed JSON", async () => {
    const { status } = await post("/api/ocr", "{oops", { raw: true });
    assert.equal(status, 400);
  });
  it("serves a demo extraction in demo mode", async () => {
    const { status, json } = await post("/api/ocr", { image: "data:image/png;base64,aGVsbG8=" });
    assert.equal(status, 200);
    assert.equal(json.engine, "demo");
    assert.ok(typeof json.text === "string" && json.text.length > 100, "demo extraction is a full letter");
  });
});
describe("cross-cutting", () => {
  it("bad requests get parent-readable JSON errors, never HTML stack traces", async () => {
    const cases = [["/api/analyze", {}], ["/api/ocr", { image: "" }]];
    for (const [path, body] of cases) {
      const { status, json } = await post(path, body);
      assert.equal(status, 400, `${path} rejects ${JSON.stringify(body)}`);
      assert.ok(json && typeof json.error === "string" && json.error.length > 0, `${path} returns JSON error`);
    }
  });
});
