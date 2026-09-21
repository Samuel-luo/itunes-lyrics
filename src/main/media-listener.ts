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
    var meta = item.metadata;
    var pp = Req.localNowPlayingPlayerPath;
    var app = (pp && pp.client) ? pp.client.displayName : '';

    // 播放状态：优先取系统级 MRNowPlayingRequest.localIsPlaying（与控制中心一致），
    // 部分播放器暂停时不会更新 playbackRate，仅在该接口不可用时才回退到速率判断
    var isPlaying = null;
    try {
      var lip = Req.localIsPlaying;
      if (typeof lip === 'boolean') isPlaying = lip;
    } catch(e) {}
    if (isPlaying === null) {
      var rate = null;
      if (meta) {
        try { rate = Number(meta.playbackRate); } catch(e) {}
      }
      if (rate === null || isNaN(rate)) {
        var infoRate = info.valueForKey('kMRMediaRemoteNowPlayingInfoPlaybackRate');
        rate = infoRate ? Number(infoRate.js) : 0;
      }
      isPlaying = rate > 0;
    }

    // 播放位置：calculatedPlaybackPosition 在暂停时仍会随系统时间推进，
    // 因此暂停时改用播放器上报的静态 ElapsedTime
    var elapsed = 0;
    if (isPlaying && meta) {
      elapsed = Number(meta.calculatedPlaybackPosition);
    } else {
      var infoElapsed = info.valueForKey('kMRMediaRemoteNowPlayingInfoElapsedTime');
      elapsed = infoElapsed ? Number(infoElapsed.js) : (meta ? Number(meta.elapsedTime) : 0);
    }

    return JSON.stringify({
      name: title ? title.js : '',
      artist: artist ? artist.js : '',
      album: album ? album.js : '',
      duration: dur ? Number(dur.js) : 0,
      elapsedTime: elapsed,
      remainingTime: dur ? Number(dur.js) - elapsed : 0,
      playerState: isPlaying ? 'playing' : 'paused',
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
        playerState: 'stopped',
        appName: ''
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
      // 暂停时位置是静态值，无需补偿脚本耗时
      const elapsedTime = isNowPlaying ? compensatedElapsedTime : info.elapsedTime

      if (trackChanged) {
        // 曲目变化
        this.lastTrackId = trackId
        this.currentMusic = {
          name: info.name,
          artist: info.artist,
          album: info.album,
          duration: info.duration,
          elapsedTime,
          remainingTime: info.remainingTime,
          appName: info.appName
        }
        this.isPlaying = isNowPlaying

        const appLabel = info.appName ? ` [${info.appName}]` : ''
        console.log(
          chalk.yellow(
            `✔ Now Playing: ${info.name} - ${info.artist}${appLabel} (${elapsedTime.toFixed(1)}s / ${info.duration.toFixed(0)}s)`
          )
        )
        console.log(isNowPlaying ? chalk.green('▶ Playing') : chalk.blue('⏸ Paused'))
        this.emit()
        return
      }

      // 同一首歌，检查播放/暂停状态变化
      if (isNowPlaying !== wasPlaying) {
        this.isPlaying = isNowPlaying
        this.currentMusic = {
          ...this.currentMusic!,
          elapsedTime,
          remainingTime: info.remainingTime
        }
        console.log(isNowPlaying ? chalk.green('▶ Playing') : chalk.blue('⏸ Paused'))
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
