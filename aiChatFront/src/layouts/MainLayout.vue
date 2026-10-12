<template>
  <div class="main-layout">
    <!-- 顶部统一导航栏：全局永久常驻，彻底消除 Tab 切换频闪 -->
    <AppHeaderNav />

    <!-- 主工作区：结合 KeepAlive 缓存核心视图与 150ms 优雅淡入淡出过渡 -->
    <main class="main-layout-body">
      <router-view v-slot="{ Component, route }">
        <transition name="view-fade" mode="out-in">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="route.name || route.path" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppHeaderNav from '@/components/AppHeaderNav.vue'

defineOptions({
  name: 'MainLayout',
})

// 缓存的主工作台视图组件名（对齐各页面 defineOptions name）
const cachedViews = ref([
  'ChatPage',
  'ImageWorkbenchPage',
  'VideoWorkbenchPage',
  'VoiceWorkbenchPage',
  'KnowledgeBaseWorkbench',
])
</script>

<style scoped lang="scss">
.main-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #f8fafc;
}

.main-layout-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 150ms 极轻量淡入淡出动画，无布局抖动 */
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
}
</style>
