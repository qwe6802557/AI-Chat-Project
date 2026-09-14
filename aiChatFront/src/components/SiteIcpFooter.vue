<template>
  <div class="site-icp-footer">
    <a
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noopener noreferrer"
      class="icp-link"
    >
      蜀ICP备2026054363号-1
    </a>
  </div>
</template>

<script setup lang="ts">
// 工信部 ICP 备案号合规组件
defineOptions({
  name: 'SiteIcpFooter',
})
</script>

<style scoped lang="scss">
.site-icp-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 20px;

  .icp-link {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 20px;
    color: #98a2b3;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: #1570ef;
      text-decoration: underline;
    }
  }
}
</style>
