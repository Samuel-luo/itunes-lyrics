import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import makeWindowControllable from "./main/window-controls";
import listenItunes from "./main/itunes-listener";
import fetchLyricsHandler from "./main/lyrics-fetch";

console.log("hello");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  console.log("quit because of started");
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 110,
    minHeight: 110,
    frame: false,
    transparent: true,
    webPreferences: {
      experimentalFeatures: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.removeMenu();
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  mainWindow.webContents.on("did-finish-load", () => {
    makeWindowControllable(mainWindow);
    listenItunes(mainWindow);
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  console.log("ready");
  console.log("add lyrics fetcher");
  fetchLyricsHandler();
  console.log("create window");
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    console.log("quit because of no window");
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log("create window because of no window");
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
