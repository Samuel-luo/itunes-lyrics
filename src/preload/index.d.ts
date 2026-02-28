import { ElectronAPI } from '@electron-toolkit/preload'

export interface IElectronAPI extends ElectronAPI {
  sendWindowControl: (action: string) => void
  onItunesMusicUpdate: (
    callback: (data: { currentMusic: CurrentMusic | null; isPlaying: boolean }) => void
  ) => void
  onItunesTimeCalibrate: (callback: (data: { elapsedTime: number }) => void) => void
  fetchLyrics: (music: CurrentMusic) => Promise<Lyrics>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
