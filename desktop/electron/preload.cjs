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
  saveChat: (items) => ipcRenderer.invoke("chat:save", items),
  listChats: () => ipcRenderer.invoke("chat:list"),
  openChat: (id) => ipcRenderer.invoke("chat:open", id),
  deleteChat: (id) => ipcRenderer.invoke("chat:delete", id),
  respondApproval: (id, decision) => ipcRenderer.invoke("approval:respond", id, decision),
  getUpdate: () => ipcRenderer.invoke("update:status"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  onEvent: (callback) => {
    const listener = (_e, event) => callback(event);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
});
