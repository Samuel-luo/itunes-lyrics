import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type { CurrentMusic } from './index.d'

// Custom APIs for renderer
const customAPI = {
  sendWindowControl: (action) => ipcRenderer.send(action),
  onItunesMusicUpdate: (callback) =>
    ipcRenderer.on('itunes-music-update', (_event, data) => callback(data)),
  fetchLyrics: (music: CurrentMusic) => ipcRenderer.invoke('fetch-lyrics', music)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', { ...electronAPI, ...customAPI })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = electronAPI
}
