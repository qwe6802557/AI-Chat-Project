<template>
  <div v-if="shouldRender" class="search-source-gallery">
    <!-- 检索进行中状态 -->
    <div v-if="isSearching" class="searching-state">
      <div class="searching-indicator">
        <LoadingOutlined class="pulse-icon" spin />
        <span class="searching-text">正在深度联网检索中...</span>
      </div>
      <div v-if="searchQuery" class="search-query-tag">
        <span class="query-prefix">关键词:</span>
        <span class="query-content">{{ searchQuery }}</span>
      </div>
    </div>

    <!-- 来源卡片展示 -->
    <div v-else-if="sources.length > 0" class="sources-container">
      <div class="sources-header">
        <div class="header-left">
          <GlobalOutlined class="header-icon" />
          <span class="header-title">参考了 {{ sources.length }} 个网页来源</span>
        </div>
      </div>

      <div class="cards-scroll-container">
        <a
          v-for="(source, index) in sources"
          :key="source.id || index"
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="source-card"
          :title="source.snippet || source.title"
        >
          <div class="card-top-row">
            <div class="site-info">
              <img
                v-if="source.icon && !failedIcons.has(source.id ?? index)"
                :src="source.icon"
                alt=""
                class="site-icon"
                @error="markIconFailed(source.id ?? index)"
              />
              <GlobalOutlined v-else class="site-icon-fallback" />
              <span class="site-domain">{{ getDisplayDomain(source.url, source.sitename) }}</span>
            </div>
            <span class="source-index-badge">{{ source.id ?? (index + 1) }}</span>
          </div>
          <div class="card-title">{{ source.title }}</div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { GlobalOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import type { SearchSource } from '@/interface/chat'

defineOptions({
  name: 'SearchSourceGallery',
})

interface Props {
  sources?: SearchSource[]
  searchStatus?: 'searching' | 'done'
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  sources: () => [],
  searchStatus: undefined,
  searchQuery: '',
})

const failedIcons = ref<Set<number>>(new Set())

const markIconFailed = (id: number) => {
  failedIcons.value.add(id)
}

const isSearching = computed(() => props.searchStatus === 'searching')
const shouldRender = computed(() => isSearching.value || (props.sources && props.sources.length > 0))

const getDisplayDomain = (url: string, sitename?: string): string => {
  if (sitename && sitename.trim()) {
    return sitename
  }
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return '网页来源'
  }
}
</script>

<style scoped lang="scss">
.search-source-gallery {
  margin-bottom: 12px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.06);
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.searching-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  .searching-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #2563eb;
    font-size: 13px;
    font-weight: 500;
  }

  .pulse-icon {
    font-size: 14px;
    color: #2563eb;
  }

  .searching-text {
    color: #1e40af;
  }

  .search-query-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    font-size: 12px;
    color: #1d4ed8;

    .query-prefix {
      color: #64748b;
    }

    .query-content {
      font-weight: 500;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.sources-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #475467;
    font-size: 12px;
    font-weight: 500;
  }

  .header-icon {
    color: #2563eb;
    font-size: 13px;
  }
}

.cards-scroll-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.4);
    border-radius: 2px;
  }
}

.source-card {
  flex: 0 0 170px;
  width: 170px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  &:hover {
    border-color: #93c5fd;
    background: #f8fafc;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.08);

    .card-title {
      color: #1d4ed8;
    }
  }

  .card-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .site-info {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }

  .site-icon {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .site-icon-fallback {
    font-size: 13px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .site-domain {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1;
  }

  .source-index-badge {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #475467;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .card-title {
    font-size: 12px;
    font-weight: 500;
    color: #1e293b;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    transition: color 0.2s ease;
  }
}
</style>
