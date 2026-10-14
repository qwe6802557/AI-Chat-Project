/**
 * Artifacts 动态交互工作区类型定义
 * 遵循 stitch-design-taste 规约与组件化设计
 */

export type ArtifactType =
  | 'text/html'
  | 'image/svg+xml'
  | 'application/vnd.ant.mermaid'
  | 'application/vnd.ant.code'
  | 'application/vnd.ant.markdown'
  | string

export interface ArtifactVersion {
  /** 版本号，从 1 开始累加 */
  version: number
  /** 该版本的源码或文本内容 */
  content: string
  /** 语言（如 html, svg, typescript, python 等） */
  language?: string
  /** 创建时间戳 */
  createdAt: number
  /** 关联的会话消息 ID */
  messageId?: string
}

export interface ArtifactItem {
  /** 唯一标识符，用于跨消息归集版本 */
  identifier: string
  /** 产物显示标题 */
  title: string
  /** 产物类型 */
  type: ArtifactType
  /** 默认主要语言 */
  language?: string
  /** 历史版本列表，升序排列 */
  versions: ArtifactVersion[]
  /** 首次创建时间戳 */
  createdAt: number
  /** 最近更新时间戳 */
  updatedAt: number
}

/** 视口模拟模式 */
export type ViewportMode = 'responsive' | 'desktop' | 'tablet' | 'mobile'

export interface ViewportConfig {
  mode: ViewportMode
  label: string
  width: string
  height: string
}
