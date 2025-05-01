import { ipcMain } from 'electron'
import { searchLyrics } from '@spicysparks/lrc-api'

const fetchLyricsHandler = (): void => {
  ipcMain.handle('fetch-lyrics', async (_event, music: CurrentMusic) => {
    try {
      return await searchLyrics(music.name, music.artist)
    } catch (err) {
      console.error(err)
      return { success: false }
    }
  })
}

export default fetchLyricsHandler
