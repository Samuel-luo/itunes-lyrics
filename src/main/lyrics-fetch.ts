import { ipcMain } from 'electron'
import { searchLyrics } from '@spicysparks/lrc-api'
import axios from 'axios'

type LyricsResponse =
  | {
      success: true
      lyrics: string
    }
  | { success: false }

const fetchLyricsWithLyricsApi = async (music: CurrentMusic): Promise<LyricsResponse> => {
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

const lyricsFullSearch = async (music: CurrentMusic): Promise<string[]> => {
  const services = [
    [fetchLyricsWithLyricsApi],
    [searchLyrics, (music: CurrentMusic) => [music.name, music.artist]]
  ] as const

  return (
    await Promise.all(
      services.map(async (service) => {
        try {
          return await service[0].apply(
            null,
            (service[1] || ((music: CurrentMusic) => [music]))?.(music)
          )
        } catch (err) {
          console.error(err)
          return { success: false }
        }
      })
    )
  )
    .filter((result: LyricsResponse) => result.success)
    .map((result) => result.lyrics)
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
