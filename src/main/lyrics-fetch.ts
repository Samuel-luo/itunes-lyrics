import { ipcMain } from "electron";
const { searchLyrics } = require("@spicysparks/lrc-api");

import type { CurrentMusic } from "./itunes-listener";

const fetchLyricsHandler = () => {
  ipcMain.handle("fetch-lyrics", async (event, music: CurrentMusic) => {
    try {
      return await searchLyrics(music.name, music.artist);
    } catch (err) {
      console.error(err);
      return { success: false };
    }
  });
};

export default fetchLyricsHandler;
