export { CurrentMusic } from "@/main/itunes-listener";

export interface IElectronAPI {
  sendWindowControl: (action: string) => void;
  onItunesMusicUpdate: (callback: (data: { currentMusic: CurrentMusic | null; isPlaying: boolean }) => void) => void;
  fetchLyrics: (music: CurrentMusic) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
