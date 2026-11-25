// Arvo desktop: the Electron main process. It owns the window, the settings
// file and the coding session, and runs the agent loop (agent.cjs) so the
// tools can use this computer's files and shell.

const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
const { stopBackground } = require("./tools.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { runTurn } = require("./agent.cjs");
const { normalizeMode } = require("./permissions.cjs");
const chats = require("./chats.cjs");

// Updates come from the GitHub releases of this repository (see "publish" in
// package.json). They download in the background; the window shows an
// Update button once one is ready.
let update = { status: "none" };
function setUpdate(value) {
  update = value;
  send({ type: "update", state: update });
}

function startUpdater() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("download-progress", (p) => {
    setUpdate({ status: "downloading", version: update.version || "", percent: Math.round(p.percent || 0) });
  });
  autoUpdater.on("update-available", (info) => setUpdate({ status: "downloading", version: info.version, percent: 0 }));
  autoUpdater.on("update-downloaded", (info) => setUpdate({ status: "ready", version: info.version }));
  autoUpdater.on("error", (err) => {
    console.warn("Update check failed:", err?.message);
    if (update.status === "downloading") setUpdate({ status: "none" });
  });
  // Check at start, every 30 minutes, and when the user comes back to the
  // window (at most every 10 minutes), so a new version shows up quickly.
  let lastCheck = 0;
  const check = () => {
    if (update.status === "downloading" || update.status === "ready") return;
    lastCheck = Date.now();
    autoUpdater.checkForUpdates().catch(() => {});
  };
  check();
  setInterval(check, 30 * 60 * 1000);
  app.on("browser-window-focus", () => {
    if (Date.now() - lastCheck > 10 * 60 * 1000) check();
  });
  ipcMain.handle("update:install", () => {
    if (update.status !== "ready") return;
    stopRunning();
    autoUpdater.quitAndInstall(false, true);
  });
}

ipcMain.handle("update:status", () => update);

const DEFAULT_API_URL = "https://mellow-flexibility-production-e36fe4b6.up.railway.app";

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = { apiUrl: DEFAULT_API_URL, email: "", model: "arvo-1.0", approvalMode: "auto", bypassEnabled: false, recentWorkspaces: [] };

function loadSettings() {
  try {
    const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
    // Before modes existed, "auto" meant never ask; that is now Bypass.
    if (saved.approvalMode === "auto" && !saved.modesV2) saved.approvalMode = "bypass";
    if (saved.approvalMode === "bypass") saved.bypassEnabled = true;
    saved.approvalMode = normalizeMode(saved.approvalMode);
    saved.modesV2 = true;
    return saved;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(value) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(value, null, 2));
}

let settings;
let win;
const session = { workspace: null, chatId: null, messages: [], alwaysAllow: new Set() };
let running = null; // AbortController of the request in progress
const pendingApprovals = new Map(); // tool call id -> resolve

function send(event) {
  if (win && !win.isDestroyed()) win.webContents.send("agent:event", event);
}

function apiUrl() {
  return (settings.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
}

function setWorkspace(folder) {
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return null;
  session.workspace = folder;
  session.chatId = chats.newId();
  session.messages = [];
  session.alwaysAllow = new Set();
  settings.recentWorkspaces = [folder, ...settings.recentWorkspaces.filter((f) => f !== folder)].slice(0, 8);
  saveSettings(settings);
  return { path: folder, name: path.basename(folder) };
}

function stopRunning() {
  running?.abort();
  for (const resolve of pendingApprovals.values()) resolve("deny");
  pendingApprovals.clear();
}

ipcMain.handle("clipboard:write", (_e, text) => clipboard.writeText(String(text ?? "")));
ipcMain.handle("settings:get", () => ({ ...settings, defaultApiUrl: DEFAULT_API_URL }));

ipcMain.handle("settings:set", (_e, patch) => {
  const allowed = ["apiUrl", "email", "model", "approvalMode"];
  for (const key of allowed) if (key in patch) settings[key] = String(patch[key] ?? "").trim();
  if ("bypassEnabled" in patch) settings.bypassEnabled = Boolean(patch.bypassEnabled);
  settings.approvalMode = normalizeMode(settings.approvalMode);
  if (settings.approvalMode === "bypass" && !settings.bypassEnabled) settings.approvalMode = "auto";
  saveSettings(settings);
  return settings;
});

ipcMain.handle("workspace:pick", async () => {
  const result = await dialog.showOpenDialog(win, { title: "Choose a project folder for Arvo", properties: ["openDirectory", "createDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  return setWorkspace(result.filePaths[0]);
});

ipcMain.handle("workspace:current", () =>
  session.workspace ? { path: session.workspace, name: path.basename(session.workspace) } : null
);

ipcMain.handle("workspace:open", (_e, folder) => setWorkspace(folder));

ipcMain.handle("workspace:reveal", () => {
  if (session.workspace) shell.openPath(session.workspace);
});

ipcMain.handle("models:get", async () => {
  try {
    const r = await fetch(`${apiUrl()}/models`, {
      headers: settings.email ? { "X-User-Email": settings.email } : {},
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return null;
  }
});

ipcMain.handle("chat:new", () => {
  stopRunning();
  session.chatId = chats.newId();
  session.messages = [];
  session.alwaysAllow = new Set();
});

// The window sends what it shows after each request; save it with what the
// model saw so the chat can be reopened and continued.
ipcMain.handle("chat:save", (_e, items) => {
  if (session.workspace && session.chatId && Array.isArray(items)) {
    chats.save(session.chatId, session.workspace, items, session.messages);
  }
});

ipcMain.handle("chat:list", () => (session.workspace ? chats.list(session.workspace) : []));

ipcMain.handle("chat:open", (_e, id) => {
  const chat = chats.load(id);
  if (!chat || chat.workspace !== session.workspace) return null;
  stopRunning();
  session.chatId = chat.id;
  session.messages = chat.messages || [];
  session.alwaysAllow = new Set();
  return { id: chat.id, items: chat.items || [] };
});

ipcMain.handle("chat:delete", (_e, id) => {
  chats.remove(id);
  if (id === session.chatId) {
    session.chatId = chats.newId();
    session.messages = [];
  }
});

ipcMain.handle("chat:stop", () => stopRunning());

ipcMain.handle("approval:respond", (_e, id, decision) => {
  pendingApprovals.get(id)?.(["allow", "always", "deny"].includes(decision) ? decision : "deny");
  pendingApprovals.delete(id);
});

ipcMain.handle("chat:send", async (_e, text) => {
  if (!session.workspace) return { error: "Choose a project folder first." };
  if (running) return { error: "Arvo is still working on the last message." };
  running = new AbortController();
  const signal = running.signal;
  send({ type: "busy", busy: true });
  try {
    await runTurn({
      session,
      text: String(text),
      settings: { apiUrl: apiUrl(), email: settings.email, model: settings.model, getMode: () => settings.approvalMode },
      emit: send,
      approve: (request) =>
        new Promise((resolve) => {
          pendingApprovals.set(request.id, resolve);
          send({ type: "approval", ...request });
        }),
      signal,
    });
    // In plan mode the answer is a plan; offer to approve it.
    const last = session.messages[session.messages.length - 1];
    if (!signal.aborted && settings.approvalMode === "plan" && last?.role === "assistant" && last.content) {
      send({ type: "plan_ready" });
    }
  } catch (err) {
    if (!signal.aborted) send({ type: "error", message: err.message || "Something went wrong." });
    // Leave the conversation in a state the model accepts: drop a trailing
    // assistant message whose tool calls never got results.
    const last = session.messages[session.messages.length - 1];
    if (last?.role === "user" && !signal.aborted) session.messages.pop();
  } finally {
    running = null;
    if (signal.aborted) send({ type: "stopped" });
    send({ type: "busy", busy: false });
  }
  return { ok: true };
});

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0b0c0f",
    title: "Arvo",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Links open in the normal browser; the window itself never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // Development only: ARVO_SCREENSHOT=out.png saves a picture of the window
  // (after running ARVO_TEST_JS in the page, if set) and quits.
  if (!app.isPackaged && process.env.ARVO_SCREENSHOT) {
    win.webContents.once("did-finish-load", async () => {
      if (process.env.ARVO_TEST_JS) {
        try {
          await win.webContents.executeJavaScript(fs.readFileSync(process.env.ARVO_TEST_JS, "utf8"));
        } catch (err) {
          console.error("test script failed:", err.message);
        }
      }
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(process.env.ARVO_SCREENSHOT, image.toPNG());
        app.quit();
      }, Number(process.env.ARVO_SCREENSHOT_DELAY || 1500));
    });
  }
}

// Development only: keep test runs out of the real settings.
if (!app.isPackaged && process.env.ARVO_USER_DATA) app.setPath("userData", process.env.ARVO_USER_DATA);

app.whenReady().then(() => {
  settings = loadSettings();
  chats.init(app.getPath("userData"));
  if (!app.isPackaged && process.env.ARVO_WORKSPACE) setWorkspace(process.env.ARVO_WORKSPACE);
  createWindow();
  startUpdater();
  if (!app.isPackaged && process.env.ARVO_FAKE_UPDATE) {
    // Development only: pretend an update is ready, to check the button.
    setTimeout(() => setUpdate({ status: "ready", version: process.env.ARVO_FAKE_UPDATE }), 300);
    ipcMain.handle("update:install", () => console.log("would install update"));
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopRunning();
  stopBackground();
  if (process.platform !== "darwin") app.quit();
});
