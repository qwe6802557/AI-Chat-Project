import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentCollaborationTimeline from '../AgentCollaborationTimeline.vue'
import type { SwarmTimelineEvent } from '@/interface/chat'

describe('AgentCollaborationTimeline', () => {
  it('renders nothing when timeline is empty', () => {
    const wrapper = mount(AgentCollaborationTimeline, {
      props: {
        timeline: [],
      },
    })
    expect(wrapper.find('.swarm-timeline-card').exists()).toBe(false)
  })

  it('renders handoff and execution nodes with routing pills and telemetry', () => {
    const timeline: SwarmTimelineEvent[] = [
      {
        id: 'swarm_1',
        type: 'handoff',
        timestamp: Date.now(),
        fromAgent: '研发主控中心',
        toAgent: '代码专家',
        modelId: 'qwen2.5-coder',
        task: '编写快速排序算法',
        outputSnippet: 'def quicksort(arr): return arr',
        durationMs: 85,
        status: 'completed',
      },
      {
        id: 'swarm_2',
        type: 'conclude',
        timestamp: Date.now(),
        fromAgent: '代码专家',
        toAgent: '用户',
        status: 'completed',
        durationMs: 120,
      },
    ]

    const wrapper = mount(AgentCollaborationTimeline, {
      props: { timeline },
    })

    expect(wrapper.find('.swarm-timeline-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('多智能体协同编排')
    expect(wrapper.text()).toContain('2 节点')
    expect(wrapper.text()).toContain('研发主控中心')
    expect(wrapper.text()).toContain('代码专家')
    expect(wrapper.text()).toContain('qwen2.5-coder')
    expect(wrapper.text()).toContain('85ms')
    expect(wrapper.text()).toContain('编写快速排序算法')
    expect(wrapper.text()).toContain('def quicksort(arr)')
  })

  it('renders running state with spinner', () => {
    const timeline: SwarmTimelineEvent[] = [
      {
        id: 'swarm_active',
        type: 'handoff',
        timestamp: Date.now(),
        fromAgent: '主控中心',
        toAgent: '研报分析师',
        modelId: 'spark-x2.6',
        task: '深入检索行业动态',
        status: 'running',
      },
    ]

    const wrapper = mount(AgentCollaborationTimeline, {
      props: { timeline },
    })

    expect(wrapper.text()).toContain('执行中')
    expect(wrapper.find('.bullet-spinner').exists()).toBe(true)
  })

  it('toggles expansion state on header click', async () => {
    const timeline: SwarmTimelineEvent[] = [
      {
        id: 'swarm_1',
        type: 'handoff',
        timestamp: Date.now(),
        fromAgent: '主控',
        toAgent: '专员',
        status: 'completed',
      },
    ]

    const wrapper = mount(AgentCollaborationTimeline, {
      props: { timeline },
    })

    expect(wrapper.find('.timeline-body').exists()).toBe(true)
    await wrapper.find('.timeline-header').trigger('click')
    expect(wrapper.find('.timeline-body').exists()).toBe(false)
  })
})
