<template>
  <div v-if="toolCalls && toolCalls.length > 0" class="tool-execution-container">
    <div
      v-for="tool in toolCalls"
      :key="tool.id"
      class="tool-card"
      :class="{
        'is-calling': isCalling(tool),
        'is-executing': isExecuting(tool),
        'is-completed': isCompleted(tool),
        'is-failed': isFailed(tool),
        'is-pending-approval': isPendingApproval(tool),
        'is-rejected': isRejected(tool),
        'is-expanded': isExpanded(tool.id, tool),
      }"
    >
      <div class="tool-card-header" @click="toggleExpand(tool.id)">
        <div class="header-left">
          <component :is="getToolIcon(tool.name)" class="tool-icon" />
          <span class="tool-name">{{ getToolTitle(tool) }}</span>
          <span :class="['status-badge', getStatusBadgeClass(tool)]">
            <SafetyCertificateOutlined v-if="isPendingApproval(tool)" class="status-icon" />
            <CloseCircleFilled v-else-if="isRejected(tool)" class="status-icon" />
            <LoadingOutlined v-else-if="isCalling(tool) || isExecuting(tool)" spin class="status-spinner" />
            <CheckCircleFilled v-else-if="isCompleted(tool)" class="status-icon" />
            <CloseCircleFilled v-else class="status-icon" />
            <span>{{ getStatusLabel(tool) }}</span>
          </span>
          <span v-if="getDuration(tool) !== null" class="duration-tag">
            {{ getDuration(tool) }}ms
          </span>
        </div>

        <div class="header-right">
          <DownOutlined :class="['expand-icon', { rotated: isExpanded(tool.id, tool) }]" />
        </div>
      </div>

      <transition name="expand">
        <div v-if="isExpanded(tool.id, tool)" class="tool-card-body">
          <!-- 高危审批拦截提示与操作区域 -->
          <div v-if="isPendingApproval(tool)" class="approval-panel">
            <div class="approval-info">
              <div class="approval-meta">
                <SafetyCertificateOutlined class="approval-icon" />
                <span class="approval-title">高危操作授权确认</span>
                <span :class="['risk-level-tag', `risk-${tool.riskLevel || 'high'}`]">
                  {{ (tool.riskLevel || 'high').toUpperCase() }} RISK
                </span>
              </div>
              <div class="approval-desc">
                {{ tool.riskReason || '检测到该工具调用可能涉及底层命令执行或系统资源访问，需操作者核准后方可执行。' }}
              </div>
            </div>

            <!-- 参数审查 -->
            <div v-if="hasArgs(tool)" class="section-block approval-args-block">
              <div class="section-title">待执行参数审查</div>
              <pre class="code-block monospace-block"><code>{{ formatJson(getArgs(tool)) }}</code></pre>
            </div>

            <!-- Stitch 触感按键控制条 -->
            <div class="approval-actions">
              <button
                type="button"
                class="stitch-btn stitch-btn-approve"
                :disabled="isDeciding(tool.approvalId)"
                @click.stop="handleDecision(tool, 'approved')"
              >
                <LoadingOutlined v-if="isDeciding(tool.approvalId, 'approved')" spin />
                <CheckOutlined v-else />
                <span>放行执行</span>
              </button>
              <button
                type="button"
                class="stitch-btn stitch-btn-reject"
                :disabled="isDeciding(tool.approvalId)"
                @click.stop="handleDecision(tool, 'rejected')"
              >
                <LoadingOutlined v-if="isDeciding(tool.approvalId, 'rejected')" spin />
                <CloseOutlined v-else />
                <span>终止调用</span>
              </button>
            </div>
          </div>

          <!-- 常规工具调用展示 -->
          <template v-else>
            <!-- 调用参数 -->
            <div v-if="hasArgs(tool)" class="section-block">
              <div class="section-title">调用参数</div>
              <pre class="code-block monospace-block"><code>{{ formatJson(getArgs(tool)) }}</code></pre>
            </div>

            <!-- 执行结果与输出 -->
            <div class="section-block">
              <div class="section-title">执行输出</div>
              <div v-if="isCalling(tool) || isExecuting(tool)" class="running-indicator">
                <LoadingOutlined spin />
                <span>正在等待外部工具执行返回...</span>
              </div>
              <div v-else-if="getErrorMessage(tool)" class="error-text">
                {{ getErrorMessage(tool) }}
              </div>
              <pre
                v-else-if="hasOutput(tool)"
                class="code-block output-block monospace-block"
              ><code>{{ formatOutput(tool) }}</code></pre>
              <div v-else class="empty-output">
                (无返回值)
              </div>
            </div>
          </template>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  CodeOutlined,
  GlobalOutlined,
  CalculatorOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  DownOutlined,
  AppstoreOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SafetyCertificateOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { decideApproval } from '@/api/chat'
import type { ToolCallItem } from '@/interface/chat'

defineOptions({
  name: 'ToolExecutionCard',
})

defineProps<{
  toolCalls?: ToolCallItem[] | null
}>()

const expandedMap = ref<Record<string, boolean>>({})
const decidingMap = ref<Record<string, 'approved' | 'rejected'>>({})

const isExpanded = (id: string, tool?: ToolCallItem): boolean => {
  if (expandedMap.value[id] !== undefined) {
    return !!expandedMap.value[id]
  }
  // 待审批高危工具默认展开供操作者审阅
  if (tool && tool.status === 'pending_approval') {
    return true
  }
  return false
}

const toggleExpand = (id: string) => {
  expandedMap.value[id] = !expandedMap.value[id]
}

const getStatus = (
  tool: ToolCallItem,
): 'calling' | 'executing' | 'completed' | 'failed' | 'pending_approval' | 'rejected' => {
  if (tool.status === 'pending_approval') return 'pending_approval'
  if (tool.status === 'rejected') return 'rejected'
  if (tool.status === 'calling') return 'calling'
  if (tool.status === 'executing') return 'executing'
  if (tool.status === 'completed' || tool.status === 'success') return 'completed'
  if (tool.status === 'failed' || tool.status === 'error') return 'failed'

  if (tool.result) {
    if (typeof tool.result === 'object' && tool.result.status === 'error') {
      return 'failed'
    }
    return 'completed'
  }

  return 'calling'
}

const isPendingApproval = (tool: ToolCallItem): boolean => getStatus(tool) === 'pending_approval'
const isRejected = (tool: ToolCallItem): boolean => getStatus(tool) === 'rejected'
const isCalling = (tool: ToolCallItem): boolean => getStatus(tool) === 'calling'
const isExecuting = (tool: ToolCallItem): boolean => getStatus(tool) === 'executing'
const isCompleted = (tool: ToolCallItem): boolean => getStatus(tool) === 'completed'
const isFailed = (tool: ToolCallItem): boolean => getStatus(tool) === 'failed'

const getStatusLabel = (tool: ToolCallItem): string => {
  const status = getStatus(tool)
  switch (status) {
    case 'pending_approval':
      return '待审批确认'
    case 'rejected':
      return '已终止执行'
    case 'calling':
      return '准备调用'
    case 'executing':
      return '正在执行...'
    case 'completed':
      return '执行成功'
    case 'failed':
      return '执行失败'
  }
}

const getStatusBadgeClass = (tool: ToolCallItem): string => {
  const status = getStatus(tool)
  switch (status) {
    case 'pending_approval':
      return 'badge-approval'
    case 'rejected':
      return 'badge-rejected'
    case 'calling':
      return 'badge-calling'
    case 'executing':
      return 'badge-executing'
    case 'completed':
      return 'badge-completed'
    case 'failed':
      return 'badge-failed'
  }
}

const isDeciding = (approvalId?: string, action?: 'approved' | 'rejected'): boolean => {
  if (!approvalId) return false
  if (!action) return !!decidingMap.value[approvalId]
  return decidingMap.value[approvalId] === action
}

const handleDecision = async (tool: ToolCallItem, decision: 'approved' | 'rejected') => {
  if (!tool.approvalId || isDeciding(tool.approvalId)) return
  decidingMap.value[tool.approvalId] = decision

  try {
    await decideApproval(tool.approvalId, { decision })
    if (decision === 'approved') {
      tool.status = 'executing'
      message.success('已批准执行该工具')
    } else {
      tool.status = 'rejected'
      tool.result = { status: 'error', error: '操作者已终止执行此高危操作' }
      message.info('已终止该高危工具调用')
    }
  } catch (err: any) {
    message.error(err?.message || '审批裁决提交失败')
  } finally {
    delete decidingMap.value[tool.approvalId]
  }
}

const getDuration = (tool: ToolCallItem): number | null => {
  if (typeof tool.durationMs === 'number') {
    return tool.durationMs
  }
  if (tool.result && typeof tool.result === 'object' && typeof tool.result.durationMs === 'number') {
    return tool.result.durationMs
  }
  return null
}

const getArgs = (tool: ToolCallItem) => {
  return tool.arguments ?? tool.args ?? null
}

const hasArgs = (tool: ToolCallItem): boolean => {
  const args = getArgs(tool)
  if (!args) return false
  if (typeof args === 'object') {
    return Object.keys(args).length > 0
  }
  return true
}

const getErrorMessage = (tool: ToolCallItem): string | null => {
  if (tool.result && typeof tool.result === 'object') {
    if (tool.result.error) return String(tool.result.error)
    if (tool.result.status === 'error' && tool.result.message) return String(tool.result.message)
  }
  if (isRejected(tool)) {
    return '该操作未通过操作者安全核准，已被就地终止'
  }
  if (isFailed(tool)) {
    return '工具执行未成功返回结果'
  }
  return null
}

const hasOutput = (tool: ToolCallItem): boolean => {
  return tool.result !== undefined && tool.result !== null
}

const formatOutput = (tool: ToolCallItem): string => {
  const res = tool.result
  if (res && typeof res === 'object') {
    if (res.rawOutput) return String(res.rawOutput)
    if (res.output !== undefined) return formatJson(res.output)
  }
  return formatJson(res)
}

const getToolTitle = (tool: ToolCallItem): string => {
  if (tool.title) return tool.title

  switch (tool.name) {
    case 'calculator':
      return '计算器'
    case 'clock_calendar':
      return '时钟与日历'
    case 'code_interpreter':
      return '代码沙箱'
    case 'url_fetcher':
      return '网页读取'
    case 'weather':
      return '天气查询'
    case 'web_search_v2':
      return '深度联网搜索'
    default:
      return tool.name
  }
}

const getToolIcon = (name: string) => {
  switch (name) {
    case 'code_interpreter':
      return CodeOutlined
    case 'web_search_v2':
      return GlobalOutlined
    case 'calculator':
      return CalculatorOutlined
    case 'weather':
      return CloudOutlined
    case 'clock_calendar':
      return ClockCircleOutlined
    case 'url_fetcher':
      return LinkOutlined
    default:
      return AppstoreOutlined
  }
}

const formatJson = (val: any): string => {
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}
</script>

<style scoped lang="scss">
.tool-execution-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 10px 0;
  width: 100%;
}

.tool-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
  transition: all 0.2s ease;

  &.is-pending-approval {
    border-color: #f59e0b;
    background: #fffdf5;
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2);

    .tool-card-header {
      background: #fef3c7;

      .tool-icon {
        color: #d97706;
      }

      .tool-name {
        color: #78350f;
      }
    }
  }

  &.is-rejected {
    border-color: #e2e8f0;
    opacity: 0.9;

    .tool-card-header {
      background: #f8fafc;

      .tool-icon {
        color: #64748b;
      }
    }
  }

  &.is-calling {
    border-color: #cbd5e1;
  }

  &.is-executing {
    border-color: #93c5fd;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
  }

  &.is-completed {
    border-color: #bbf7d0;
  }

  &.is-failed {
    border-color: #fecaca;
  }

  .tool-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s ease;

    &:hover {
      background: #f1f5f9;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .tool-icon {
        font-size: 14px;
        color: #2563eb;
      }

      .tool-name {
        font-weight: 600;
        color: #1e293b;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 500;

        .status-spinner {
          font-size: 10px;
        }

        .status-icon {
          font-size: 11px;
        }

        &.badge-approval {
          color: #92400e;
          background: #fde68a;
          border: 1px solid rgba(217, 119, 6, 0.35);
          font-weight: 600;
        }

        &.badge-rejected {
          color: #475569;
          background: #e2e8f0;
          border: 1px solid #cbd5e1;
        }

        &.badge-calling {
          color: #475467;
          background: #f2f4f7;
        }

        &.badge-executing {
          color: #1d4ed8;
          background: #dbeafe;
        }

        &.badge-completed {
          color: #166534;
          background: #dcfce7;
        }

        &.badge-failed {
          color: #991b1b;
          background: #fee2e2;
        }
      }

      .duration-tag {
        font-size: 11px;
        color: #64748b;
        font-family: monospace;
      }
    }

    .header-right {
      .expand-icon {
        font-size: 10px;
        color: #94a3b8;
        transition: transform 0.2s ease;

        &.rotated {
          transform: rotate(180deg);
        }
      }
    }
  }

  .tool-card-body {
    padding: 10px 12px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;

    .approval-panel {
      padding: 12px;
      border-radius: 6px;
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;

      .approval-info {
        margin-bottom: 12px;

        .approval-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;

          .approval-icon {
            font-size: 15px;
            color: #fbbf24;
          }

          .approval-title {
            font-size: 13px;
            font-weight: 600;
            color: #f8fafc;
            letter-spacing: 0.3px;
          }

          .risk-level-tag {
            font-size: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.5px;

            &.risk-high {
              background: rgba(239, 68, 68, 0.2);
              color: #f87171;
              border: 1px solid rgba(239, 68, 68, 0.4);
            }

            &.risk-medium {
              background: rgba(245, 158, 11, 0.2);
              color: #fbbf24;
              border: 1px solid rgba(245, 158, 11, 0.4);
            }

            &.risk-low {
              background: rgba(59, 130, 246, 0.2);
              color: #60a5fa;
              border: 1px solid rgba(59, 130, 246, 0.4);
            }
          }
        }

        .approval-desc {
          font-size: 12px;
          line-height: 1.5;
          color: #94a3b8;
        }
      }

      .approval-args-block {
        margin-bottom: 12px;

        .section-title {
          color: #94a3b8;
        }
      }

      .approval-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-top: 10px;
        border-top: 1px solid #1e293b;

        .stitch-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          border: 1px solid transparent;
          user-select: none;

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          &.stitch-btn-approve {
            background: #ffffff;
            color: #0f172a;
            border-color: #e2e8f0;

            &:hover:not(:disabled) {
              background: #f1f5f9;
              transform: translateY(-1px);
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            }

            &:active:not(:disabled) {
              transform: translateY(0);
            }
          }

          &.stitch-btn-reject {
            background: transparent;
            color: #94a3b8;
            border-color: #334155;

            &:hover:not(:disabled) {
              background: rgba(239, 68, 68, 0.12);
              color: #f87171;
              border-color: rgba(239, 68, 68, 0.35);
            }

            &:active:not(:disabled) {
              transform: translateY(0);
            }
          }
        }
      }
    }

    .section-block {
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-title {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .code-block {
        margin: 0;
        padding: 8px 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        line-height: 1.45;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 240px;
      }

      .running-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: #f0f7ff;
        color: #2563eb;
        border-radius: 6px;
        font-size: 12px;
      }

      .error-text {
        padding: 8px 10px;
        background: #fef2f2;
        color: #b91c1c;
        border-radius: 6px;
        font-size: 12px;
      }

      .empty-output {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
        padding: 4px 0;
      }
    }
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease-out;
  max-height: 600px;
  opacity: 1;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}
</style>
