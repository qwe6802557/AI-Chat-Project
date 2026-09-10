export type VoiceTaskType = 'tts' | 'stt';
export type VoiceTaskStatus = 'pending' | 'success' | 'failed';

export interface VoiceTask {
  id: string;
  userId: string;
  type: VoiceTaskType;
  model: string;
  voiceId?: string | null;
  language: string;
  speed: number;
  text: string;
  audioUrl?: string | null;
  costCredits: number;
  duration?: number | null;
  status: VoiceTaskStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceInfo {
  voice_id: string;
  name: string;
  language: string;
}

export interface CreateTtsParams {
  text: string;
  voiceId: string;
  model?: string;
  language?: string;
  speed?: number;
}

export interface VoiceHistoryQuery {
  page?: number;
  pageSize?: number;
  type?: 'all' | 'tts' | 'stt';
}

export interface VoiceHistoryResponse {
  items: VoiceTask[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
