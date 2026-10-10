import { ref, computed, onBeforeUnmount, toRaw } from 'vue'
import { message } from 'ant-design-vue'
import { uploadFiles } from '@/api/chat'
import { getApiBaseUrl } from '@/utils/common'
import logger from '@/utils/logger'
import type { UploadedFile, UseFileUploadOptions, ServerFileInfo } from '@/interface/upload'

export type { UploadedFile, UseFileUploadOptions } from '@/interface/upload'

// 支持上传的图片 MIME 类型
export const IMAGE_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
] as const

// 支持上传的文档与代码 MIME 类型
export const DOCUMENT_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'application/x-yaml',
  'text/yaml',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/typescript',
] as const

// 支持上传的文档与代码扩展名
export const DOCUMENT_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.py',
  '.dart',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.sql',
  '.sh',
  '.html',
  '.css',
  '.scss',
  '.env',
] as const

export const CHAT_UPLOAD_ACCEPT = [
  ...IMAGE_UPLOAD_MIME_TYPES,
  ...DOCUMENT_UPLOAD_EXTENSIONS,
].join(',')

export const IMAGE_UPLOAD_ACCEPT = CHAT_UPLOAD_ACCEPT

/**
 * 提取小写文件扩展名（包含点号）
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex >= 0 ? filename.slice(lastDotIndex).toLowerCase() : ''
}

/**
 * 根据文件名与 MIME 推断附件展示类型
 */
export function resolveAttachmentType(
  file: Pick<File, 'name' | 'type'>
): UploadedFile['type'] {
  const mime = (file.type || '').toLowerCase()
  const ext = getFileExtension(file.name || '')

  if (IMAGE_UPLOAD_MIME_TYPES.includes(mime as (typeof IMAGE_UPLOAD_MIME_TYPES)[number])) {
    return 'image'
  }
  if (mime === 'application/pdf' || ext === '.pdf') {
    return 'pdf'
  }
  return 'document'
}

/**
 * 获取附件角标简称（如 PDF / DOCX / MD / TS）
 */
export function getAttachmentBadgeLabel(name: string, type?: string): string {
  const ext = getFileExtension(name).replace(/^\./, '').toUpperCase()
  if (ext) {
    if (ext === 'MARKDOWN') return 'MD'
    return ext.slice(0, 6)
  }
  if (type === 'pdf' || type === 'application/pdf') {
    return 'PDF'
  }
  return 'DOC'
}

/**
 * 文件上传 Hook
 *
 * @description 处理图片与多格式文档上传、验证、压缩，添加时自动上传到服务器
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxSize = 10 * 1024 * 1024,
    maxCount = 4,
    allowedTypes = [...IMAGE_UPLOAD_MIME_TYPES, ...DOCUMENT_UPLOAD_MIME_TYPES],
    allowedExtensions = [...DOCUMENT_UPLOAD_EXTENSIONS],
    autoCompress = true,
    compressThreshold = 2 * 1024 * 1024,
    compressQuality = 0.8
  } = options

  // 文件列表
  const files = ref<UploadedFile[]>([])

  // 计算属性
  const totalSize = computed(() =>
    files.value.reduce((sum, f) => sum + f.size, 0)
  )

  const hasFiles = computed(() => files.value.length > 0)

  // 是否有文件正在处理或上传中
  const isProcessing = computed(() =>
    files.value.some(f => f.status === 'processing' || f.status === 'uploading')
  )

  // 已上传到服务器的文件
  const uploadedFiles = computed(() =>
    files.value.filter(f => f.status === 'uploaded' && f.serverId)
  )

  // 是否所有文件都已上传完成（没有处理中/上传中的文件）
  const allUploaded = computed(() =>
    files.value.length > 0 && files.value.every(f => f.status === 'uploaded' || f.status === 'error')
  )

  // 是否可以发送（有已上传的文件，且没有正在处理/上传的文件）
  const canSendFiles = computed(() =>
    uploadedFiles.value.length > 0 && !isProcessing.value
  )

  /**
   * 验证文件
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (files.value.length >= maxCount) {
      return { valid: false, error: `最多只能上传 ${maxCount} 个文件` }
    }

    const mime = (file.type || '').toLowerCase()
    const ext = getFileExtension(file.name || '')
    const isAllowedMime = Boolean(mime) && allowedTypes.includes(mime)
    const isAllowedExt = Boolean(ext) && allowedExtensions.includes(ext)

    if (!isAllowedMime && !isAllowedExt) {
      return {
        valid: false,
        error: '不支持的文件格式，支持图片、PDF、Word (.docx)、Markdown、TXT、CSV、JSON 及常见代码文件'
      }
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      return { valid: false, error: `文件大小不能超过 ${maxSizeMB}MB` }
    }

    const isDuplicate = files.value.some(
      f => f.name === file.name && f.size === file.size
    )
    if (isDuplicate) {
      return { valid: false, error: '该文件已添加' }
    }

    return { valid: true }
  }

  /**
   * 压缩图片
   */
  const compressImage = (file: File, quality: number = compressQuality): Promise<File> => {
    return new Promise((resolve, reject) => {
      // 非图片或 GIF 不压缩，直接走原文件
      if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        resolve(file)
        return
      }

      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // 计算压缩后的尺寸-最大2048px
        let { width, height } = img
        const maxDimension = 2048

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        if (!ctx) {
          URL.revokeObjectURL(img.src)
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // 输出为 JPEG（压缩效果更好）或保持原格式
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src)

          if (!blob) {
            reject(new Error('图片压缩失败'))
            return
          }

          resolve(
            new File([blob], file.name, {
              type: blob.type,
              lastModified: file.lastModified,
            })
          )
        }, outputType, quality)
      }

      img.onerror = () => {
        URL.revokeObjectURL(img.src)
        reject(new Error('图片加载失败'))
      }

      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * 创建预览 URL
   */
  const createPreview = (file: File, type: UploadedFile['type']): string => {
    if (type === 'image') {
      return URL.createObjectURL(file)
    }
    // 非图片返回空字符串，组件中使用图标显示
    return ''
  }

  /**
   * 上传单个文件到服务器
   * @param fileId 文件的本地 ID（用于在 files.value 中查找响应式对象）
   */
  const uploadSingleFile = async (fileId: string): Promise<boolean> => {
    const fileItem = files.value.find(f => f.id === fileId)
    if (!fileItem) {
      logger.warn('[uploadSingleFile] 找不到文件:', fileId)
      return false
    }

    fileItem.status = 'uploading'
    logger.debug('[uploadSingleFile] 开始上传:', fileItem.name)

    try {
      const rawFile = toRaw(fileItem.file)
      logger.debug('[uploadSingleFile] rawFile instanceof File:', rawFile instanceof File)
      const response = await uploadFiles([rawFile])
      logger.debug('[uploadSingleFile] 上传响应:', response)

      if (response.code === 0 && response.data && response.data.length > 0) {
        const serverFile = response.data[0]
        if (!serverFile) {
          fileItem.status = 'error'
          fileItem.error = '上传失败：服务端返回为空'
          message.error(`${fileItem.name} 上传失败: ${fileItem.error}`)
          return false
        }
        fileItem.status = 'uploaded'
        fileItem.serverId = serverFile.id
        const baseURL = getApiBaseUrl()
        fileItem.serverUrl = `${baseURL}${serverFile.url}`
        if (serverFile.category) {
          fileItem.type = serverFile.category
        }
        if (typeof serverFile.sizeBytes === 'number' && serverFile.sizeBytes > 0) {
          fileItem.size = serverFile.sizeBytes
        }
        fileItem.charCount = serverFile.charCount ?? null
        fileItem.extractedText = serverFile.extractedText ?? null
        fileItem.truncated = serverFile.truncated ?? false
        logger.debug('[uploadSingleFile] 上传成功:', fileItem.name, serverFile.id)
        return true
      } else {
        fileItem.status = 'error'
        fileItem.error = response.message || '上传失败'
        message.error(`${fileItem.name} 上传失败: ${fileItem.error}`)
        return false
      }
    } catch (error) {
      logger.error('[uploadSingleFile] 上传异常:', error)
      fileItem.status = 'error'
      fileItem.error = error instanceof Error ? error.message : '上传失败'
      message.error(`${fileItem.name} 上传失败`)
      return false
    }
  }

  /**
   * 处理单个文件（本地处理 + 自动上传）
   */
  const processFile = async (file: File): Promise<UploadedFile | null> => {
    const validation = validateFile(file)
    if (!validation.valid) {
      message.warning(validation.error)
      return null
    }

    const fileType = resolveAttachmentType(file)

    const uploadedFile: UploadedFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: createPreview(file, fileType),
      type: fileType,
      name: file.name,
      size: file.size,
      status: 'processing'
    }

    files.value.push(uploadedFile)

    try {
      if (fileType === 'image' && autoCompress && file.size > compressThreshold) {
        logger.debug(`[processFile] 压缩图片: ${file.name}, 原始大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
        const processedFile = await compressImage(file, compressQuality)
        uploadedFile.file = processedFile
        logger.debug(`[processFile] 压缩后大小: ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`)
      }

      await uploadSingleFile(uploadedFile.id)

      return uploadedFile
    } catch (error) {
      logger.error('[processFile] 文件处理失败:', error)
      uploadedFile.status = 'error'
      uploadedFile.error = error instanceof Error ? error.message : '文件处理失败'
      return null
    }
  }

  /**
   * 添加文件（自动处理 + 上传）
   */
  const addFiles = async (fileList: FileList | File[]): Promise<void> => {
    const fileArray = Array.from(fileList)

    if (files.value.length + fileArray.length > maxCount) {
      message.warning(`最多只能上传 ${maxCount} 个文件`)
      fileArray.splice(maxCount - files.value.length)
    }

    if (fileArray.length === 0) return

    await Promise.all(fileArray.map(processFile))
  }

  /**
   * 移除文件
   */
  const removeFile = (id: string): void => {
    const index = files.value.findIndex(f => f.id === id)
    if (index !== -1) {
      const file = files.value[index]
      if (file) {
        if (file.preview && file.type === 'image') {
          URL.revokeObjectURL(file.preview)
        }
      }
      files.value.splice(index, 1)
    }
  }

  /**
   * 清空所有文件
   */
  const clearFiles = (): void => {
    files.value.forEach(f => {
      if (f.preview && f.type === 'image') {
        URL.revokeObjectURL(f.preview)
      }
    })
    files.value = []
  }

  /**
   * 获取已上传到服务器的文件 ID 列表
   */
  const getFileIdsForSend = (): string[] => {
    return uploadedFiles.value
      .map(f => f.serverId)
      .filter((id): id is string => !!id)
  }

  /**
   * 获取已上传文件的服务器信息-消息附件显示
   */
  const getUploadedFileInfos = (): ServerFileInfo[] => {
    return uploadedFiles.value
      .filter(f => f.serverId && f.serverUrl)
      .map(f => ({
        id: f.serverId!,
        url: f.serverUrl!,
        name: f.name,
        type: f.file.type || f.type,
        category: f.type,
        sizeBytes: f.size,
        charCount: f.charCount ?? null,
        extractedText: f.extractedText ?? null,
        truncated: f.truncated ?? false,
      }))
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    clearFiles()
  })

  return {
    // 状态
    files,
    isProcessing,
    totalSize,
    hasFiles,
    uploadedFiles,
    allUploaded,
    canSendFiles,

    // 方法
    addFiles,
    removeFile,
    clearFiles,
    getFileIdsForSend,
    getUploadedFileInfos,
    validateFile
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
