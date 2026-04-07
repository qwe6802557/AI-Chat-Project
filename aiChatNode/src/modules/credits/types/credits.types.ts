/**
 * 用户积分配置与快照类型
 */
export const DEFAULT_REGISTER_CREDITS = 2000;
// 作为聊天请求的默认预占上限，最终会按实际 token 消耗结算。
export const DEFAULT_MODEL_CREDIT_COST = 100;
// Claude 系列通常输出倍率更高，默认提高预占上限避免低估。
export const ZAIWEN_CLAUDE_MODEL_CREDIT_COST = 200;
export const DEFAULT_MODEL_BILLING_MODE = 'token_usage_with_reserve';

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
