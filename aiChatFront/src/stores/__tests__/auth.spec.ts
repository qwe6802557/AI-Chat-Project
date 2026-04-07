import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores'

const createJwtToken = (payload: Record<string, unknown>): string => {
  const encodeBase64Url = (value: string): string => {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  }

  return [
    encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    encodeBase64Url(JSON.stringify(payload)),
    'signature',
  ].join('.')
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('sets auth session and persists user profile fields', () => {
    const store = useAuthStore()
    const validToken = createJwtToken({
      exp: Math.floor(Date.now() / 1000) + 3600,
      userId: 'user-1',
    })

    store.setAuthSession({
      token: validToken,
      user: {
        id: 'user-1',
        username: 'tester',
        email: 'tester@example.com',
        avatar: 'https://example.com/avatar.png',
        credits: {
          total: 2000,
          consumed: 0,
          remaining: 2000,
          reserved: 0,
        },
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
    expect(store.userProfile?.credits?.remaining).toBe(2000)
    expect(store.userAvatar).toBe('https://example.com/avatar.png')
    expect(localStorage.getItem('token')).toBe(validToken)
    expect(localStorage.getItem('userId')).toBe('user-1')
    expect(localStorage.getItem('username')).toBe('tester')
    expect(localStorage.getItem('userAvatar')).toBe('https://example.com/avatar.png')
  })

  it('restores persisted state and clears all auth artifacts', () => {
    const validToken = createJwtToken({
      exp: Math.floor(Date.now() / 1000) + 3600,
      userId: 'restore-user',
    })

    localStorage.setItem('token', validToken)
    localStorage.setItem('userId', 'restore-user')
    localStorage.setItem('username', 'restore-name')
    localStorage.setItem('rememberedUsername', 'remember-me')
    localStorage.setItem('userAvatar', 'https://example.com/restore.png')
    localStorage.setItem('userProfile', JSON.stringify({
      id: 'restore-user',
      username: 'restore-name',
      avatar: 'https://example.com/restore.png',
      credits: {
        total: 2000,
        consumed: 100,
        remaining: 1900,
      },
    }))

    const store = useAuthStore()
    store.initFromStorage()

    expect(store.isAuthenticated).toBe(true)
    expect(store.rememberedUsername).toBe('remember-me')
    expect(store.userProfile?.id).toBe('restore-user')
    expect(store.userProfile?.credits?.remaining).toBe(1900)
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

  it('clears expired token during storage restore', () => {
    const expiredToken = createJwtToken({
      exp: Math.floor(Date.now() / 1000) - 60,
      userId: 'expired-user',
    })

    localStorage.setItem('token', expiredToken)
    localStorage.setItem('userId', 'expired-user')
    localStorage.setItem('username', 'expired-name')
    localStorage.setItem('rememberedUsername', 'remember-expired')

    const store = useAuthStore()
    store.initFromStorage()

    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
    expect(store.userId).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
    expect(localStorage.getItem('rememberedUsername')).toBe('remember-expired')
  })
})
