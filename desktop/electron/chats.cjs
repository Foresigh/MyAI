// Saved chats, so "New chat" never loses a conversation. Each chat is one
// JSON file in the app's data folder, holding what the window shows (items)
// and what the model saw (messages).

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_CHATS = 50;
let dir = null;

function init(userDataDir) {
  dir = path.join(userDataDir, "chats");
  fs.mkdirSync(dir, { recursive: true });
}

const newId = () => crypto.randomBytes(8).toString("hex");
const fileFor = (id) => (/^[a-f0-9]{16}$/.test(id) ? path.join(dir, `${id}.json`) : null);

function titleFrom(items) {
  const first = items.find((it) => it.kind === "user");
  const text = (first?.text || "New chat").replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function save(id, workspace, items, messages) {
  const file = fileFor(id);
  if (!file || !items.some((it) => it.kind === "user")) return;
  const chat = { id, workspace, title: titleFrom(items), updatedAt: Date.now(), items, messages };
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(chat));
  fs.renameSync(tmp, file);
  prune();
}

function readAll() {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function list(workspace) {
  return readAll()
    .filter((c) => c.workspace === workspace)
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

function load(id) {
  const file = fileFor(id);
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function remove(id) {
  const file = fileFor(id);
  if (file && fs.existsSync(file)) fs.rmSync(file);
}

function prune() {
  for (const chat of readAll().slice(MAX_CHATS)) remove(chat.id);
}

module.exports = { init, newId, save, list, load, remove };
