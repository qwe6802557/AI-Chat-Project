import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 获取当前文件的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 进程环境变量
process.env.APP_ROOT = path.join(__dirname, '..')

// 开发环境使用 Vite 的开发服务器地址，生产环境使用本地文件
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// 设置应用的用户数据路径
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

/**
 * 创建浏览器窗口
 */
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // 安全设置
      nodeIntegration: false,
      contextIsolation: true,
      // 允许在渲染进程中使用 Web API
      webSecurity: true,
    },
    // 窗口样式
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff',
    show: false, // 先隐藏窗口，等待加载完成后再显示
  })

  // 窗口准备好后显示（避免白屏闪烁）
  win.once('ready-to-show', () => {
    win?.show()
  })

  // 在开发环境中打开开发者工具
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // 生产环境加载本地文件
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 拦截新窗口打开，使用默认浏览器打开外部链接
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 窗口关闭时的处理
  win.on('closed', () => {
    win = null
  })
}

/**
 * 应用准备就绪
 */
app.whenReady().then(() => {
  createWindow()

  // macOS 特殊处理：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

/**
 * 所有窗口关闭时退出应用（macOS 除外）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

/**
 * 应用退出前的清理工作
 */
app.on('before-quit', () => {
  // 退出前的清理逻辑
})

