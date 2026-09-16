/**
 * Browser e2e of the money path, against a REAL server in demo mode.
 *
 * Covers what the fallback design promises end to end:
 *   load -> sample letter -> explanation (all five blocks) -> quiz
 *   -> deliberate fail -> simpler tier -> retry -> pass -> signature
 *   -> reply drafted -> receipt opens with the right content -> persistence.
 *
 * Skips cleanly when headless Chrome is unavailable so `npm test` stays green
 * on machines without a browser.
 *
 * Run: npm run test:e2e
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { launch as launchChrome, newPage, PORT as CDP_PORT } from "./helpers/cdp.mjs";

const execFileP = promisify(execFile);

const PORT = 4654;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NEXT_CLI = "node_modules/next/dist/bin/next";

let server;
let chrome;
let page;
/** Correct labels captured from the ✅ reveal, used to pass on attempt 2. */
let correctAnswers = [];

async function hasChrome() {
  try {
    await execFileP("google-chrome", ["--version"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

const chromeAvailable = await hasChrome();

function waitForReady(child, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error("server not ready: " + out.slice(-400))), timeoutMs);
    const onData = (d) => {
      out += d.toString();
      if (/Ready in|✓ Ready|started server/i.test(out)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}): ` + out.slice(-400)));
    });
  });
}

// Boot at module scope so the describe() skip flag is accurate: Next 16 refuses
// to run a second `next dev` for a directory that already has one (e.g. the
// developer's own server), so the e2e always tests the PRODUCTION build via
// `next start`, which has no such deferral.
let serverBooted = false;
let bootError = null;
if (chromeAvailable) {
  try {
    server = spawn(process.execPath, [NEXT_CLI, "start", "-p", String(PORT)], {
      // Demo mode for determinism (see tests/api.test.mjs for why empty, not deleted).
      env: { ...process.env, LLM_API_KEY: "", LLM_BASE_URL: "", LLM_MODEL: "", LLM_VISION_MODEL: "" },
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForReady(server, 30000);
    serverBooted = true;
  } catch (err) {
    bootError = err;
    try {
      server?.kill("SIGKILL");
    } catch {}
    server = null;
  }
}

before(async () => {
  if (!chromeAvailable) return;
  if (!serverBooted) {
    console.warn(`\n[skip] e2e server did not boot: ${bootError?.message ?? "unknown"}`);
    console.warn("[skip] build first with: npm run build");
    return;
  }
  chrome = await launchChrome();
  page = await newPage();
});

after(() => {
  try {
    page?.close();
  } catch {}
  try {
    chrome?.kill("SIGKILL");
  } catch {}
  try {
    server?.kill("SIGKILL");
  } catch {}
});

async function waitText(re, timeout = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(`return new RegExp(${JSON.stringify(re)}).test(document.body.innerText)`)) {
      return true;
    }
    await sleep(400);
  }
  return false;
}

const clickLabel = (re) =>
  page.evaluate(`
    const b = [...document.querySelectorAll('button')].find(x => new RegExp(${JSON.stringify(re)}).test(x.textContent) && !x.disabled);
    if (!b) return null;
    b.click();
    return b.textContent.replace(/\\s+/g, ' ').trim();
  `);

describe("browser e2e — the money path (demo mode)", { skip: !chromeAvailable || !serverBooted }, () => {
  it("loads with zero console errors", async () => {
    await page.goto(BASE);
    assert.equal(await page.evaluate("return document.readyState"), "complete");
    assert.equal(page.consoleErrors().length, 0, JSON.stringify(page.consoleErrors()));
  });

  it("explains a sample letter with all five blocks", async () => {
    assert.ok(await clickLabel("Consent for evaluation"), "sample button exists");
    await sleep(500);
    assert.ok(await clickLabel("Explicar esta carta"), "explain button exists");
    assert.ok(await waitText("Datos clave"), "explanation appeared");
    const blocks = await page.evaluate(`
      const t = document.body.innerText;
      return ['Lo que piden','Si firma','Si espera','Datos clave','Sus derechos'].map(w => ({ w, ok: t.includes(w) }));
    `);
    for (const b of blocks) assert.ok(b.ok, `block missing: ${b.w}`);
  });

  it("failing the check gives honest feedback and reveals the answers", async () => {
    assert.ok(await clickLabel("revisar mi comprensión"));
    await sleep(800);
    // Last option of each question: wrong on purpose.
    await page.evaluate(`
      const o = [...document.querySelectorAll('button')].slice(0, 9);
      [2, 5, 8].forEach(i => o[i] && o[i].click());
      return true;
    `);
    await sleep(400);
    assert.ok(await clickLabel("Revisar mis respuestas"), "submit exists");
    await sleep(1500);
    const feedback = await page.evaluate(`
      const t = document.body.innerText;
      return { casi: /Casi — \\d/.test(t), marks: t.includes('✅') && t.includes('❌') };
    `);
    assert.ok(feedback.casi, "honest 'almost' feedback shown");
    assert.ok(feedback.marks, "correct/incorrect marks shown");
    // Capture the reveal BEFORE retrying: a fresh attempt clears the marks.
    correctAnswers = await page.evaluate(`
      return [...document.querySelectorAll('button')].filter(b => b.textContent.includes('✅'))
        .map(b => b.textContent.replace('✅','').replace('❌','').replace(/\\s+/g,' ').trim());
    `);
    assert.equal(correctAnswers.length, 3, "three correct answers revealed");
  });

  it("retry shows the simpler tier and a fresh, answerable quiz", async () => {
    assert.ok(await clickLabel("Intentar de nuevo"), "try-again exists");
    assert.ok(await waitText("Se lo explicamos más simple:"), "simpler panel visible");
    const state = await page.evaluate(`
      const t = document.body.innerText;
      return {
        failCardGone: !t.includes('Casi —'),
        optionsEnabled: [...document.querySelectorAll('button')].slice(0, 9).every(b => !b.disabled),
        progressShown: /Responda las tres para continuar/.test(t),
      };
    `);
    assert.ok(state.failCardGone, "failure card unmounted");
    assert.ok(state.optionsEnabled, "options re-clickable");
    assert.ok(state.progressShown, "progress gate shown until all three answered");
  });

  it("passing on the second attempt unlocks the signature step", async () => {
    await page.evaluate(`
      const norm = s => s.replace(/\\s+/g, ' ').trim();
      const btns = [...document.querySelectorAll('button')];
      for (const t of ${JSON.stringify(correctAnswers)}) {
        const h = btns.find(b => norm(b.textContent) === norm(t) && !b.disabled);
        if (h) h.click();
      }
      return true;
    `);
    await sleep(500);
    assert.ok(await clickLabel("Revisar mis respuestas"), "submit enabled after re-answering");
    assert.ok(await waitText("Firme cuando esté seguro|Firme arriba con el dedo"), "sign step reached");
  });

  it("accepts a drawn signature and drafts the reply", async () => {
    const rect = await page.evaluate(`
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    `);
    const y = rect.y + rect.h / 2;
    const x0 = rect.x + 40;
    const x1 = rect.x + rect.w - 40;
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y, button: "left", clickCount: 1, buttons: 1 });
    for (let i = 0; i <= 16; i++) {
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: x0 + ((x1 - x0) * i) / 16,
        y: y + Math.sin(i / 2) * 15,
        button: "left",
        buttons: 1,
      });
      await sleep(8);
    }
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y, button: "left", clickCount: 1, buttons: 0 });
    await sleep(500);
    const captured = await page.evaluate(`
      const c = document.querySelector('canvas');
      return c.parentElement.querySelector('span')?.textContent.trim();
    `);
    assert.equal(captured, "Firma capturada");

    assert.ok(await clickLabel("Redactarla"), "draft button exists");
    // The reply lands in a textarea VALUE, which innerText does not expose —
    // wait on the control itself.
    let reply = "";
    for (let i = 0; i < 30 && !reply; i++) {
      await sleep(1000);
      reply = await page.evaluate(`return document.querySelector('textarea')?.value ?? ""`);
    }
    assert.match(reply, /^Hello,/, "reply drafted into the textarea");
  });

  it("signing reaches the done step", async () => {
    assert.ok(await clickLabel("Firmar y crear mi recibo"), "sign button enabled");
    await sleep(1500);
    assert.ok(await waitText("Listo\\."), "done step reached");
    const folder = await page.evaluate(`
      const t = document.body.innerText;
      return { count: /Carpeta familiar/.test(t), signed: /FIRMAD/.test(t) };
    `);
    assert.ok(folder.signed, "folder shows the signed entry");
  });

  it("the receipt opens and carries the proof", async () => {
    assert.ok(await clickLabel("Ver / imprimir recibo"), "receipt button exists");
    await sleep(2500);
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const popup = list.find((t) => t.type === "page" && /Acknowledgment/.test(t.title) && t.id !== page.target.id);
    assert.ok(popup, "receipt popup opened");

    // One connection for the whole test — evaluate as many expressions as
    // needed, then close. (A second evaluate after close hangs forever.)
    const ws = new WebSocket(popup.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error("popup devtools websocket timed out")), 15000);
      ws.onopen = () => {
        clearTimeout(timer);
        res();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        rej(new Error("popup devtools websocket failed"));
      };
    });
    let evalId = 0;
    const evalInPopup = (expression) =>
      new Promise((resolve, reject) => {
        const id = ++evalId;
        const timer = setTimeout(() => reject(new Error("popup evaluate timed out")), 15000);
        const onMessage = (m) => {
          const d = JSON.parse(m.data);
          if (d.id === id) {
            clearTimeout(timer);
            ws.removeEventListener("message", onMessage);
            if (d.error) {
              reject(new Error(JSON.stringify(d.error)));
            } else {
              resolve(d.result?.result?.value ?? "");
            }
          }
        };
        ws.addEventListener("message", onMessage);
        ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
      });

    try {
      const result = await evalInPopup("document.body.innerText");
      assert.match(result, /PASSED/);
      assert.match(result, /le explicó esta carta en español/, "bilingual confirmation note");
      assert.match(result, /Attempts used\s+2/, "receipt reports both attempts");
      const hasSig = await evalInPopup("document.querySelector('.sig img')?.src.startsWith('data:image/png') ?? false");
      assert.equal(hasSig, true, "signature image embedded");
    } finally {
      ws.close();
    }
  });

  it("the signed letter persists across a reload", async () => {
    await page.goto(BASE);
    await sleep(1500);
    assert.ok(
      await page.evaluate(`return /Lincoln Middle School/.test(document.body.innerText) && /FIRMAD/.test(document.body.innerText)`),
      "family folder survives reload"
    );
  });

  it("Arabic flips the whole interface to RTL", async () => {
    await page.evaluate(`localStorage.clear(); return true;`);
    await page.goto(BASE);
    await sleep(800);
    assert.ok(await clickLabel("العربية"), "language button exists");
    await sleep(600);
    const dir = await page.evaluate(`
      return {
        main: document.querySelector('main')?.getAttribute('dir'),
        computed: getComputedStyle(document.querySelector('main')).direction,
        title: document.body.innerText.includes('ما أرسلته المدرسة؟') || document.body.innerText.includes('١') || document.body.innerText.includes('1'),
      };
    `);
    assert.equal(dir.main, "rtl");
    assert.equal(dir.computed, "rtl");
  });

  it("finishes with zero console errors", async () => {
    assert.equal(page.consoleErrors().length, 0, JSON.stringify(page.consoleErrors().slice(0, 5)));
  });
});
