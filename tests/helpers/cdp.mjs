// Minimal CDP driver — no deps (Node 22 has a global WebSocket).
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// A fresh port per run: a stale headless Chrome from a killed test run must
// never be mistaken for the one we just launched.
export const PORT = 20000 + Math.floor(Math.random() * 20000);

export async function launch() {
  const child = spawn(
    "google-chrome",
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--window-size=1280,900",
      // window.print() on the receipt popup must not open a modal in headless.
      "--kiosk-printing",
      "about:blank",
    ],
    { stdio: "ignore", detached: true }
  );
  child.unref();

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return child;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

export async function newPage() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const target = await r.json();
  // Bound the handshake: a wedged devtools endpoint must fail fast, not hang.
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error("devtools websocket timed out")), 15000);
    ws.onopen = () => {
      clearTimeout(timer);
      res();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      rej(new Error("devtools websocket failed"));
    };
  });

  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        rej(new Error(JSON.stringify(msg.error)));
      } else {
        res(msg.result);
      }
    } else if (msg.method) {
      events.push(msg);
    }
  };

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const myId = ++id;
      pending.set(myId, { res, rej });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Network.enable");

  const evaluate = async (expr) => {
    const out = await send("Runtime.evaluate", {
      expression: `(function(){${expr}})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (out.exceptionDetails) {
      throw new Error("page threw: " + JSON.stringify(out.exceptionDetails.exception?.description ?? out.exceptionDetails));
    }
    return out.result?.value;
  };

  const consoleErrors = () =>
    events
      .filter(
        (e) =>
          (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) ||
          e.method === "Runtime.exceptionThrown" ||
          (e.method === "Log.entryAdded" && e.params.entry.level === "error")
      )
      .map((e) =>
        e.method === "Runtime.exceptionThrown"
          ? "EXCEPTION: " + (e.params.exceptionDetails.exception?.description ?? "").split("\n")[0]
          : e.method === "Log.entryAdded"
            ? "LOG: " + e.params.entry.text
            : `${e.params.type.toUpperCase()}: ` + (e.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ")
      );

  const goto = async (url) => {
    await send("Page.navigate", { url });
    // wait for the document to settle
    for (let i = 0; i < 120; i++) {
      await sleep(250);
      try {
        const ready = await evaluate("return document.readyState");
        if (ready === "complete") break;
      } catch {}
    }
    await sleep(600);
  };

  const click = async (text, { exact = false } = {}) => {
    const clicked = await evaluate(`
      const want = ${JSON.stringify(text)};
      const els = [...document.querySelectorAll('button, a, [role=button]')];
      const hit = els.find(e => {
        const t = (e.textContent || '').replace(/\\s+/g, ' ').trim();
        return ${exact ? "t === want" : "t.includes(want)"};
      });
      if (!hit) return null;
      hit.scrollIntoView({block:'center'});
      hit.click();
      return (hit.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 80);
    `);
    return clicked;
  };

  const bodyText = () =>
    evaluate("return (document.body.innerText||'').replace(/\\n{2,}/g,'\\n').trim()");

  const close = () => ws.close();

  return { send, evaluate, goto, click, bodyText, consoleErrors, events, close, target };
}
