import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload 脚本
 *
 * 该脚本在渲染进程加载之前运行，可以安全地暴露 Node.js API 给渲染进程
 * 通过 contextBridge 暴露的 API 可以在渲染进程中通过 window.electronAPI 访问
 */

// 暴露给渲染进程的 API
const electronAPI = {
  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // IPC 通信示例
  // 发送消息到主进程
  sendMessage: (channel: string, data: any) => {
    // 白名单验证，只允许特定的频道
    const validChannels = ['message-from-renderer', 'app-info', 'window-control']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // 接收来自主进程的消息
  onMessage: (channel: string, callback: (data: any) => void) => {
    const validChannels = ['message-from-main', 'app-update']
    if (validChannels.includes(channel)) {
      // 移除旧的监听器，避免重复
      ipcRenderer.removeAllListeners(channel)
      ipcRenderer.on(channel, (_event, data) => callback(data))
    }
  },

  // 调用主进程方法并等待返回
  invoke: async (channel: string, data?: any) => {
    const validChannels = ['get-app-path', 'read-file', 'write-file']
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data)
    }
    return null
  },
}

// 类型声明（可选，用于 TypeScript 支持）
export type ElectronAPI = typeof electronAPI

// 将 API 暴露到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 在开发环境中输出日志
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded')
  console.log('Electron API exposed:', Object.keys(electronAPI))
}

