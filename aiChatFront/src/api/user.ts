import request, { type ResponseData } from '@/utils/request'
import type { UserAccountDetailResponse } from '@/types/user'

/**
 * 获取当前用户账户详情
 */
export function getCurrentUserAccount(params?: { ledgerPage?: number; ledgerPageSize?: number }) {
  return request.get<never, ResponseData<UserAccountDetailResponse>>('/user/account', { params })
}
