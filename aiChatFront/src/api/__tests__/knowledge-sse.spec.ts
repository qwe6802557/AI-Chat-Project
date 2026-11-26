import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { subscribeKnowledgeDocumentEvents } from '../knowledge'
import { useAuthStore } from '@/stores'
import type { DocumentProgressStreamEvent } from '@/interface/knowledge'
import type { UserInfo } from '@/types/user'

describe('subscribeKnowledgeDocumentEvents', () => {
  let activeHandle: { abort: () => void } | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.setAuthSession({
      token: 'test-jwt-token',
      user: {
        id: 'u1',
        username: 'tester',
      } as UserInfo,
    })
  })

  afterEach(() => {
    activeHandle?.abort()
    activeHandle = null
    vi.restoreAllMocks()
  })

  it('sends Bearer token and parses snapshot and progress SSE chunks', async () => {
    const encoder = new TextEncoder()
    const events: DocumentProgressStreamEvent[] = []

    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          encoder.encode(
            'data: {"type":"snapshot","knowledgeBaseId":"kb-1","documents":[{"documentId":"doc-1","knowledgeBaseId":"kb-1","status":"pending","stage":"queued","progress":0,"updatedAt":"2026-11-26T00:00:00Z"}]}\n\n',
          ),
        )
        ctrl.enqueue(
          encoder.encode(
            ': heartbeat\n\ndata: {"type":"progress","documentId":"doc-1","knowledgeBaseId":"kb-1","userId":"u1","status":"processing","stage":"embedding","progress":55,"processedChunks":16,"totalChunks":32,"updatedAt":"2026-11-26T00:00:01Z"}\n\n',
          ),
        )
        ctrl.enqueue(
          encoder.encode(
            'data: {"type":"completed","documentId":"doc-1","knowledgeBaseId":"kb-1","userId":"u1","status":"completed","stage":"completed","progress":100,"chunkCount":32,"charCount":9800,"updatedAt":"2026-11-26T00:00:02Z"}\n\n',
          ),
        )
        ctrl.close()
      },
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    activeHandle = subscribeKnowledgeDocumentEvents('kb-1', {
      onEvent: (evt) => {
        events.push(evt)
        if (evt.type === 'completed') {
          activeHandle?.abort()
        }
      },
    })

    await vi.waitFor(() => {
      expect(events).toHaveLength(3)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/knowledge-bases/kb-1/documents/events'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer test-jwt-token',
        }),
      }),
    )
    expect(events[0].type).toBe('snapshot')
    expect(events[1]).toMatchObject({
      type: 'progress',
      stage: 'embedding',
      progress: 55,
      processedChunks: 16,
      totalChunks: 32,
    })
    expect(events[2]).toMatchObject({
      type: 'completed',
      progress: 100,
      chunkCount: 32,
    })
  })
})
