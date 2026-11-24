// Arvo desktop: the Electron main process. It owns the window, the settings
// file and the coding session, and runs the agent loop (agent.cjs) so the
// tools can use this computer's files and shell.

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { runTurn } = require("./agent.cjs");

const DEFAULT_API_URL = "https://mellow-flexibility-production-e36fe4b6.up.railway.app";

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = { apiUrl: DEFAULT_API_URL, email: "", model: "arvo-1.0", approvalMode: "ask", recentWorkspaces: [] };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
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
const session = { workspace: null, messages: [], alwaysAllow: new Set() };
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

ipcMain.handle("settings:get", () => ({ ...settings, defaultApiUrl: DEFAULT_API_URL }));

ipcMain.handle("settings:set", (_e, patch) => {
  const allowed = ["apiUrl", "email", "model", "approvalMode"];
  for (const key of allowed) if (key in patch) settings[key] = String(patch[key] ?? "").trim();
  if (!["ask", "edits", "auto"].includes(settings.approvalMode)) settings.approvalMode = "ask";
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
  session.messages = [];
  session.alwaysAllow = new Set();
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
      settings: { apiUrl: apiUrl(), email: settings.email, model: settings.model, approvalMode: settings.approvalMode },
      emit: send,
      approve: (request) =>
        new Promise((resolve) => {
          pendingApprovals.set(request.id, resolve);
          send({ type: "approval", ...request });
        }),
      signal,
    });
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

app.whenReady().then(() => {
  settings = loadSettings();
  if (!app.isPackaged && process.env.ARVO_WORKSPACE) setWorkspace(process.env.ARVO_WORKSPACE);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopRunning();
  if (process.platform !== "darwin") app.quit();
});
