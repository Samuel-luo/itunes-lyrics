import { ipcMain } from 'electron'
import { searchLyrics } from '@spicysparks/lrc-api'
import axios from 'axios'

const fetchLyricsWithLyricsApi = async (music: CurrentMusic): Promise<Lyrics> => {
  try {
    const lyrics = await axios.get('https://api.lrc.cx/lyrics', {
      params: {
        title: music.name,
        artist: music.artist,
        album: music.album
      }
    })
    return { success: true, lyrics: lyrics.data }
  } catch (err) {
    console.error(err)
    return { success: false }
  }
}

const lyricsFullSearch = async (music: CurrentMusic): Promise<Lyrics> => {
  const services = [
    [fetchLyricsWithLyricsApi],
    [searchLyrics, (music: CurrentMusic) => [music.name, music.artist]]
  ] as const

  for (const service of services) {
    try {
      return await service[0].apply(
        null,
        (service[1] || ((music: CurrentMusic) => [music]))?.(music)
      )
    } catch (err) {
      console.error(err)
    }
  }

  return { success: false }
}

const fetchLyricsHandler = (): void => {
  ipcMain.handle('fetch-lyrics', async (_event, music: CurrentMusic) => {
    try {
      return await lyricsFullSearch(music)
    } catch (err) {
      console.error(err)
      return { success: false }
    }
  })
}

export default fetchLyricsHandler
