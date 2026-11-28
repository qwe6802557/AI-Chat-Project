<template>
  <section class="credit-ledger-panel">
    <div class="ledger-toolbar">
      <div class="filter-group">
        <a-radio-group v-model:value="filterType" button-style="solid" size="small">
          <a-radio-button value="all">全部记录</a-radio-button>
          <a-radio-button value="expense">扣费支出</a-radio-button>
          <a-radio-button value="income">赠送与返还</a-radio-button>
        </a-radio-group>
      </div>

      <div class="action-group">
        <span class="total-badge">共 {{ total }} 条流水</span>
      </div>
    </div>

    <a-table
      :data-source="filteredItems"
      :columns="columns"
      :loading="loading"
      row-key="id"
      size="small"
      :pagination="paginationConfig"
      :locale="{ emptyText: filterType === 'all' ? '暂无积分流水' : '当前页暂无匹配流水' }"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'createdAt'">
          <span class="mono-text time-text">{{ formatLedgerTime(record.createdAt) }}</span>
        </template>

        <template v-else-if="column.key === 'type'">
          <a-tag :color="getLedgerTypeMeta(record.type).color" class="type-tag">
            {{ getLedgerTypeMeta(record.type).label }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'title'">
          <div class="summary-cell">
            <span class="summary-title">{{ record.title }}</span>
            <span v-if="record.description" class="summary-desc">{{ record.description }}</span>
          </div>
        </template>

        <template v-else-if="column.key === 'amount'">
          <span :class="['mono-text', 'amount-text', getAmountClass(record.amount)]">
            {{ formatLedgerAmount(record.amount) }}
          </span>
        </template>

        <template v-else-if="column.key === 'balanceAfter'">
          <span class="mono-text balance-text">
            {{ record.balanceAfter.toLocaleString() }}
          </span>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import type { RecentCreditLedgerItem } from '@/types/user'

defineOptions({
  name: 'CreditLedgerPanel',
})

const props = defineProps<{
  items: RecentCreditLedgerItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

type LedgerFilterType = 'all' | 'expense' | 'income'
const filterType = ref<LedgerFilterType>('all')

const filteredItems = computed(() => {
  if (filterType.value === 'expense') {
    return props.items.filter((item) => item.amount < 0 || item.type === 'capture' || item.type === 'reserve')
  }
  if (filterType.value === 'income') {
    return props.items.filter((item) => item.amount > 0 || item.type === 'grant' || item.type === 'refund' || item.type === 'release')
  }
  return props.items
})

const paginationConfig = computed<TablePaginationConfig>(() => ({
  current: props.page,
  pageSize: props.pageSize,
  total: props.total,
  size: 'small',
  showSizeChanger: false,
  hideOnSinglePage: props.total <= props.pageSize,
  showTotal: (t: number) => `共 ${t} 条流水`,
}))

const columns = [
  {
    title: '时间',
    key: 'createdAt',
    dataIndex: 'createdAt',
    width: 156,
  },
  {
    title: '类型',
    key: 'type',
    dataIndex: 'type',
    width: 96,
  },
  {
    title: '变更摘要',
    key: 'title',
    dataIndex: 'title',
  },
  {
    title: '变动积分',
    key: 'amount',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 112,
  },
  {
    title: '变动后余额',
    key: 'balanceAfter',
    dataIndex: 'balanceAfter',
    align: 'right' as const,
    width: 132,
  },
]

const LEDGER_TYPE_META: Record<string, { label: string; color: string }> = {
  grant: { label: '系统赠送', color: 'green' },
  capture: { label: '消费结算', color: 'blue' },
  reserve: { label: '请求预占', color: 'orange' },
  release: { label: '预占释放', color: 'cyan' },
  refund: { label: '退款返还', color: 'green' },
  adjust: { label: '余额调整', color: 'default' },
}

const getLedgerTypeMeta = (type: string) => {
  return LEDGER_TYPE_META[type] || { label: type || '其他', color: 'default' }
}

const formatLedgerTime = (value: string): string => {
  if (!value) return '未知时间'
  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

const formatLedgerAmount = (amount: number): string => {
  if (amount > 0) return `+${amount.toLocaleString()}`
  if (amount < 0) return amount.toLocaleString()
  return '0'
}

const getAmountClass = (amount: number): string => {
  if (amount > 0) return 'positive'
  if (amount < 0) return 'negative'
  return 'neutral'
}

const handleTableChange = (pagination: TablePaginationConfig) => {
  if (pagination.current && pagination.current !== props.page) {
    emit('page-change', pagination.current)
  }
}
</script>

<style scoped lang="scss">
.credit-ledger-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ledger-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.total-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #64748b;
}

.mono-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.time-text {
  font-size: 12px;
  color: #475569;
}

.type-tag {
  margin-inline-end: 0;
  font-size: 11px;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-title {
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
}

.summary-desc {
  font-size: 12px;
  color: #64748b;
}

.amount-text {
  font-size: 13px;
  font-weight: 600;

  &.positive {
    color: #15803d;
  }

  &.negative {
    color: #b91c1c;
  }

  &.neutral {
    color: #64748b;
  }
}

.balance-text {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.credit-ledger-panel {
  :deep(.ant-table-pagination.ant-pagination) {
    margin: 12px 0 0;
    align-items: center;
  }

  :deep(.ant-pagination-jump-next .ant-pagination-item-link),
  :deep(.ant-pagination-jump-prev .ant-pagination-item-link) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  :deep(.ant-pagination-jump-next .ant-pagination-item-container),
  :deep(.ant-pagination-jump-prev .ant-pagination-item-container) {
    position: relative;
    width: 24px;
    height: 24px;
  }

  :deep(.ant-pagination-jump-next .ant-pagination-item-ellipsis),
  :deep(.ant-pagination-jump-prev .ant-pagination-item-ellipsis) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
}
</style>
