import { CurrentMusic } from "@/main/itunes-listener";

export interface IElectronAPI {
  sendWindowControl: (action: string) => void;
  onItunesMusicUpdate: (callback: (data: { currentMusic: CurrentMusic | null; isPlaying: boolean }) => void) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
