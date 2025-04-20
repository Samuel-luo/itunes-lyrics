import { ipcMain } from "electron";
const lyricsSearcher = require("lyrics-searcher");

import type { CurrentMusic } from "./itunes-listener";

const fetchLyricsHandler = () => {
  ipcMain.handle("fetch-lyrics", async (event, music: CurrentMusic) => {
    try {
      console.log("fetch", music.artist, music.name);
      const res = (await lyricsSearcher(music.artist, music.name)) || null;
      console.log("res", res);
      return res;
    } catch (err) {
      console.error(err);
      return null;
    }
  });
};

export default fetchLyricsHandler;
