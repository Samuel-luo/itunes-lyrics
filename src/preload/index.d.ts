import { ElectronAPI } from '@electron-toolkit/preload'

export interface CurrentMusic {
  name: string // 歌曲名称
  artist: string // 歌手
  album: string // 专辑
  duration: number // 歌曲时长
  elapsedTime: number // 已播放时间
  remainingTime: number // 剩余时间
}

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
