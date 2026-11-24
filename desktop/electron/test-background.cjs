// Checks background commands: node electron/test-background.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runTool, stopBackground } = require("./tools.cjs");

(async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "arvo-bg-"));
  const started = Date.now();
  let r = await runTool(ws, "run_command", {
    command: "node -e \"console.log('server ready'); setInterval(()=>{}, 1000)\"",
    background: true,
  });
  const took = Date.now() - started;
  assert.ok(r.ok, r.output);
  assert.match(r.output, /server ready/);
  assert.match(r.output, /Still running in the background/);
  assert.ok(took < 15000, `returned after ${took}ms`);

  // A program that fails at once is reported as a failure, not as running.
  r = await runTool(ws, "run_command", { command: "node -e \"process.exit(4)\"", background: true });
  assert.equal(r.ok, false);
  assert.match(r.output, /Exit code 4/);

  stopBackground();
  console.log("Background checks passed.");
  setTimeout(() => process.exit(0), 500);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
