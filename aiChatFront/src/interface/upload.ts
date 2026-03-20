import type { AttachmentType } from './conversation'

/**
 * 文件数据接口（兼容旧版 base64 方式）
 */
export interface FileData {
  base64: string
  type: string
  name: string
}

/**
 * 服务端上传文件信息
 */
export interface ServerFileInfo {
  id: string
  url: string
  name: string
  type: string
}

/**
 * 上传文件条目
 */
export interface UploadedFile {
  id: string
  file: File
  preview: string
  base64: string
  type: AttachmentType
  name: string
  size: number
  status: 'processing' | 'uploading' | 'uploaded' | 'error'
  error?: string
  serverId?: string
  serverUrl?: string
}

/**
 * 文件上传 Hook 配置
 */
export interface UseFileUploadOptions {
  maxSize?: number
  maxCount?: number
  allowedTypes?: string[]
  autoCompress?: boolean
  compressThreshold?: number
  compressQuality?: number
}
