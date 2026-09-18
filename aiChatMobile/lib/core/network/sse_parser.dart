import 'dart:async';
import 'dart:convert';

/// SSE 流式数据块
class SseChunk {
  final String? delta;
  final String? reasoningDelta;
  final String? finishReason;
  final String? error;
  final String? sessionId;

  const SseChunk({
    this.delta,
    this.reasoningDelta,
    this.finishReason,
    this.error,
    this.sessionId,
  });

  factory SseChunk.fromJson(Map<String, dynamic> json) {
    return SseChunk(
      delta: json['delta'] as String?,
      reasoningDelta: json['reasoning_delta'] as String?,
      finishReason: json['finish_reason'] as String?,
      error: (json['error'] ?? json['message']) as String?,
      sessionId: json['sessionId'] as String?,
    );
  }
}

/// SSE 字节流转结构化事件解析器
class SseStreamTransformer
    extends StreamTransformerBase<List<int>, SseChunk> {
  const SseStreamTransformer();

  @override
  Stream<SseChunk> bind(Stream<List<int>> stream) {
    return stream
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .transform(_lineParserTransformer());
  }

  StreamTransformer<String, SseChunk> _lineParserTransformer() {
    return StreamTransformer<String, SseChunk>.fromHandlers(
      handleData: (String line, EventSink<SseChunk> sink) {
        final trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;

        final rawPayload = trimmed.substring(5).trim();
        if (rawPayload.isEmpty || rawPayload == '[DONE]') return;

        try {
          final dynamic decoded = jsonDecode(rawPayload);
          if (decoded is Map<String, dynamic>) {
            sink.add(SseChunk.fromJson(decoded));
          }
        } catch (_) {
          // 忽略非 JSON 格式的心跳或注释行
        }
      },
    );
  }
}
