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

    test('正确解析联网搜索 search_start 与 search_sources 事件分块', () async {
      final rawChunks = [
        'data: {"type":"search_start","sessionId":"sess_1","query":"今日人工智能新闻"}\n\n',
        'data: {"type":"search_sources","sessionId":"sess_1","sources":[{"id":1,"title":"AI快讯","url":"https://example.com/ai","sitename":"AI新闻网","snippet":"最新进展"}]}\n\n',
        'data: {"type":"answer_delta","delta":"根据最新资讯："}\n\n',
      ];

      final byteStream = Stream<List<int>>.fromIterable(
        rawChunks.map((s) => utf8.encode(s)),
      );

      final chunks = await byteStream
          .transform(const SseStreamTransformer())
          .toList();

      expect(chunks.length, 3);
      expect(chunks[0].type, 'search_start');
      expect(chunks[0].searchQuery, '今日人工智能新闻');
      expect(chunks[1].type, 'search_sources');
      expect(chunks[1].rawSources?.length, 1);
      expect(chunks[1].rawSources?[0]['title'], 'AI快讯');
      expect(chunks[2].delta, '根据最新资讯：');
    });
  });
}
