import type { AxiosRequestConfig } from 'axios'
import request, { type ResponseData } from '@/utils/request'
import type {
  VoiceTask,
  VoiceInfo,
  CreateTtsParams,
  VoiceHistoryQuery,
  VoiceHistoryResponse,
} from '@/interface/voice'

/**
 * 获取可用的 TTS 音色列表
 */
export function getVoicesApi(model?: string) {
  return request.get<never, ResponseData<{ voices: VoiceInfo[] }>>('/voice/voices', {
    params: { model },
  })
}

/**
 * 发起 TTS 文本转语音合成任务
 */
export function generateTtsApi(params: CreateTtsParams, config?: AxiosRequestConfig) {
  return request.post<never, ResponseData<VoiceTask>>('/voice/tts', params, config)
}

/**
 * 上传音频发起 STT 语音识别转文字
 */
export function transcribeSttApi(formData: FormData, config?: AxiosRequestConfig) {
  return request.post<never, ResponseData<VoiceTask>>('/voice/stt', formData, {
    ...config,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(config?.headers || {}),
    },
  })
}

/**
 * 分页拉取个人语音任务历史记录
 */
export function getVoiceHistoryApi(query?: VoiceHistoryQuery) {
  return request.get<never, ResponseData<VoiceHistoryResponse>>('/voice/history', {
    params: query,
  })
}
