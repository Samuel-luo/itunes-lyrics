import { ipcMain } from "electron";

import type { BrowserWindow } from "electron";

const makeWindowControllable = (mainWindow: BrowserWindow) => {
  const closeHandler = () => {
    mainWindow.close();
  };

  const minimizeHandler = () => {
    mainWindow.minimize();
  };

  const maximizeHandler = () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  };

  // 添加窗口控制事件处理
  ipcMain.on("window-close", closeHandler);
  ipcMain.on("window-minimize", minimizeHandler);
  ipcMain.on("window-maximize", maximizeHandler);

  mainWindow.on("closed", () => {
    ipcMain.removeListener("window-close", closeHandler);
    ipcMain.removeListener("window-minimize", minimizeHandler);
    ipcMain.removeListener("window-maximize", maximizeHandler);
  });
};

export default makeWindowControllable;
