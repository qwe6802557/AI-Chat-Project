import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DagNodeCard from '../DagNodeCard.vue'

describe('DagNodeCard', () => {
  it('renders node label, runtime status, and tabular latency cleanly', () => {
    const wrapper = mount(DagNodeCard, {
      props: {
        id: 'agent_1',
        type: 'agent',
        data: { label: '研报汇总专家', modelId: 'GLM-5' },
        selected: true,
      },
      global: {
        stubs: {
          Handle: true,
        },
        provide: {
          dagRuntimeState: {
            statusMap: ref({ agent_1: 'completed' }),
            durationMap: ref({ agent_1: 245 }),
            errorMap: ref({}),
          },
        },
      },
    })

    expect(wrapper.find('.node-title').text()).toBe('研报汇总专家')
    expect(wrapper.find('.node-subtitle').text()).toContain('GLM-5')
    expect(wrapper.find('.telemetry-ms').text()).toBe('245 ms')
    expect(wrapper.classes()).toContain('runtime-completed')
    expect(wrapper.classes()).toContain('is-selected')
  })

  it('renders rule handles and Else handle for condition node', () => {
    const wrapper = mount(DagNodeCard, {
      props: {
        id: 'cond_1',
        type: 'condition',
        data: {
          label: '命中判定',
          rules: [{ id: 'rule_a', label: '含图表', variable: 'rag_1.output', operator: 'contains', value: '图表' }],
        },
      },
      global: {
        stubs: { Handle: true },
      },
    })

    const pills = wrapper.findAll('.branch-pill').map((el) => el.text())
    expect(pills).toEqual(['含图表', '默认 Else'])
  })
})
