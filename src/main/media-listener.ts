import { execFile } from 'child_process'
import { promisify } from 'util'
import chalk from 'chalk'

import type { BrowserWindow } from 'electron'

const execFileAsync = promisify(execFile)

// 轮询间隔（毫秒）：检测播放状态变化 & 校准
const POLL_INTERVAL = 1000

/**
 * 内联 JXA 脚本：通过 macOS 私有 MediaRemote 框架获取系统级 Now Playing 信息
 * 适用于所有音乐播放器（Music、Spotify、Chrome、Safari 等）
 * 兼容 macOS 15.4+
 *
 * 使用 calculatedPlaybackPosition 获取精确的浮点数播放位置，无截断误差
 */
const JXA_SCRIPT = `
ObjC.import('Foundation');
function run() {
  try {
    var MR = $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/MediaRemote.framework/');
    MR.load;
    var Req = $.NSClassFromString('MRNowPlayingRequest');
    var item = Req.localNowPlayingItem;
    if (!item) return JSON.stringify({playerState:'stopped'});
    var info = item.nowPlayingInfo;
    if (!info) return JSON.stringify({playerState:'stopped'});
    var title = info.valueForKey('kMRMediaRemoteNowPlayingInfoTitle');
    var artist = info.valueForKey('kMRMediaRemoteNowPlayingInfoArtist');
    var album = info.valueForKey('kMRMediaRemoteNowPlayingInfoAlbum');
    var dur = info.valueForKey('kMRMediaRemoteNowPlayingInfoDuration');
    var rate = info.valueForKey('kMRMediaRemoteNowPlayingInfoPlaybackRate');
    var meta = item.metadata;
    var elapsed = meta ? meta.calculatedPlaybackPosition : 0;
    var pp = Req.localNowPlayingPlayerPath;
    var app = (pp && pp.client) ? pp.client.displayName : '';
    return JSON.stringify({
      name: title ? title.js : '',
      artist: artist ? artist.js : '',
      album: album ? album.js : '',
      duration: dur ? Number(dur.js) : 0,
      elapsedTime: Number(elapsed),
      remainingTime: dur ? Number(dur.js) - Number(elapsed) : 0,
      playerState: (rate && Number(rate.js) > 0) ? 'playing' : 'paused',
      appName: app ? app.js : ''
    });
  } catch(e) {
    return JSON.stringify({playerState:'stopped',error:String(e)});
  }
}
`.trim()

interface NowPlayingInfo {
  name: string
  artist: string
  album: string
  duration: number
  elapsedTime: number
  remainingTime: number
  playerState: 'playing' | 'paused' | 'stopped'
  appName?: string
  error?: string
}

/**
 * 通过 JXA 调用 macOS MediaRemote 框架获取当前播放信息
 * 支持所有音乐播放器（Music、Spotify、Chrome 等）
 * 使用异步执行，不阻塞 Electron 主进程事件循环
 */
async function getNowPlaying(): Promise<{ info: NowPlayingInfo; scriptDuration: number }> {
  try {
    const before = Date.now()
    const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', JXA_SCRIPT], {
      timeout: 3000
    })
    const after = Date.now()
    const scriptDuration = (after - before) / 1000

    return {
      info: JSON.parse(stdout.trim()),
      scriptDuration
    }
  } catch {
    return {
      info: {
        name: '',
        artist: '',
        album: '',
        duration: 0,
        elapsedTime: 0,
        remainingTime: 0,
        playerState: 'stopped'
      },
      scriptDuration: 0
    }
  }
}

export class MusicController {
  public currentMusic: CurrentMusic | null = null
  public isPlaying: boolean = false
  private pollTimer: ReturnType<typeof globalThis.setInterval> | null = null
  private lastTrackId: string = '' // 用 name+artist+album 作为 track 唯一标识
  private polling: boolean = false // 防止并发轮询

  constructor(public mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  /**
   * 根据 NowPlayingInfo 生成 track 唯一标识
   */
  private getTrackId(info: NowPlayingInfo): string {
    return `${info.name}|${info.artist}|${info.album}`
  }

  /**
   * 启动轮询，检测播放状态和曲目变化
   */
  startPolling(): void {
    this.stopPolling()

    // 先获取一次当前状态
    this.poll()

    this.pollTimer = globalThis.setInterval(() => {
      this.poll()
    }, POLL_INTERVAL)
  }

  /**
   * 单次轮询逻辑（异步，不阻塞主进程）
   */
  private async poll(): Promise<void> {
    // 如果上一次轮询还没完成，跳过
    if (this.polling) return
    this.polling = true

    try {
      const { info, scriptDuration } = await getNowPlaying()

      // 补偿 osascript 执行耗时的一半（此时歌曲实际又播放了一段时间）
      const compensatedElapsedTime = info.elapsedTime + scriptDuration / 2

      const trackId = this.getTrackId(info)
      const isStopped = info.playerState === 'stopped'
      const wasPlaying = this.isPlaying
      const trackChanged = trackId !== this.lastTrackId && !isStopped

      if (isStopped) {
        if (this.currentMusic !== null || this.isPlaying) {
          this.currentMusic = null
          this.isPlaying = false
          this.lastTrackId = ''
          console.log(chalk.red('⏹ Stopped'))
          this.emit()
        }
        return
      }

      const isNowPlaying = info.playerState === 'playing'

      if (trackChanged) {
        // 曲目变化
        this.lastTrackId = trackId
        this.currentMusic = {
          name: info.name,
          artist: info.artist,
          album: info.album,
          duration: info.duration,
          elapsedTime: compensatedElapsedTime,
          remainingTime: info.remainingTime
        }
        this.isPlaying = isNowPlaying

        const appLabel = info.appName ? ` [${info.appName}]` : ''
        console.log(
          chalk.yellow(
            `✔ Now Playing: ${info.name} - ${info.artist}${appLabel} (${compensatedElapsedTime.toFixed(1)}s / ${info.duration.toFixed(0)}s)`
          )
        )
        if (isNowPlaying) {
          console.log(chalk.green('▶ Playing'))
        }
        this.emit()
        return
      }

      // 同一首歌，检查播放/暂停状态变化
      if (isNowPlaying !== wasPlaying) {
        this.isPlaying = isNowPlaying
        if (isNowPlaying) {
          // 恢复播放时更新 elapsedTime
          this.currentMusic = {
            ...this.currentMusic!,
            elapsedTime: compensatedElapsedTime,
            remainingTime: info.remainingTime
          }
          console.log(chalk.green('▶ Playing'))
        } else {
          console.log(chalk.blue('⏸ Paused'))
        }
        this.emit()
        return
      }

      // 正在播放中，发送校准事件（精确的 elapsedTime）
      if (isNowPlaying && this.currentMusic) {
        this.mainWindow.webContents.send('itunes-time-calibrate', {
          elapsedTime: compensatedElapsedTime
        })
        console.log(
          chalk.gray(
            `🔄 Calibrate: ${compensatedElapsedTime.toFixed(2)}s (script=${(scriptDuration * 1000).toFixed(0)}ms)`
          )
        )
      }
    } finally {
      this.polling = false
    }
  }

  emit(): void {
    const data = {
      currentMusic: this.currentMusic,
      isPlaying: this.isPlaying
    }
    this.mainWindow.webContents.send('itunes-music-update', data)
  }

  stopPolling(): void {
    if (this.pollTimer) {
      globalThis.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  destroy(): void {
    this.stopPolling()
  }
}

const listenMedia = (mainWindow: BrowserWindow): MusicController => {
  const musicController = new MusicController(mainWindow)
  musicController.startPolling()

  mainWindow.on('closed', () => {
    musicController.destroy()
  })

  return musicController
}

export default listenMedia
