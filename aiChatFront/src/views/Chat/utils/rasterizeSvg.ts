/**
 * 纯前端 SVG 矢量图形光栅化为高清 PNG 工具函数
 * 基于浏览器原生 Offscreen / Canvas 2D，零外置依赖
 */

export interface RasterizeOptions {
  /** 导出图片放大倍率（默认为 2，即 2x Retina 高清） */
  scale?: number
  /** 背景填充色，默认白色避免透明底在暗色查看器变黑 */
  backgroundColor?: string
}

/**
 * 将 SVG 源码字符串光栅化为 PNG Blob
 */
export async function rasterizeSvgToPng(
  svgString: string,
  options: RasterizeOptions = {},
): Promise<Blob> {
  const { scale = 2, backgroundColor = '#ffffff' } = options

  return new Promise((resolve, reject) => {
    let preparedSvg = svgString.trim()
    if (!preparedSvg.includes('xmlns=')) {
      preparedSvg = preparedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(preparedSvg, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    if (!svgEl) {
      reject(new Error('未找到有效的 SVG 根元素'))
      return
    }

    let width = parseFloat(svgEl.getAttribute('width') || '')
    let height = parseFloat(svgEl.getAttribute('height') || '')

    if (!width || !height || isNaN(width) || isNaN(height)) {
      const viewBox = svgEl.getAttribute('viewBox')
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number)
        if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
          width = parts[2]
          height = parts[3]
        }
      }
    }

    if (!width || !height || isNaN(width) || isNaN(height)) {
      width = 800
      height = 600
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('浏览器无法创建 Canvas 2D 上下文'))
      return
    }

    const blob = new Blob([preparedSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      try {
        if (backgroundColor) {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)

        canvas.toBlob(
          (pngBlob) => {
            if (pngBlob) {
              resolve(pngBlob)
            } else {
              reject(new Error('PNG 光栅化转换失败'))
            }
          },
          'image/png',
          1.0,
        )
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG 矢量图片加载解析失败'))
    }

    img.src = url
  })
}

/**
 * 触发纯前端 Blob 文件的即时静默下载
 */
export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
