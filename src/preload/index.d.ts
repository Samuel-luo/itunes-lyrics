import { ElectronAPI } from '@electron-toolkit/preload'

export interface IElectronAPI extends ElectronAPI {
  sendWindowControl: (action: string) => void
  onItunesMusicUpdate: (
    callback: (data: { currentMusic: CurrentMusic | null; isPlaying: boolean }) => void
  ) => void
  fetchLyrics: (
    music: CurrentMusic
  ) => Promise<{ success: true; lyrics: string } | { success: false }>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
