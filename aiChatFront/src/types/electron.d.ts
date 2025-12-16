/**
 * Electron API 类型声明
 * 
 * 这个文件定义了通过 preload 脚本暴露给渲染进程的 API 类型
 */

export interface ElectronAPI {
  // 平台信息
  platform: string

  // 版本信息
  versions: {
    node: string
    chrome: string
    electron: string
  }

  // IPC 通信
  sendMessage: (channel: string, data: any) => void
  onMessage: (channel: string, callback: (data: any) => void) => void
  invoke: (channel: string, data?: any) => Promise<any>
}

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}

