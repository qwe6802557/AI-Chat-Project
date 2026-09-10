/**
 * 用户积分配置与快照类型
 */
export const DEFAULT_REGISTER_CREDITS = 2000;
// 聊天模型默认固定每次消耗 10 积分
export const DEFAULT_CHAT_MODEL_CREDIT_COST = 10;
// 作为通用模型的默认预占上限
export const DEFAULT_MODEL_CREDIT_COST = 100;
// Claude 系列通常输出倍率更高，默认提高预占上限避免低估。
export const ZAIWEN_CLAUDE_MODEL_CREDIT_COST = 200;
export const DEFAULT_MODEL_BILLING_MODE = 'token_usage_with_reserve';
export const DEFAULT_CHAT_BILLING_MODE = 'flat_per_request';

export enum CreditLedgerType {
  GRANT = 'grant',
  RESERVE = 'reserve',
  CAPTURE = 'capture',
  RELEASE = 'release',
  REFUND = 'refund',
  ADJUST = 'adjust',
}

export enum CreditBusinessType {
  REGISTER_BONUS = 'register_bonus',
  CHAT_MESSAGE = 'chat_message',
  IMAGE_GENERATION = 'image_generation',
  MANUAL = 'manual',
  SYSTEM = 'system',
}

export enum ChatCreditChargeStatus {
  RESERVED = 'reserved',
  CAPTURED = 'captured',
  RELEASED = 'released',
  REFUNDED = 'refunded',
}

export interface UserCreditsSnapshot {
  total: number;
  consumed: number;
  remaining: number;
  reserved: number;
}

export interface ChatCreditChargeSummary {
  id: string;
  clientRequestId: string;
  modelId: string;
  billingMode: string;
  credits: number;
  status: ChatCreditChargeStatus;
}

export interface RecentCreditLedgerItem {
  id: string;
  type: CreditLedgerType;
  title: string;
  description?: string | null;
  amount: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface RecentCreditLedgerPage {
  items: RecentCreditLedgerItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
