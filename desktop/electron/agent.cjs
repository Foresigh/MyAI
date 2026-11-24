// The Arvo Code loop: ask the server for the model's next message, run any
// tools it asks for on this computer (with the user's OK where needed), send
// the results back, and repeat until Arvo answers without tools.

const path = require("node:path");
const { runTool, previewFor, NEEDS_APPROVAL } = require("./tools.cjs");
const { decide, normalizeMode } = require("./permissions.cjs");

const MAX_STEPS = 40;

class StepError extends Error {
  constructor(message, retryAfter = null, serverError = false) {
    super(message);
    this.retryAfter = retryAfter;
    this.serverError = serverError;
  }
}

const MAX_RATE_LIMIT_WAIT = 65; // seconds Arvo waits by itself before giving up

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function askServer({ apiUrl, email, model, mode, workspace, messages, signal }) {
  let response;
  try {
    response = await fetch(`${apiUrl}/agent/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(email ? { "X-User-Email": email } : {}) },
      body: JSON.stringify({ messages, model, mode, features: ["batch", "background"], workspace: path.basename(workspace), platform: process.platform }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]),
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new StepError("Arvo couldn't reach the server. Check your internet connection and try again.");
  }
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Not JSON; use the status below.
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : null;
    if (response.status === 404) throw new StepError("This Arvo server doesn't support coding yet. It may still be updating; try again in a minute.");
    const wait = response.status === 429 && detail ? Number(detail.match(/try again in (\d+) seconds/)?.[1]) : NaN;
    throw new StepError(detail || `The server returned an error (${response.status}).`, Number.isFinite(wait) ? wait : null, response.status >= 500);
  }
  return data.message;
}

function parseArgs(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Run one user request to completion.
 *
 * session:  { workspace, messages, alwaysAllow: Set<"edit"|"command"> }
 * settings: { apiUrl, email, model, getMode() } — the mode is read on every
 *           step, so switching it mid-task takes effect straight away.
 * emit(event) sends progress to the window; approve(request) resolves to
 * "allow" | "always" | "deny".
 */
async function runTurn({ session, text, settings, emit, approve, signal }) {
  session.messages.push({ role: "user", content: text });

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return;
    let reply;
    for (let attempt = 0; ; attempt++) {
      try {
        reply = await askServer({
          ...settings,
          mode: normalizeMode(settings.getMode()) === "plan" ? "plan" : "act",
          workspace: session.workspace,
          messages: session.messages,
          signal,
        });
        break;
      } catch (err) {
        // Groq's free per-minute limits are low; wait them out a few times.
        // A failed step on the server is usually a one-off; try it once more.
        if (err instanceof StepError && err.serverError && attempt === 0) continue;
        if (!(err instanceof StepError) || !err.retryAfter || err.retryAfter > MAX_RATE_LIMIT_WAIT || attempt >= 3) throw err;
        emit({ type: "waiting", seconds: err.retryAfter });
        await sleep((err.retryAfter + 1) * 1000, signal);
        emit({ type: "waiting", seconds: 0 });
        if (signal.aborted) return;
      }
    }
    const calls = reply.tool_calls || [];
    session.messages.push({ role: "assistant", content: reply.content || "", ...(calls.length ? { tool_calls: calls } : {}) });
    if (reply.content) emit({ type: "assistant", text: reply.content });
    if (!calls.length) return;

    // Read-only calls next to each other run at the same time.
    let pending = [];
    const flush = async () => {
      const batch = pending;
      pending = [];
      const results = await Promise.all(batch.map((c) => runTool(session.workspace, c.name, c.args, { signal })));
      batch.forEach((c, i) => {
        session.messages.push({ role: "tool", tool_call_id: c.id, content: results[i].output });
        emit({ type: "tool_result", id: c.id, ok: results[i].ok, output: results[i].output });
      });
    };

    for (const call of calls) {
      const id = call.id;
      const name = call.function?.name;
      if (signal.aborted) {
        session.messages.push({ role: "tool", tool_call_id: id, content: "Stopped by the user." });
        continue;
      }
      const args = parseArgs(call.function?.arguments);
      if (!args) {
        session.messages.push({ role: "tool", tool_call_id: id, content: "The arguments weren't valid JSON. Try the call again." });
        continue;
      }

      emit({ type: "tool_start", id, name, args });

      const kind = NEEDS_APPROVAL[name];
      if (!kind) {
        pending.push({ id, name, args });
        continue;
      }
      await flush();
      const verdict = decide(settings.getMode(), kind, args, session.alwaysAllow);
      if (verdict.action === "block") {
        session.messages.push({ role: "tool", tool_call_id: id, content: verdict.reason });
        emit({ type: "tool_result", id, ok: false, declined: true, output: "Not in plan mode" });
        continue;
      }
      if (verdict.action === "ask") {
        const preview = await previewFor(session.workspace, name, args);
        const decision = await approve({ id, name, kind, preview, reason: verdict.reason });
        if (decision === "always") session.alwaysAllow.add(kind);
        if (decision !== "deny" && !signal.aborted) emit({ type: "tool_running", id });
        if (decision === "deny" || signal.aborted) {
          const content = signal.aborted ? "Stopped by the user." : "The user declined this. Don't try it again; ask what they would like instead.";
          session.messages.push({ role: "tool", tool_call_id: id, content });
          emit({ type: "tool_result", id, ok: false, declined: true, output: signal.aborted ? "Stopped" : "Declined" });
          continue;
        }
      }

      const result = await runTool(session.workspace, name, args, {
        signal,
        onOutput: (chunk) => emit({ type: "tool_output", id, chunk }),
      });
      session.messages.push({ role: "tool", tool_call_id: id, content: result.output });
      emit({ type: "tool_result", id, ok: result.ok, output: result.output });
    }
    await flush();
  }

  emit({ type: "assistant", text: "I've taken a lot of steps on this, so I'm pausing here. Send a message to keep going." });
}

module.exports = { runTurn, StepError };
