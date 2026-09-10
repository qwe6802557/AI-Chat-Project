import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import VoiceAudioPlayer from '../components/VoiceAudioPlayer.vue'
import VoiceControlBar from '../components/VoiceControlBar.vue'
import VoiceTaskStream from '../components/VoiceTaskStream.vue'
import type { VoiceTask, VoiceInfo } from '@/interface/voice'

const globalStubs = {
  'a-select': {
    props: ['value'],
    emits: ['update:value'],
    template: '<div class="a-select-stub" :data-value="value"><slot /></div>',
  },
  'a-select-option': {
    props: ['value'],
    template: '<div class="a-select-option-stub"><slot /></div>',
  },
  'a-textarea': {
    props: ['value'],
    emits: ['update:value'],
    template: '<textarea class="voice-textarea" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
}

const mockVoices: VoiceInfo[] = [
  { voice_id: 'eve', name: 'Eve', language: 'multilingual' },
  { voice_id: 'ara', name: 'Ara', language: 'multilingual' },
]

const mockTasks: VoiceTask[] = [
  {
    id: 'task-1',
    userId: 'user-1',
    type: 'tts',
    model: 'grok-voice-think-fast-1.0',
    voiceId: 'eve',
    language: 'zh',
    speed: 1.0,
    text: '你好，欢迎使用语音合成',
    audioUrl: '/voice/media/tts_1.mp3',
    costCredits: 20,
    duration: 3.5,
    status: 'success',
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-10T12:00:00Z',
  },
  {
    id: 'task-2',
    userId: 'user-1',
    type: 'stt',
    model: 'grok-stt',
    language: 'zh',
    speed: 1.0,
    text: '识别出的语音文字',
    audioUrl: '/voice/media/stt_2.mp3',
    costCredits: 20,
    duration: 2.1,
    status: 'success',
    createdAt: '2026-09-10T12:05:00Z',
    updatedAt: '2026-09-10T12:05:00Z',
  },
]

describe('VoiceAudioPlayer', () => {
  it('正确渲染播放器组件与时间结构', () => {
    const wrapper = mount(VoiceAudioPlayer, {
      props: {
        src: '/voice/media/tts_1.mp3',
        duration: 10,
        title: '测试音频',
      },
    })

    expect(wrapper.find('audio').exists()).toBe(true)
    expect(wrapper.find('.play-toggle-btn').exists()).toBe(true)
    expect(wrapper.find('.total-time').text()).toBe('00:10')
  })
})

describe('VoiceControlBar', () => {
  it('空文本时禁用 TTS 合成按钮', () => {
    const wrapper = mount(VoiceControlBar, {
      props: {
        voices: mockVoices,
        loading: false,
        unitCost: 20,
      },
      global: { stubs: globalStubs },
    })

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('输入文本后点击合成能正确触发 submit-tts 事件', async () => {
    const wrapper = mount(VoiceControlBar, {
      props: {
        voices: mockVoices,
        loading: false,
        unitCost: 20,
        initialVoiceId: 'eve',
      },
      global: { stubs: globalStubs },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('准备合成一段优美的话')

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeUndefined()

    await submitBtn.trigger('click')

    const emitted = wrapper.emitted('submit-tts')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      text: '准备合成一段优美的话',
      voiceId: 'eve',
      speed: 1.0,
      language: 'zh',
      model: 'grok-voice-think-fast-1.0',
    })
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('模式切换后能够正常渲染 STT 识别面板', async () => {
    const wrapper = mount(VoiceControlBar, {
      props: {
        voices: mockVoices,
        loading: false,
      },
      global: { stubs: globalStubs },
    })

    const sttCapsule = wrapper.findAll('.capsule-btn')[1]
    await sttCapsule.trigger('click')

    expect(wrapper.find('.stt-panel').exists()).toBe(true)
    expect(wrapper.find('.mic-circle-btn').exists()).toBe(true)
  })

  it('加载中时展示停止生成按钮并触发 stop 事件', async () => {
    const wrapper = mount(VoiceControlBar, {
      props: {
        voices: mockVoices,
        loading: true,
      },
      global: { stubs: globalStubs },
    })

    const stopBtn = wrapper.find('.stop-btn')
    expect(stopBtn.exists()).toBe(true)

    await stopBtn.trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
  })
})

describe('VoiceTaskStream', () => {
  it('正确渲染任务列表并支持按类型过滤', async () => {
    const wrapper = mount(VoiceTaskStream, {
      props: {
        tasks: mockTasks,
        currentFilter: 'all',
      },
      global: { stubs: globalStubs },
    })

    expect(wrapper.findAll('.task-card')).toHaveLength(2)
    expect(wrapper.find('.tts-tag').exists()).toBe(true)
    expect(wrapper.find('.stt-tag').exists()).toBe(true)

    // 点击 TTS 过滤
    const ttsFilterBtn = wrapper.findAll('.filter-pill')[1]
    await ttsFilterBtn.trigger('click')
    expect(wrapper.emitted('filter-change')![0][0]).toBe('tts')
  })

  it('任务为空时展示优美的空状态与体验提示词', () => {
    const wrapper = mount(VoiceTaskStream, {
      props: {
        tasks: [],
        currentFilter: 'all',
      },
      global: { stubs: globalStubs },
    })

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.findAll('.preset-pill').length).toBeGreaterThan(0)
  })
})
