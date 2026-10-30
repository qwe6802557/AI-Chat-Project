<template>
  <a-modal
    :open="open"
    title="智能助理接入通道"
    width="860px"
    :footer="null"
    destroy-on-close
    class="assistant-channel-modal"
    @update:open="emit('update:open', $event)"
  >
    <div class="assistant-modal-body">
      <!-- 顶部功能简介 -->
      <div class="header-intro">
        <div class="intro-left">
          <p class="intro-title">接入通道</p>
          <p class="intro-desc">接入后可直接在各个 IM 软件中与 AI 助理对话，支持私聊问答与群聊智能响应。</p>
        </div>
        <div class="intro-right">
          <a-button size="small" :loading="loading" @click="fetchChannels">
            <template #icon><ReloadOutlined /></template>
            刷新状态
          </a-button>
        </div>
      </div>

      <!-- 骨架屏 / 通道列表 -->
      <div v-if="loading && channels.length === 0" class="loading-skeleton">
        <a-skeleton active :paragraph="{ rows: 4 }" />
      </div>

      <div v-else class="channels-stack">
        <ChannelCardItem
          v-for="ch in channels"
          :key="ch.channelType"
          :channel="ch"
          :model-list="modelList"
          @refresh="fetchChannels"
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import ChannelCardItem from './ChannelCardItem.vue'
import { getChannelList, type ChannelInfo } from '@/api/channel'
import { getActiveModels, type BackendAiModel } from '@/api/model'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const loading = ref(false)
const channels = ref<ChannelInfo[]>([])
const modelList = ref<BackendAiModel[]>([])

const fetchChannels = async () => {
  try {
    loading.value = true
    const res = await getChannelList()
    if (res.data) {
      channels.value = res.data
    }
  } catch (err: any) {
    message.error(err.message || '获取接入通道列表失败')
  } finally {
    loading.value = false
  }
}

const fetchModels = async () => {
  try {
    const res = await getActiveModels({ category: 'chat' })
    if (res.data) {
      modelList.value = res.data
    }
  } catch {
    // 忽略模型列表获取失败
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      fetchChannels()
      fetchModels()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.open) {
    fetchChannels()
    fetchModels()
  }
})
</script>

<style scoped>
.assistant-modal-body {
  padding: 8px 4px 16px;
}

.header-intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.intro-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.intro-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.intro-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.channels-stack {
  display: flex;
  flex-direction: column;
}

.loading-skeleton {
  padding: 20px;
}
</style>
