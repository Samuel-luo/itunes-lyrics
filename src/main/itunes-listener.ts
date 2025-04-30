import iTunes from 'itunes-bridge'
import chalk from 'chalk'

import type { BrowserWindow } from 'electron'
import type { CurrentMusic } from '../preload/index.d'

export class MusicController {
  public currentMusic: CurrentMusic | null = null
  public isPlaying: boolean = false

  constructor(public mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  setCurrentMusic(track: any): void {
    this.currentMusic = track
      ? {
          name: track.name,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          elapsedTime: track.elapsedTime,
          remainingTime: track.remainingTime
        }
      : null

    console.log(
      chalk.yellow(
        track
          ? `✔ Set Current Music: ${track.name} - ${track.artist} (${(
              ((track.duration - track.remainingTime) * 100) /
              track.duration
            ).toFixed(2)}%)`
          : '✔ Clear Current Music'
      )
    )
  }

  play(): void {
    this.isPlaying = true
    console.log(chalk.green('▶ Playing'))
  }

  pause(): void {
    this.isPlaying = false
    console.log(chalk.blue('⏸ Paused'))
  }

  stop(): void {
    this.isPlaying = false
    console.log(chalk.red('⏹ Stopped'))
  }

  emit(): void {
    const data = {
      currentMusic: this.currentMusic,
      isPlaying: this.isPlaying
    }
    this.mainWindow.webContents.send('itunes-music-update', data)
  }
}

const iTunesEmitter = iTunes.emitter

const listenItunes = (mainWindow: BrowserWindow): MusicController => {
  const currentTrack = iTunes.getCurrentTrack()

  const musicController = new MusicController(mainWindow)

  const playingHandler = (_type: any, currentTrack: any): void => {
    musicController.setCurrentMusic(currentTrack)
    musicController.play()
    musicController.emit()
    // if (type === "player_state_change") {
    // } else if (type === "new_track") {
    // }
  }
  const pausedHandler = (): void => {
    musicController.pause()
    musicController.emit()
  }
  const stoppedHandler = (): void => {
    musicController.setCurrentMusic(null)
    musicController.stop()
    musicController.emit()
  }

  switch (currentTrack.playerState) {
    case 'playing': {
      playingHandler('new_track', currentTrack)
      break
    }
    case 'paused': {
      pausedHandler()
      break
    }
    case 'stopped': {
      stoppedHandler()
      break
    }
  }

  iTunesEmitter.on('playing', playingHandler)
  iTunesEmitter.on('paused', pausedHandler)
  iTunesEmitter.on('stopped', stoppedHandler)

  mainWindow.on('closed', () => {
    iTunesEmitter.removeListener('playing', playingHandler)
    iTunesEmitter.removeListener('paused', pausedHandler)
    iTunesEmitter.removeListener('stopped', stoppedHandler)
  })

  return musicController
}

export default listenItunes
