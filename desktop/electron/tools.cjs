// The tools Arvo Code runs on this computer. Every path is checked so the
// agent can only touch files inside the workspace folder the user picked.

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");

const MAX_OUTPUT = 12000; // characters of tool output sent back to the model
const MAX_READ_LINES = 1500;
const COMMAND_TIMEOUT_MS = 5 * 60_000;
// Installing packages or creating a project can take a long time.
const SLOW_COMMAND = /\b(install|ci|add|create|init|build|prebuild|export|pip|poetry|cargo)\b/i;
const SLOW_COMMAND_TIMEOUT_MS = 15 * 60_000;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".expo", ".venv", "venv", "__pycache__", "release", ".turbo", "coverage"]);

class ToolError extends Error {}

function clip(text, max = MAX_OUTPUT) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  const tail = max - head;
  return `${text.slice(0, head)}\n\n[... ${text.length - max} characters cut ...]\n\n${text.slice(-tail)}`;
}

function isSecretFile(file) {
  const name = path.basename(file).toLowerCase();
  if (name === ".env" || (name.startsWith(".env.") && !/\.(example|sample|template)$/.test(name))) return true;
  return /^(id_rsa|id_ed25519|credentials\.json|.*\.pem|.*\.key)$/.test(name);
}

/** Resolve a workspace-relative path, refusing anything outside the workspace. */
function resolveInside(workspace, rel = ".") {
  if (typeof rel !== "string" || rel.includes("\0")) throw new ToolError("That path isn't valid.");
  const root = fs.realpathSync(workspace);
  const target = path.resolve(root, rel);
  // Follow symlinks for the part of the path that already exists.
  let existing = target;
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
  const real = path.join(fs.realpathSync(existing), path.relative(existing, target));
  const relative = path.relative(root, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ToolError(`${rel} is outside the workspace. Arvo can only use files inside ${path.basename(root)}.`);
  }
  return real;
}

function display(workspace, abs) {
  return path.relative(fs.realpathSync(workspace), abs).split(path.sep).join("/") || ".";
}

async function readText(abs) {
  const buf = await fsp.readFile(abs);
  if (buf.subarray(0, 8000).includes(0)) throw new ToolError("That file looks binary, so Arvo can't read it as text.");
  return buf.toString("utf8");
}

async function listFiles(workspace, { path: rel = "." }) {
  const abs = resolveInside(workspace, rel);
  const entries = await fsp.readdir(abs, { withFileTypes: true }).catch(() => {
    throw new ToolError(`There is no folder called ${rel}.`);
  });
  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const lines = entries.slice(0, 500).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  if (entries.length > 500) lines.push(`[... and ${entries.length - 500} more]`);
  return lines.length ? lines.join("\n") : "(empty folder)";
}

async function readFile(workspace, { path: rel, start_line, end_line }) {
  const abs = resolveInside(workspace, rel);
  if (isSecretFile(abs)) throw new ToolError("Arvo doesn't read secret files like .env, to keep your keys private.");
  if (!fs.existsSync(abs)) throw new ToolError(`There is no file called ${rel}.`);
  if (fs.statSync(abs).isDirectory()) throw new ToolError(`${rel} is a folder. Use list_files instead.`);
  const lines = (await readText(abs)).split(/\r?\n/);
  const start = Math.max(1, Number(start_line) || 1);
  const end = Math.min(lines.length, Number(end_line) || start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1);
  const width = String(end).length;
  let out = lines.slice(start - 1, end).map((l, i) => `${String(start + i).padStart(width)}  ${l}`).join("\n");
  if (end < lines.length) out += `\n[File has ${lines.length} lines. Read more with start_line=${end + 1}.]`;
  return clip(out, 20000);
}

async function readFiles(workspace, { paths }) {
  if (!Array.isArray(paths) || paths.length === 0) throw new ToolError("Give a list of paths to read.");
  const parts = await Promise.all(
    paths.slice(0, 12).map(async (p) => {
      try {
        return `===== ${p} =====\n${await readFile(workspace, { path: p })}`;
      } catch (err) {
        return `===== ${p} =====\n${err instanceof ToolError ? err.message : `Error: ${err.message}`}`;
      }
    })
  );
  if (paths.length > 12) parts.push(`[Only the first 12 files were read.]`);
  return clip(parts.join("\n\n"), 30000);
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(abs);
    } else if (e.isFile()) {
      yield abs;
    }
  }
}

async function searchFiles(workspace, { query, path: rel = "." }) {
  if (!query) throw new ToolError("Give some text to search for.");
  const root = resolveInside(workspace, rel);
  const needle = String(query).toLowerCase();
  const matches = [];
  for await (const file of walk(root)) {
    if (isSecretFile(file)) continue;
    let stat;
    try {
      stat = await fsp.stat(file);
    } catch {
      continue;
    }
    if (stat.size > 1_000_000) continue;
    let text;
    try {
      text = await readText(file);
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        matches.push(`${display(workspace, file)}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
        if (matches.length >= 200) return matches.join("\n") + "\n[Stopped at 200 matches.]";
      }
    }
  }
  return matches.length ? matches.join("\n") : `No matches for "${query}".`;
}

async function writeFile(workspace, { path: rel, content }) {
  const abs = resolveInside(workspace, rel);
  if (isSecretFile(abs)) throw new ToolError("Arvo doesn't write secret files like .env. Ask the user to edit it.");
  if (typeof content !== "string") throw new ToolError("content must be text.");
  const existed = fs.existsSync(abs);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, "utf8");
  return `${existed ? "Updated" : "Created"} ${display(workspace, abs)} (${content.split("\n").length} lines).`;
}

async function writeFiles(workspace, { files }) {
  if (!Array.isArray(files) || files.length === 0) throw new ToolError("Give a list of files to write.");
  if (files.length > 30) throw new ToolError("Write at most 30 files at once.");
  // Check every path first, so a bad one doesn't leave a half-written set.
  for (const f of files) {
    const abs = resolveInside(workspace, f?.path);
    if (isSecretFile(abs)) throw new ToolError(`Arvo doesn't write secret files like ${f.path}. Ask the user to edit it.`);
    if (typeof f.content !== "string") throw new ToolError(`content for ${f.path} must be text.`);
  }
  const results = [];
  for (const f of files) results.push(await writeFile(workspace, f));
  return results.join("\n");
}

async function editFile(workspace, { path: rel, old_text, new_text }) {
  const abs = resolveInside(workspace, rel);
  if (isSecretFile(abs)) throw new ToolError("Arvo doesn't edit secret files like .env. Ask the user to edit it.");
  if (!fs.existsSync(abs)) throw new ToolError(`There is no file called ${rel}. Use write_file to create it.`);
  if (!old_text) throw new ToolError("old_text can't be empty.");
  const original = await readText(abs);
  // Models often send \n where the file uses \r\n; match either.
  const usesCrlf = original.includes("\r\n");
  const text = usesCrlf ? original.replace(/\r\n/g, "\n") : original;
  const oldN = old_text.replace(/\r\n/g, "\n");
  const count = text.split(oldN).length - 1;
  if (count === 0) throw new ToolError(`old_text wasn't found in ${rel}. Read the file again and copy the text exactly.`);
  if (count > 1) throw new ToolError(`old_text appears ${count} times in ${rel}. Include more surrounding lines so it is unique.`);
  let updated = text.replace(oldN, () => new_text.replace(/\r\n/g, "\n"));
  if (usesCrlf) updated = updated.replace(/\n/g, "\r\n");
  await fsp.writeFile(abs, updated, "utf8");
  return `Edited ${display(workspace, abs)}.`;
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

// Programs started with background: true (dev servers, apps). They keep
// running after the step ends and are stopped when Arvo quits.
const background = new Set();
let BACKGROUND_WAIT_MS = 8000;
// A command that is still going after this long and has gone quiet is
// probably a program meant to keep running (an app or a server), so it is
// moved to the background instead of holding up Arvo until the time limit.
let QUIET_AFTER_MS = 45_000;
let QUIET_FOR_MS = 20_000;

/** For tests: shorten the waits. */
function setTimings({ backgroundWait = BACKGROUND_WAIT_MS, quietAfter = QUIET_AFTER_MS, quietFor = QUIET_FOR_MS }) {
  BACKGROUND_WAIT_MS = backgroundWait;
  QUIET_AFTER_MS = quietAfter;
  QUIET_FOR_MS = quietFor;
}

function stopBackground() {
  for (const child of background) killTree(child);
  background.clear();
}

function runCommand(workspace, { command, cwd = ".", background: inBackground = false }, { signal, onOutput } = {}) {
  if (!command || typeof command !== "string") throw new ToolError("Give a command to run.");
  const dir = resolveInside(workspace, cwd);
  const win = process.platform === "win32";
  const [shell, args] = win
    ? ["powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `[Console]::OutputEncoding=[Text.Encoding]::UTF8; $global:LASTEXITCODE=0; ${command}
if (-not $?) { if ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }; exit $LASTEXITCODE`]]
    : [process.env.SHELL || "/bin/bash", ["-lc", command]];

  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    const startedAt = Date.now();
    let lastOutputAt = startedAt;
    const child = spawn(shell, args, {
      cwd: dir,
      env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
      detached: !win,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const add = (chunk) => {
      const text = chunk.toString("utf8");
      output += text;
      lastOutputAt = Date.now();
      if (output.length > 400_000) output = output.slice(-200_000);
      onOutput?.(text);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const limit = SLOW_COMMAND.test(command) ? SLOW_COMMAND_TIMEOUT_MS : COMMAND_TIMEOUT_MS;
    let done = false;
    let timer;
    let quietCheck;
    // Leave the program running and hand back what it printed so far.
    const leaveRunning = (note) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(quietCheck);
      signal?.removeEventListener("abort", abort);
      background.add(child);
      child.on("close", () => background.delete(child));
      let text = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trim();
      text = clip(text || "(no output yet)");
      text += `\n[${note} It is still running in the background (process ${child.pid}) and keeps running until Arvo quits.]`;
      resolve({ output: text, ok: true });
    };
    if (inBackground) {
      // Give it a few seconds to start (or fail).
      timer = setTimeout(() => leaveRunning("Started."), BACKGROUND_WAIT_MS);
    } else {
      timer = setTimeout(() => {
        timedOut = true;
        killTree(child);
      }, limit);
      if (!SLOW_COMMAND.test(command)) {
        quietCheck = setInterval(() => {
          const now = Date.now();
          if (now - startedAt >= QUIET_AFTER_MS && now - lastOutputAt >= QUIET_FOR_MS) {
            const seconds = Math.round((now - startedAt) / 1000);
            leaveRunning(`This kept running for ${seconds} seconds and went quiet, so it looks like a program that stays open.`);
          }
        }, 1000);
      }
    }
    const abort = () => killTree(child);
    signal?.addEventListener("abort", abort, { once: true });
    const finish = (code, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(quietCheck);
      signal?.removeEventListener("abort", abort);
      // Strip terminal colour codes the model can't use.
      let text = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trim();
      text = clip(text || "(no output)");
      if (error) text += `\n[Could not start the command: ${error.message}]`;
      else if (timedOut) text += `\n[Stopped after ${limit / 60_000} minutes. Long-running commands like dev servers never finish here.]`;
      else if (signal?.aborted) text += "\n[Stopped by the user.]";
      else text += `\n[Exit code ${code}]`;
      resolve({ output: text, ok: !error && !timedOut && code === 0 });
    };
    child.on("error", (err) => finish(null, err));
    child.on("close", (code) => finish(code));
  });
}

/** Tools that change things and so may need the user's OK. */
const NEEDS_APPROVAL = { write_file: "edit", write_files: "edit", edit_file: "edit", run_command: "command" };

/** What to show the user before they approve a tool call. */
async function previewFor(workspace, name, args) {
  if (name === "run_command") return { kind: "command", command: String(args.command || ""), cwd: args.cwd || ".", background: !!args.background };
  let exists = false;
  try {
    exists = fs.existsSync(resolveInside(workspace, args.path));
  } catch {
    // The tool itself will report the bad path.
  }
  if (name === "write_files") {
    const files = (Array.isArray(args.files) ? args.files : []).map((f) => {
      let existsNow = false;
      try {
        existsNow = fs.existsSync(resolveInside(workspace, f.path));
      } catch {
        // Reported when the tool runs.
      }
      return { path: String(f?.path || ""), exists: existsNow, content: String(f?.content || "") };
    });
    return { kind: "write_many", files };
  }
  if (name === "edit_file") return { kind: "edit", path: args.path, oldText: args.old_text || "", newText: args.new_text || "" };
  return { kind: "write", path: args.path, exists, content: String(args.content || "") };
}

async function runTool(workspace, name, args, options = {}) {
  try {
    switch (name) {
      case "list_files":
        return { ok: true, output: await listFiles(workspace, args) };
      case "read_file":
        return { ok: true, output: await readFile(workspace, args) };
      case "read_files":
        return { ok: true, output: await readFiles(workspace, args) };
      case "write_files":
        return { ok: true, output: await writeFiles(workspace, args) };
      case "search_files":
        return { ok: true, output: await searchFiles(workspace, args) };
      case "write_file":
        return { ok: true, output: await writeFile(workspace, args) };
      case "edit_file":
        return { ok: true, output: await editFile(workspace, args) };
      case "run_command":
        return await runCommand(workspace, args, options);
      default:
        return { ok: false, output: `Arvo doesn't have a tool called ${name}.` };
    }
  } catch (err) {
    const message = err instanceof ToolError ? err.message : `Error: ${err.message}`;
    return { ok: false, output: message };
  }
}

module.exports = { runTool, previewFor, NEEDS_APPROVAL, resolveInside, isSecretFile, stopBackground, setTimings };
