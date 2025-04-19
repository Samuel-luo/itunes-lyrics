const iTunes = require("itunes-bridge");
import chalk from "chalk";

import type { BrowserWindow } from "electron";
export interface CurrentMusic {
  name: string; // 歌曲名称
  artist: string; // 歌手
  album: string; // 专辑
  duration: number; // 歌曲时长
  remainingTime: number; // 剩余时间
}

export class MusicController {
  public currentMusic: CurrentMusic | null;
  public isPlaying: boolean = false;

  constructor(public mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  setCurrentMusic(track: any) {
    this.currentMusic = track
      ? {
          name: track.name,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          remainingTime: track.remainingTime,
        }
      : null;

    console.log(
      chalk.yellow(
        track
          ? `✔ Set Current Music: ${track.name} - ${track.artist} (${(
              ((track.duration - track.remainingTime) * 100) /
              track.duration
            ).toFixed(2)}%)`
          : "✔ Clear Current Music"
      )
    );
  }

  play() {
    this.isPlaying = true;
    console.log(chalk.green("▶ Playing"));
  }

  pause() {
    this.isPlaying = false;
    console.log(chalk.blue("⏸ Paused"));
  }

  stop() {
    this.isPlaying = false;
    console.log(chalk.red("⏹ Stopped"));
  }

  emit() {
    const data = {
      currentMusic: this.currentMusic,
      isPlaying: this.isPlaying,
    };
    this.mainWindow.webContents.send("itunes-music-update", data);
  }
}

const listenItunes = (mainWindow: BrowserWindow) => {
  const currentTrack = iTunes.getCurrentTrack();
  const iTunesEmitter = iTunes.emitter;
  const musicController = new MusicController(mainWindow);

  const playingHandler = (type: any, currentTrack: any) => {
    musicController.setCurrentMusic(currentTrack);
    musicController.play();
    musicController.emit();
    // if (type === "player_state_change") {
    // } else if (type === "new_track") {
    // }
  };
  const pausedHandler = () => {
    musicController.pause();
    musicController.emit();
  };
  const stoppedHandler = () => {
    musicController.setCurrentMusic(null);
    musicController.stop();
    musicController.emit();
  };

  switch (currentTrack.playerState) {
    case "playing": {
      playingHandler("new_track", currentTrack);
      break;
    }
    case "paused": {
      pausedHandler();
      break;
    }
    case "stopped": {
      stoppedHandler();
      break;
    }
  }

  iTunesEmitter.on("playing", playingHandler);
  iTunesEmitter.on("paused", pausedHandler);
  iTunesEmitter.on("stopped", stoppedHandler);

  mainWindow.on("closed", () => {
    iTunesEmitter.removeListener("playing", playingHandler);
    iTunesEmitter.removeListener("paused", pausedHandler);
    iTunesEmitter.removeListener("stopped", stoppedHandler);
  });

  return musicController;
};

export default listenItunes;
