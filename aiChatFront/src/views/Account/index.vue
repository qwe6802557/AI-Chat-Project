<template>
  <div class="account-page">
    <header class="account-page-header">
      <button class="back-button" type="button" @click="handleBack">
        <ArrowLeftOutlined />
        <span>返回对话</span>
      </button>
    </header>

    <main class="account-page-main">
      <AccountModal inline layout-mode="page" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import AccountModal from '../Chat/components/AccountModal.vue'

defineOptions({
  name: 'AccountPage',
})

const BACK_TARGET_STORAGE_KEY = 'accountPageBackTarget'

const router = useRouter()
const route = useRoute()

const resolveBackTarget = (): string => {
  const fromQuery = typeof route.query.from === 'string' ? route.query.from : ''
  if (fromQuery.startsWith('/')) {
    sessionStorage.setItem(BACK_TARGET_STORAGE_KEY, fromQuery)
    return fromQuery
  }

  const storedTarget = sessionStorage.getItem(BACK_TARGET_STORAGE_KEY) || ''
  if (storedTarget.startsWith('/')) {
    return storedTarget
  }

  return '/chat'
}

const backTarget = computed(() => {
  return resolveBackTarget()
})

const handleBack = async () => {
  await router.push(backTarget.value)
}

watch(
  () => route.query.from,
  () => {
    resolveBackTarget()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.account-page {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(21, 112, 239, 0.12), transparent 28%),
    radial-gradient(circle at right center, rgba(15, 23, 42, 0.06), transparent 24%),
    linear-gradient(180deg, #fbfcfe 0%, #f3f5f9 100%);
}

.account-page-header {
  position: relative;
  z-index: 1;
  padding: 12px 16px 0;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
  color: #101828;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: #ffffff;
    border-color: rgba(15, 23, 42, 0.14);
    transform: translateY(-1px);
  }

  :deep(.anticon) {
    font-size: 14px;
  }
}

.account-page-main {
  min-height: 0;
  padding: 10px 16px 16px;
  display: flex;

  :deep(.account-inline) {
    flex: 1;
    min-height: 0;
  }
}

@media (max-width: 640px) {
  .account-page-header {
    padding: 12px 12px 0;
  }

  .account-page-main {
    padding: 10px 12px 12px;
  }

  .back-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
