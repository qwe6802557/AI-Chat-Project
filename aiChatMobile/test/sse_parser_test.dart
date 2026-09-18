import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/core/network/sse_parser.dart';

void main() {
  group('SseStreamTransformer', () {
    test('正确解析 delta 与 reasoning_delta 数据块', () async {
      final rawChunks = [
        'data: {"reasoning_delta":"正在规划请求层结构..."}\n\n',
        'data: {"delta":"好的，这是封装代码："}\n\n',
        'data: {"delta":"function test() {}"}\n\n',
        'data: [DONE]\n\n',
      ];

      final byteStream = Stream<List<int>>.fromIterable(
        rawChunks.map((s) => utf8.encode(s)),
      );

      final chunks = await byteStream
          .transform(const SseStreamTransformer())
          .toList();

      expect(chunks.length, 3);
      expect(chunks[0].reasoningDelta, '正在规划请求层结构...');
      expect(chunks[1].delta, '好的，这是封装代码：');
      expect(chunks[2].delta, 'function test() {}');
    });

    test('过滤非 JSON 异常行并正常处理错误负载', () async {
      final rawChunks = [
        ': heartbeat ping\n\n',
        'data: invalid-json-payload\n\n',
        'data: {"error":"积分余额不足"}\n\n',
      ];

      final byteStream = Stream<List<int>>.fromIterable(
        rawChunks.map((s) => utf8.encode(s)),
      );

      final chunks = await byteStream
          .transform(const SseStreamTransformer())
          .toList();

      expect(chunks.length, 1);
      expect(chunks[0].error, '积分余额不足');
    });
  });
}
