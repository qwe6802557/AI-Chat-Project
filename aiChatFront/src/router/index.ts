import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login/index.vue'),
      meta: {
        title: 'Login',
        requiresAuth: false,
      },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register/index.vue'),
      meta: {
        title: 'Sign Up',
        requiresAuth: false,
      },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/ForgotPassword/index.vue'),
      meta: {
        title: 'Forgot Password',
        requiresAuth: false,
      },
    },
    {
      path: '/',
      redirect: '/chat',
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/Chat/index.vue'),
      meta: {
        title: 'ERJ Chat',
        requiresAuth: true,
      },
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('../views/TestView.vue'),
    },
  ],
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 更新页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - ERJ Chat`
  } else {
    document.title = 'ERJ Chat'
  }

  // 使用 authStore 检查认证状态
  const authStore = useAuthStore()

  // 首次访问时从 localStorage 初始化状态
  if (!authStore.token) {
    authStore.initFromStorage()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 需要认证但未登录-跳转到登录页
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'login' || to.name === 'register' || to.name === 'forgot-password') && authStore.isAuthenticated) {
    // 已登录用户访问登录/注册/忘记密码页，跳转到聊天页
    next({ name: 'chat' })
  } else {
    next()
  }
})

export default router
