import { TraceContextService } from './trace-context.service';
import type { TraceStorageService } from './trace-storage.service';
import { summarizeTracePayload } from '../utils/trace-sanitizer.util';

describe('TraceContextService & Sanitizer', () => {
  it('masks sensitive keys, bearer tokens, and base64 images while truncating payloads', () => {
    const raw = {
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret',
      apiKey: 'sk-1234567890abcdef',
      image:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
      padding: 'x'.repeat(2048),
    };

    const summary = summarizeTracePayload(raw, 512);
    expect(summary).toBeTruthy();
    expect(summary).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(summary).not.toContain('sk-1234567890abcdef');
    expect(summary).toContain('[base64-image-omitted]');
    expect(Buffer.byteLength(summary!, 'utf8')).toBeLessThanOrEqual(512);
  });

  it('propagates traceId and parentSpanId across nested async spans and streams', async () => {
    const appendedSpans: Parameters<TraceStorageService['appendSpan']>[0][] =
      [];
    const createdTraces: Parameters<TraceStorageService['createTrace']>[0][] =
      [];
    const finalizedTraces: Parameters<
      TraceStorageService['finalizeTrace']
    >[0][] = [];

    const mockStorage: Partial<TraceStorageService> = {
      createTrace: jest.fn((input) => {
        createdTraces.push(input);
        return Promise.resolve();
      }),
      finalizeTrace: jest.fn((input) => {
        finalizedTraces.push(input);
        return Promise.resolve();
      }),
      appendSpan: jest.fn((input) => {
        appendedSpans.push(input);
        return Promise.resolve();
      }),
    };

    const service = new TraceContextService(mockStorage as TraceStorageService);

    const output = await service.runWithTrace(
      { userId: 'u-1', source: 'web_chat', title: '嵌套测试' },
      async (traceId) => {
        return service.withSpan(
          { spanType: 'workflow', name: 'DAG Root' },
          async (parentRecorder) => {
            const parentSpanId = service.getCurrentSpanId();
            expect(service.getCurrentTraceId()).toBe(traceId);

            // 非 LLM 父节点不应重复累加 token，仅由 LLM 叶子节点聚合
            parentRecorder?.setUsage({
              promptTokens: 999,
              completionTokens: 999,
            });

            const stream = service.wrapAsyncIterableSpan(
              { spanType: 'llm', name: 'LLM Stream', modelId: 'GLM-5' },
              (async function* () {
                await Promise.resolve();
                yield { delta: { content: '你好' } };
                yield {
                  delta: { content: '世界' },
                  usage: {
                    promptTokens: 20,
                    completionTokens: 10,
                    estimatedTotalCost: 0.4,
                  },
                };
              })(),
            );

            let text = '';
            for await (const chunk of stream) {
              text += chunk.delta?.content || '';
            }

            expect(service.getCurrentSpanId()).toBe(parentSpanId);
            return text;
          },
        );
      },
    );

    expect(output).toBe('你好世界');
    expect(createdTraces).toHaveLength(1);
    expect(finalizedTraces).toHaveLength(1);
    expect(finalizedTraces[0]).toMatchObject({
      status: 'completed',
      totalPromptTokens: 20,
      totalCompletionTokens: 10,
      totalCredits: 0.4,
    });
    expect(appendedSpans).toHaveLength(2);
    const llmSpan = appendedSpans.find((s) => s.spanType === 'llm');
    const rootSpan = appendedSpans.find((s) => s.spanType === 'workflow');
    expect(llmSpan?.parentSpanId).toBe(rootSpan?.spanId);
  });

  it('honors outcome and minimum credit overrides when DAG terminates gracefully as failed', async () => {
    const finalizedTraces: Parameters<
      TraceStorageService['finalizeTrace']
    >[0][] = [];
    const mockStorage: Partial<TraceStorageService> = {
      createTrace: jest.fn(() => Promise.resolve()),
      finalizeTrace: jest.fn((input) => {
        finalizedTraces.push(input);
        return Promise.resolve();
      }),
      appendSpan: jest.fn(() => Promise.resolve()),
    };

    const service = new TraceContextService(mockStorage as TraceStorageService);
    await service.runWithTrace(
      { userId: 'u-1', source: 'workflow_debug', title: '失败收敛测试' },
      async () => {
        await Promise.resolve();
        service.markCurrentTraceOutcome('failed', '模型通道异常');
        service.ensureMinimumTraceCredits(1);
        return { status: 'failed' };
      },
    );

    expect(finalizedTraces).toHaveLength(1);
    expect(finalizedTraces[0]).toMatchObject({
      status: 'failed',
      errorSummary: '模型通道异常',
      totalCredits: 1,
    });
  });
});
