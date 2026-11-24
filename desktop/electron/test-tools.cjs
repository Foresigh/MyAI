// Quick checks for the workspace tools: node electron/test-tools.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runTool } = require("./tools.cjs");

(async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "arvo-ws-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "arvo-outside-"));
  fs.writeFileSync(path.join(outside, "secret.txt"), "nope");
  fs.writeFileSync(path.join(ws, ".env"), "KEY=hidden");
  fs.writeFileSync(path.join(ws, "crlf.txt"), "one\r\ntwo\r\nthree\r\n");

  let r = await runTool(ws, "write_file", { path: "src/app.js", content: "console.log('hi')\n" });
  assert.ok(r.ok, r.output);
  r = await runTool(ws, "read_file", { path: "src/app.js" });
  assert.match(r.output, /1  console.log/);
  r = await runTool(ws, "list_files", { path: "." });
  assert.match(r.output, /src\//);
  r = await runTool(ws, "search_files", { query: "CONSOLE" });
  assert.match(r.output, /src\/app.js:1/);

  r = await runTool(ws, "edit_file", { path: "crlf.txt", old_text: "one\ntwo", new_text: "1\n2" });
  assert.ok(r.ok, r.output);
  assert.equal(fs.readFileSync(path.join(ws, "crlf.txt"), "utf8"), "1\r\n2\r\nthree\r\n");
  r = await runTool(ws, "edit_file", { path: "crlf.txt", old_text: "missing", new_text: "x" });
  assert.equal(r.ok, false);

  for (const p of ["../" + path.basename(outside) + "/secret.txt", path.join(outside, "secret.txt"), "..", "C:/Windows/win.ini"]) {
    r = await runTool(ws, "read_file", { path: p });
    assert.equal(r.ok, false, `should refuse ${p}`);
  }
  r = await runTool(ws, "write_file", { path: "../escape.txt", content: "x" });
  assert.equal(r.ok, false);
  assert.ok(!fs.existsSync(path.join(path.dirname(ws), "escape.txt")));

  r = await runTool(ws, "read_file", { path: ".env" });
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.output, /hidden/);
  r = await runTool(ws, "search_files", { query: "hidden" });
  assert.doesNotMatch(r.output, /KEY=/);

  r = await runTool(ws, "run_command", { command: "node -e \"console.log(6*7)\"" });
  assert.ok(r.ok, r.output);
  assert.match(r.output, /42/);
  r = await runTool(ws, "run_command", { command: "node -e \"process.exit(3)\"" });
  assert.equal(r.ok, false);
  assert.match(r.output, /Exit code 3/);
  r = await runTool(ws, "run_command", { command: "echo hi", cwd: ".." });
  assert.equal(r.ok, false);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 500);
  const started = Date.now();
  r = await runTool(ws, "run_command", { command: "node -e \"setTimeout(()=>{}, 60000)\"" }, { signal: controller.signal });
  assert.match(r.output, /Stopped by the user/);
  assert.ok(Date.now() - started < 10000);

  console.log("All tool checks passed.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
