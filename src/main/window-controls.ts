import { ipcMain } from 'electron'

import type { BrowserWindow } from 'electron'

const makeWindowControllable = (mainWindow: BrowserWindow): void => {
  const closeHandler = (): void => {
    mainWindow.close()
  }

  const minimizeHandler = (): void => {
    mainWindow.minimize()
  }

  const maximizeHandler = (): void => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }

  // 添加窗口控制事件处理
  ipcMain.on('window-close', closeHandler)
  ipcMain.on('window-minimize', minimizeHandler)
  ipcMain.on('window-maximize', maximizeHandler)

  mainWindow.on('closed', () => {
    ipcMain.removeListener('window-close', closeHandler)
    ipcMain.removeListener('window-minimize', minimizeHandler)
    ipcMain.removeListener('window-maximize', maximizeHandler)
  })
}

export default makeWindowControllable
