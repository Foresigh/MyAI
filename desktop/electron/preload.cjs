// The only bridge between the window and the computer. The page gets these
// few functions and nothing else (no Node, no direct file access).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arvo", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  pickWorkspace: () => ipcRenderer.invoke("workspace:pick"),
  currentWorkspace: () => ipcRenderer.invoke("workspace:current"),
  openWorkspace: (folder) => ipcRenderer.invoke("workspace:open", folder),
  revealWorkspace: () => ipcRenderer.invoke("workspace:reveal"),
  getModels: () => ipcRenderer.invoke("models:get"),
  send: (text) => ipcRenderer.invoke("chat:send", text),
  stop: () => ipcRenderer.invoke("chat:stop"),
  newChat: () => ipcRenderer.invoke("chat:new"),
  respondApproval: (id, decision) => ipcRenderer.invoke("approval:respond", id, decision),
  onEvent: (callback) => {
    const listener = (_e, event) => callback(event);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
});
