import { contextBridge, ipcRenderer } from "electron";

import type { IElectronAPI } from "./renderer/interface";

contextBridge.exposeInMainWorld("electronAPI", {
  sendWindowControl: (action) => ipcRenderer.send(action),
  onItunesMusicUpdate: (callback) => ipcRenderer.on("itunes-music-update", (_event, data) => callback(data)),
} as IElectronAPI);
