import { ref, computed, onBeforeUnmount, toRaw } from 'vue'
import { message } from 'ant-design-vue'
import { uploadFiles, type UploadedFileResponse } from '@/api/chat'

/**
 * 上传文件接口
 */
export interface UploadedFile {
  id: string
  file: File
  preview: string        // 预览URL(blob URL 或 图标)
  base64: string         // Base64数据（兼容旧版）
  type: 'image' | 'pdf' | 'document'
  name: string
  size: number
  status: 'processing' | 'uploading' | 'uploaded' | 'error'
  error?: string
  /** 服务端返回的文件 ID（上传成功后） */
  serverId?: string
  /** 服务端返回的文件访问 URL（上传成功后） */
  serverUrl?: string
}

/**
 * 文件上传 Hook 配置
 */
export interface UseFileUploadOptions {
  /** 最大文件大小（字节）-默认 5MB（匹配后端限制） */
  maxSize?: number
  /** 最大文件数量-默认 4（匹配后端限制） */
  maxCount?: number
  /** 允许的文件类型，默认图片和文档 */
  allowedTypes?: string[]
  /** 是否自动压缩图片，默认 true */
  autoCompress?: boolean
  /** 压缩阈值（字节），超过此大小自动压缩，默认 2MB */
  compressThreshold?: number
  /** 压缩质量（0-1），默认 0.8 */
  compressQuality?: number
}

// 默认支持的文件类型
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

// 文件类型映射
const FILE_TYPE_MAP: Record<string, UploadedFile['type']> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document'
}

// 文件类型友好名称
const FILE_TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPG 图片',
  'image/png': 'PNG 图片',
  'image/gif': 'GIF 图片',
  'image/webp': 'WebP 图片',
  'image/bmp': 'BMP 图片',
  'application/pdf': 'PDF 文档',
  'application/msword': 'Word 文档',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word 文档',
  'text/plain': '文本文件'
}

/**
 * 文件上传 Hook
 *
 * @description 处理文件上传、验证、压缩，添加时自动上传到服务器
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB（匹配后端限制）
    maxCount = 4,              // 最多4张（匹配后端限制）
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    autoCompress = true,
    compressThreshold = 2 * 1024 * 1024, // 2MB 开始压缩
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
    // 检查文件数量
    if (files.value.length >= maxCount) {
      return { valid: false, error: `最多只能上传 ${maxCount} 个文件` }
    }

    // 检查文件类型
    if (!allowedTypes.includes(file.type)) {
      const allowedNames = allowedTypes
        .map(t => FILE_TYPE_NAMES[t] || t)
        .filter((v, i, a) => a.indexOf(v) === i) // 去重
        .join('、')
      return { valid: false, error: `不支持的文件类型，仅支持：${allowedNames}` }
    }

    // 检查文件大小
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      return { valid: false, error: `文件大小不能超过 ${maxSizeMB}MB` }
    }

    // 检查是否重复
    const isDuplicate = files.value.some(
      f => f.name === file.name && f.size === file.size
    )
    if (isDuplicate) {
      return { valid: false, error: '该文件已添加' }
    }

    return { valid: true }
  }

  /**
   * 将文件转换为 Base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 压缩图片
   */
  const compressImage = (file: File, quality: number = compressQuality): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 非图片不压缩
      if (!file.type.startsWith('image/')) {
        fileToBase64(file).then(resolve).catch(reject)
        return
      }

      // GIF不压缩-压则会丢失动画
      if (file.type === 'image/gif') {
        fileToBase64(file).then(resolve).catch(reject)
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
          fileToBase64(file).then(resolve).catch(reject)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // 输出为 JPEG（压缩效果更好）或保持原格式
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const base64 = canvas.toDataURL(outputType, quality)

        resolve(base64)
        URL.revokeObjectURL(img.src)
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
    // 通过 ID 在 files.value 中查找，确保获取响应式代理对象
    const fileItem = files.value.find(f => f.id === fileId)
    if (!fileItem) {
      console.error('[uploadSingleFile] 找不到文件:', fileId)
      return false
    }

    // 只上传图片类型
    if (fileItem.type !== 'image') {
      // 非图片类型暂不支持服务器上传，标记为错误
      fileItem.status = 'error'
      fileItem.error = '暂不支持该文件类型上传'
      return false
    }

    fileItem.status = 'uploading'
    console.log('[uploadSingleFile] 开始上传:', fileItem.name)

    try {
      // 使用 toRaw 获取原始 File 对象，避免 Vue Proxy 导致 instanceof 检查失败
      const rawFile = toRaw(fileItem.file)
      console.log('[uploadSingleFile] rawFile instanceof File:', rawFile instanceof File)
      const response = await uploadFiles([rawFile])
      console.log('[uploadSingleFile] 上传响应:', response)

      if (response.code === 0 && response.data && response.data.length > 0) {
        const serverFile = response.data[0]
        fileItem.status = 'uploaded'
        fileItem.serverId = serverFile.id
        fileItem.serverUrl = serverFile.url
        console.log('[uploadSingleFile] 上传成功:', fileItem.name, serverFile.id)
        return true
      } else {
        fileItem.status = 'error'
        fileItem.error = response.message || '上传失败'
        message.error(`${fileItem.name} 上传失败: ${fileItem.error}`)
        return false
      }
    } catch (error) {
      console.error('[uploadSingleFile] 上传异常:', error)
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
    // 验证
    const validation = validateFile(file)
    if (!validation.valid) {
      message.warning(validation.error)
      return null
    }

    // 确定文件类型
    const fileType = FILE_TYPE_MAP[file.type] || 'document'

    // 创建文件对象
    const uploadedFile: UploadedFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: createPreview(file, fileType),
      base64: '',
      type: fileType,
      name: file.name,
      size: file.size,
      status: 'processing'
    }

    // 先添加到列表（显示处理中状态）
    files.value.push(uploadedFile)

    try {
      // 转换为 Base64（图片可能需要压缩）- 用于兼容旧版发送
      if (fileType === 'image' && autoCompress && file.size > compressThreshold) {
        console.log(`[processFile] 压缩图片: ${file.name}, 原始大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
        uploadedFile.base64 = await compressImage(file, compressQuality)
        const compressedSize = Math.round((uploadedFile.base64.length * 3) / 4)
        console.log(`[processFile] 压缩后大小: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`)
      } else {
        uploadedFile.base64 = await fileToBase64(file)
      }

      // 本地处理完成后，立即上传到服务器
      // 传递 fileId 而不是对象，确保在 uploadSingleFile 中通过 files.value 获取响应式代理
      await uploadSingleFile(uploadedFile.id)

      return uploadedFile
    } catch (error) {
      console.error('[processFile] 文件处理失败:', error)
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

    // 检查总数量
    if (files.value.length + fileArray.length > maxCount) {
      message.warning(`最多只能上传 ${maxCount} 个文件`)
      // 只处理允许数量的文件
      fileArray.splice(maxCount - files.value.length)
    }

    if (fileArray.length === 0) return

    // 并行处理文件（包含上传）
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
        // 释放预览 URL
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
    // 释放所有预览 URL
    files.value.forEach(f => {
      if (f.preview && f.type === 'image') {
        URL.revokeObjectURL(f.preview)
      }
    })
    files.value = []
  }

  /**
   * 获取用于发送的文件数据（兼容旧版 base64 方式）
   */
  const getFilesForSend = (): { base64: string; type: string; name: string }[] => {
    return files.value
      .filter(f => f.status === 'uploaded' || f.base64)
      .map(f => ({
        base64: f.base64,
        type: f.file.type,
        name: f.name
      }))
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
   * 获取已上传文件的服务器信息（用于消息附件显示）
   */
  const getUploadedFileInfos = (): { id: string; url: string; name: string; type: string }[] => {
    return uploadedFiles.value
      .filter(f => f.serverId && f.serverUrl)
      .map(f => ({
        id: f.serverId!,
        url: f.serverUrl!,
        name: f.name,
        type: f.file.type
      }))
  }

  /**
   * 清理 Base64 数据（发送后调用，减少内存占用）
   */
  const clearBase64Data = (): void => {
    files.value.forEach(f => {
      f.base64 = ''
    })
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
    getFilesForSend,
    getFileIdsForSend,
    getUploadedFileInfos,
    clearBase64Data,
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
