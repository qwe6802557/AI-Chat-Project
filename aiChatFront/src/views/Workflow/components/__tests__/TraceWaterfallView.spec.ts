import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TraceWaterfallView from '../TraceWaterfallView.vue'
import type { AgentSpanItem } from '@/api/trace'

describe('TraceWaterfallView', () => {
  it('renders hierarchical spans and emits select-node on row click', async () => {
    const spans: AgentSpanItem[] = [
      {
        id: '1',
        traceId: 'tr_abc123',
        spanId: 'sp_root',
        parentSpanId: null,
        nodeId: 'agent_1',
        spanType: 'dag_node',
        name: 'Node · 主分析节点',
        modelId: 'GLM-5',
        status: 'completed',
        startedAt: 1000,
        durationMs: 400,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCredits: 0,
        inputSummary: '测试输入',
        outputSummary: '测试汇总输出',
        createdAt: '2026-11-28T07:00:00Z',
      },
      {
        id: '2',
        traceId: 'tr_abc123',
        spanId: 'sp_llm',
        parentSpanId: 'sp_root',
        nodeId: null,
        spanType: 'llm',
        name: 'LLM · GLM-5',
        modelId: 'GLM-5',
        status: 'completed',
        startedAt: 1050,
        durationMs: 320,
        promptTokens: 120,
        completionTokens: 80,
        estimatedCredits: 0.45,
        inputSummary: '脱敏提示词',
        outputSummary: '脱敏生成答案',
        createdAt: '2026-11-28T07:00:00Z',
      },
    ]

    const wrapper = mount(TraceWaterfallView, {
      props: {
        spans,
        traceDurationMs: 420,
      },
    })

    const rows = wrapper.findAll('.waterfall-row')
    expect(rows).toHaveLength(2)
    expect(rows[1].text()).toContain('200 tok')

    await rows[0].trigger('click')
    expect(wrapper.emitted('select-node')?.[0]).toEqual(['agent_1'])
    expect(wrapper.find('.detail-io-grid').text()).toContain('测试汇总输出')
  })
})
