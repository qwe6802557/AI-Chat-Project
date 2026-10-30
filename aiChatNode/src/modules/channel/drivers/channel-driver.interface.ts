export interface ChannelStatusInfo {
  channelType: string;
  name: string;
  isEnabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  loginStatus?: 'idle' | 'waiting_scan' | 'scanned' | 'logged_in' | 'error';
  qrCodeUrl?: string | null;
  boundModelId?: string | null;
  systemPrompt?: string | null;
  credentialsMasked?: Record<string, string>;
  lastError?: string | null;
  connectedAt?: string | null;
}

export type InboundMessageHandler = (
  channelType: string,
  fromId: string,
  content: string,
  contextToken?: string,
) => Promise<string | null>;

export interface IChannelDriver {
  readonly channelType: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ChannelStatusInfo>;
  sendMessage(to: string, content: string, contextToken?: string): Promise<boolean>;
  getQrCode?(): Promise<{ qrCodeUrl: string; status: string }>;
}
