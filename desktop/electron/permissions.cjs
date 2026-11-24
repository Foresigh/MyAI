// Decides, for each tool call, whether Arvo may go ahead, must ask the user
// first, or isn't allowed in the current mode.
//
// Modes:
//   auto    Arvo decides: reading and editing project files is fine, and so
//           are everyday commands; anything risky still asks.
//   manual  Always ask before changing files or running commands.
//   edits   Accept file edits automatically; ask before commands.
//   plan    Look around only, then propose a plan. No edits or commands.
//   bypass  Never ask.

const MODES = ["auto", "manual", "edits", "plan", "bypass"];

// Old settings used "ask" and "auto" (which meant "never ask").
function normalizeMode(mode) {
  if (mode === "ask") return "manual";
  return MODES.includes(mode) ? mode : "auto";
}

const RISKY = [
  [/\b(rm|rmdir|del|erase|rd|rimraf|shred|unlink)\b|remove-item|\bri\b|git\s+clean/i, "it deletes files"],
  [/git\s+(push|reset\s+--hard|rebase|filter-branch|checkout\s+--|restore\b|branch\s+-D|stash\s+(drop|clear))/i, "it changes git history or your remote repository"],
  [/\b(npm|yarn|pnpm|bun)\s+publish\b|twine\s+upload|eas\s+(submit|update)|docker\s+push|\bgh\s+\w+\s+(create|delete|merge|edit)|vercel\b.*--prod|railway\s+up/i, "it publishes or deploys something"],
  [/\b(shutdown|restart-computer|stop-computer|format|diskpart|mkfs|reboot)\b|\bdd\s+if=|\breg\s+(add|delete)\b|set-executionpolicy|\bsudo\b|\brunas\b|\bchown\b|chmod\s+-R/i, "it changes system settings"],
  [/\b(curl|wget|iwr|invoke-webrequest|irm|invoke-restmethod)\b[^|]*\|\s*(sh|bash|zsh|iex|invoke-expression|python|node)\b|invoke-expression|\biex\b/i, "it runs code downloaded from the internet"],
  [/\.env\b|\benv:|\bprintenv\b|\bset\s*$|get-childitem\s+env|\bexport\s+-p\b/i, "it could show secret keys"],
  [/\b(taskkill|stop-process|pkill|killall)\b|\bkill\s+-9\b/i, "it stops other programs"],
  [/\b(npm|pnpm|yarn)\s+(i|install|add)\b.*(-g\b|--global)|\bnpm\s+-g\b|choco\s+install|winget\s+install|brew\s+install|apt(-get)?\s+install/i, "it installs software for the whole computer"],
  [/(^|[\s"'=(])([A-Za-z]:[\\/]|~[\\/]|\/(etc|usr|bin|var|System|Library)\b|\$env:(USERPROFILE|APPDATA|HOME)|\.\.[\\/])/, "it uses files outside this project"],
];

/** Why a command is risky, or null if it looks like everyday work. */
function commandRisk(command) {
  for (const [pattern, reason] of RISKY) if (pattern.test(command)) return reason;
  return null;
}

/**
 * kind: undefined for read-only tools, "edit" or "command".
 * Returns { action: "allow" | "ask" | "block", reason? }.
 */
function decide(mode, kind, args, alwaysAllow) {
  if (!kind) return { action: "allow" };
  mode = normalizeMode(mode);
  if (mode === "plan") {
    return { action: "block", reason: "Plan mode is on, so Arvo can only look at the project. Write the plan; the user will approve it before any changes." };
  }
  if (mode === "bypass") return { action: "allow" };
  if (alwaysAllow.has(kind)) return { action: "allow" };
  if (mode === "manual") return { action: "ask" };
  if (kind === "edit") return { action: mode === "edits" || mode === "auto" ? "allow" : "ask" };
  // Commands.
  if (mode === "auto") {
    const risk = commandRisk(String(args.command || ""));
    return risk ? { action: "ask", reason: `Auto mode is asking because ${risk}.` } : { action: "allow" };
  }
  return { action: "ask" };
}

module.exports = { MODES, normalizeMode, decide, commandRisk };
