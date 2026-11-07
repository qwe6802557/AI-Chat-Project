<template>
  <div v-if="steers && steers.length > 0" class="steer-interventions-container">
    <div
      v-for="(item, idx) in steers"
      :key="item.id || idx"
      class="steer-item"
    >
      <div class="steer-badge">
        <svg class="steer-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.5 1.5L3 9h4.5L6.5 14.5 13 7H8.5L9.5 1.5z" />
        </svg>
        <span class="steer-step">Step {{ item.loopIndex }}</span>
      </div>
      <div class="steer-content">
        <span class="steer-label">即时干预:</span>
        <span class="steer-text">{{ item.message }}</span>
      </div>
      <div class="steer-time">
        {{ formatTime(item.timestamp) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SteerItem {
  id: string
  message: string
  loopIndex: number
  timestamp: number
}

defineProps<{
  steers?: SteerItem[]
}>()

const formatTime = (ts: number): string => {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<style scoped>
.steer-interventions-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 10px 0;
  width: 100%;
}

.steer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 2px solid #0f172a;
  border-radius: 6px;
  font-size: 12px;
  color: #334155;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.steer-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #0f172a;
  color: #ffffff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.steer-icon {
  width: 11px;
  height: 11px;
}

.steer-step {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.steer-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.steer-label {
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;
}

.steer-text {
  color: #0f172a;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.steer-time {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
}

:deep(.dark) .steer-item,
.dark .steer-item {
  background: #18181b;
  border-color: #27272a;
  border-left-color: #f4f4f5;
  color: #e4e4e7;
}

:deep(.dark) .steer-badge,
.dark .steer-badge {
  background: #27272a;
  color: #f4f4f5;
}

:deep(.dark) .steer-label,
.dark .steer-label {
  color: #a1a1aa;
}

:deep(.dark) .steer-text,
.dark .steer-text {
  color: #f4f4f5;
}

:deep(.dark) .steer-time,
.dark .steer-time {
  color: #71717a;
}
</style>
