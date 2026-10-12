import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import MainLayout from '../MainLayout.vue'

vi.mock('@/components/AppHeaderNav.vue', () => ({
  default: {
    name: 'AppHeaderNav',
    template: '<header class="mock-header-nav">Header Nav</header>',
  },
}))

describe('MainLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders persistent AppHeaderNav and caches workbench components', async () => {
    let chatMountedCount = 0
    let imageMountedCount = 0

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: MainLayout,
          children: [
            {
              path: 'chat',
              name: 'Chat',
              component: {
                name: 'ChatPage',
                template: '<div class="test-chat-page">Chat Page Content</div>',
                mounted() {
                  chatMountedCount++
                },
              },
            },
            {
              path: 'image',
              name: 'ImageWorkbench',
              component: {
                name: 'ImageWorkbenchPage',
                template: '<div class="test-image-page">Image Page Content</div>',
                mounted() {
                  imageMountedCount++
                },
              },
            },
          ],
        },
      ],
    })

    router.push('/chat')
    await router.isReady()

    const wrapper = mount(
      {
        components: { RouterView },
        template: '<RouterView />',
      },
      {
        global: {
          plugins: [router],
          stubs: {
            transition: {
              template: '<slot />',
            },
          },
        },
      }
    )

    await flushPromises()

    // 验证常驻导航栏与 ChatPage 已挂载
    expect(wrapper.find('.mock-header-nav').exists()).toBe(true)
    expect(wrapper.find('.test-chat-page').exists()).toBe(true)
    expect(chatMountedCount).toBe(1)

    // 切换到 /image
    await router.push('/image')
    await flushPromises()

    // 验证常驻导航栏仍然存在且未重复销毁，ImageWorkbenchPage 正确挂载
    expect(wrapper.find('.mock-header-nav').exists()).toBe(true)
    expect(wrapper.find('.test-image-page').exists()).toBe(true)
    expect(imageMountedCount).toBe(1)

    // 切回 /chat，验证 KeepAlive 生效（ChatPage 不重新触发 mounted）
    await router.push('/chat')
    await flushPromises()

    expect(wrapper.find('.test-chat-page').exists()).toBe(true)
    expect(chatMountedCount).toBe(1)
  })
})
