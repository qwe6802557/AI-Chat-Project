import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores'

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('sets auth session and persists user profile fields', () => {
    const store = useAuthStore()

    store.setAuthSession({
      token: 'token-123',
      user: {
        id: 'user-1',
        username: 'tester',
        email: 'tester@example.com',
        avatar: 'https://example.com/avatar.png',
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    })

    expect(store.isAuthenticated).toBe(true)
    expect(store.userId).toBe('user-1')
    expect(store.username).toBe('tester')
    expect(store.userProfile?.email).toBe('tester@example.com')
    expect(store.userAvatar).toBe('https://example.com/avatar.png')
    expect(localStorage.getItem('token')).toBe('token-123')
    expect(localStorage.getItem('userId')).toBe('user-1')
    expect(localStorage.getItem('username')).toBe('tester')
    expect(localStorage.getItem('userAvatar')).toBe('https://example.com/avatar.png')
  })

  it('restores persisted state and clears all auth artifacts', () => {
    localStorage.setItem('token', 'token-restore')
    localStorage.setItem('userId', 'restore-user')
    localStorage.setItem('username', 'restore-name')
    localStorage.setItem('rememberedUsername', 'remember-me')
    localStorage.setItem('userAvatar', 'https://example.com/restore.png')
    localStorage.setItem('userProfile', JSON.stringify({
      id: 'restore-user',
      username: 'restore-name',
      avatar: 'https://example.com/restore.png',
    }))

    const store = useAuthStore()
    store.initFromStorage()

    expect(store.isAuthenticated).toBe(true)
    expect(store.rememberedUsername).toBe('remember-me')
    expect(store.userProfile?.id).toBe('restore-user')
    expect(store.userAvatar).toBe('https://example.com/restore.png')

    store.clearAuth()

    expect(store.isAuthenticated).toBe(false)
    expect(store.userProfile).toBeNull()
    expect(store.userAvatar).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
    expect(localStorage.getItem('username')).toBeNull()
    expect(localStorage.getItem('userProfile')).toBeNull()
    expect(localStorage.getItem('userAvatar')).toBeNull()
    expect(localStorage.getItem('rememberedUsername')).toBe('remember-me')
  })
})
