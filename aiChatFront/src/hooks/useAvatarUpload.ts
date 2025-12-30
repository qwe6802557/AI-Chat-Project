/**
 * 头像上传 Hook
 * 处理头像的选择、裁剪、压缩和预览
 */
import { ref } from 'vue'
import { message } from 'ant-design-vue'

/**
 * 头像上传配置
 */
export interface UseAvatarUploadOptions {
  maxSize?: number        // 最大文件大小（字节），默认 2MB
  quality?: number        // 压缩质量 0-1，默认 0.8
  outputSize?: number     // 输出尺寸（正方形边长），默认 200
}

/**
 * 头像上传 Hook
 */
export function useAvatarUpload(options: UseAvatarUploadOptions = {}) {
  const {
    maxSize = 2 * 1024 * 1024,  // 2MB
    quality = 0.8,
    outputSize = 200
  } = options

  // 状态
  const isUploading = ref(false)
  const previewUrl = ref<string | null>(null)
  const uploadError = ref<string | null>(null)

  // 允许的图片类型
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  /**
   * 验证文件
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: '仅支持 JPG、PNG、GIF、WebP 格式图片' }
    }
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      return { valid: false, error: `图片大小不能超过 ${maxSizeMB}MB` }
    }
    return { valid: true }
  }

  /**
   * 压缩并转换图片为正方形
   */
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // 设置输出尺寸为正方形
        canvas.width = outputSize
        canvas.height = outputSize

        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'))
          return
        }

        // 计算裁剪区域（取中心正方形）
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2

        // 绘制并压缩
        ctx.drawImage(img, sx, sy, size, size, 0, 0, outputSize, outputSize)

        // 转换为 base64
        const base64 = canvas.toDataURL('image/jpeg', quality)
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
   * 处理头像上传
   */
  const handleAvatarUpload = async (file: File): Promise<string | null> => {
    uploadError.value = null

    // 验证
    const validation = validateFile(file)
    if (!validation.valid) {
      uploadError.value = validation.error!
      message.error(validation.error)
      return null
    }

    isUploading.value = true

    try {
      // 处理图片（压缩、裁剪）
      const base64 = await processImage(file)
      previewUrl.value = base64

      // TODO: 调用上传 API
      // const response = await uploadAvatar(file)
      // return response.data.url

      // 纯前端阶段直接返回 base64
      message.success('头像上传成功')
      return base64
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '头像上传失败'
      uploadError.value = errorMsg
      message.error(errorMsg)
      return null
    } finally {
      isUploading.value = false
    }
  }

  /**
   * 清除预览
   */
  const clearPreview = () => {
    previewUrl.value = null
    uploadError.value = null
  }

  return {
    isUploading,
    previewUrl,
    uploadError,
    handleAvatarUpload,
    clearPreview,
    validateFile
  }
}
