import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/core/network/sse_parser.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';
import 'package:ai_chat_mobile/features/chat/domain/tool_model.dart';

void main() {
  group('Tool Models & Builtin Plugins', () {
    test('ToolExecutionResultModel 正确解析与序列化 JSON', () {
      final json = {
        'status': 'success',
        'output': {'expression': '1+1', 'result': 2},
        'durationMs': 12,
        'rawOutput': '2',
      };

      final result = ToolExecutionResultModel.fromJson(json);
      expect(result.status, 'success');
      expect(result.isSuccess, isTrue);
      expect(result.durationMs, 12);
      expect(result.rawOutput, '2');
      expect(result.output, isA<Map<String, dynamic>>());

      final serialized = result.toJson();
      expect(serialized['status'], 'success');
      expect(serialized['durationMs'], 12);
      expect(serialized['rawOutput'], '2');
    });

    test('ToolExecutionRecordModel 正确解析嵌套结果与字段回退', () {
      final json = {
        'id': 'tool-rec-1',
        'name': 'calculator',
        'title': '数学计算器',
        'callType': 'user_preset',
        'args': {'expression': 'sqrt(16)'},
        'result': {
          'status': 'success',
          'output': 4,
          'durationMs': 8,
          'rawOutput': '4',
        },
        'createdAt': '2026-10-11T03:00:00.000Z',
      };

      final record = ToolExecutionRecordModel.fromJson(json);
      expect(record.id, 'tool-rec-1');
      expect(record.name, 'calculator');
      expect(record.title, '数学计算器');
      expect(record.callType, 'user_preset');
      expect(record.args['expression'], 'sqrt(16)');
      expect(record.result.isSuccess, isTrue);
      expect(record.result.durationMs, 8);
      expect(record.result.rawOutput, '4');

      final serialized = record.toJson();
      expect(serialized['id'], 'tool-rec-1');
      expect(serialized['name'], 'calculator');
      expect(serialized['result']['status'], 'success');
    });

    test('BuiltinTools 完整包含 6 大核心插件且配置符合规范', () {
      final tools = BuiltinTools.defaults;
      expect(tools.length, 6);

      final ids = tools.map((t) => t.id).toList();
      expect(ids, containsAll([
        'calculator',
        'clock_calendar',
        'weather',
        'web_search_v2',
        'url_fetcher',
        'code_interpreter',
      ]));

      for (final tool in tools) {
        expect(tool.id.isNotEmpty, isTrue);
        expect(tool.title.isNotEmpty, isTrue);
        expect(tool.description.isNotEmpty, isTrue);
        expect(tool.icon.isNotEmpty, isTrue);
        expect(tool.supportsPresetMode, isTrue);
      }
    });

    test('ChatMessageModel 正确承载 toolCalls 并在 copyWith 中保留', () {
      final toolRecord = ToolExecutionRecordModel(
        id: 'rec-1',
        name: 'clock_calendar',
        title: '时钟日历',
        result: const ToolExecutionResultModel(
          status: 'success',
          output: '2026-10-11 03:00:00 UTC',
          durationMs: 5,
        ),
      );

      final msg = ChatMessageModel(
        id: 'msg-with-tools',
        sessionId: 'session-1',
        role: 'assistant',
        content: '当前时间已查询完成',
        createdAt: DateTime.now(),
        toolCalls: [toolRecord],
      );

      expect(msg.toolCalls.length, 1);
      expect(msg.toolCalls.first.title, '时钟日历');

      final updated = msg.copyWith(content: '已更新内容');
      expect(updated.content, '已更新内容');
      expect(updated.toolCalls.length, 1);
      expect(updated.toolCalls.first.name, 'clock_calendar');
    });

    test('SseChunk 正确解析 tool_result 事件分块及 rawTool 负载', () {
      final sseJson = {
        'type': 'tool_result',
        'sessionId': 'session-tool',
        'tool': {
          'id': 'tool-123',
          'name': 'weather',
          'title': '实时天气',
          'args': {'city': '北京'},
          'result': {
            'status': 'success',
            'output': {'city': '北京', 'temp': '18℃'},
            'durationMs': 35,
          },
        },
      };

      final chunk = SseChunk.fromJson(sseJson);
      expect(chunk.type, 'tool_result');
      expect(chunk.sessionId, 'session-tool');
      expect(chunk.rawTool, isNotNull);
      expect(chunk.rawTool!['id'], 'tool-123');

      final record = ToolExecutionRecordModel.fromJson(chunk.rawTool!);
      expect(record.name, 'weather');
      expect(record.result.durationMs, 35);
    });

    test('ToolExecutionRecordModel 正确解析三段式渐进流式状态 (calling / executing / completed)', () {
      final callingJson = {
        'id': 'call-1',
        'name': 'calculator',
        'status': 'calling',
        'arguments': '{"expression":"2^10"}',
      };
      final callingRecord = ToolExecutionRecordModel.fromJson(callingJson);
      expect(callingRecord.isCalling, isTrue);
      expect(callingRecord.isExecuting, isFalse);
      expect(callingRecord.args['expression'], '2^10');

      final executingJson = {
        'id': 'call-1',
        'name': 'calculator',
        'status': 'executing',
        'arguments': {'expression': '2^10'},
      };
      final executingRecord = ToolExecutionRecordModel.fromJson(executingJson);
      expect(executingRecord.isExecuting, isTrue);
      expect(executingRecord.isCalling, isFalse);

      final completedJson = {
        'id': 'call-1',
        'name': 'calculator',
        'status': 'completed',
        'arguments': {'expression': '2^10'},
        'result': {'result': 1024},
        'durationMs': 45,
      };
      final completedRecord = ToolExecutionRecordModel.fromJson(completedJson);
      expect(completedRecord.isCompleted, isTrue);
      expect(completedRecord.effectiveDurationMs, 45);
    });

    test('SseChunk 正确解析 tool_call_start / tool_call_result 及 toolCalls 集合', () {
      final startChunk = SseChunk.fromJson({
        'type': 'tool_call_start',
        'toolCall': {
          'id': 'call-react-1',
          'name': 'calculator',
          'arguments': {'expression': '10+20'},
          'status': 'calling',
        },
      });
      expect(startChunk.type, 'tool_call_start');
      expect(startChunk.rawTool, isNotNull);
      expect(startChunk.rawTool!['name'], 'calculator');

      final doneChunk = SseChunk.fromJson({
        'type': 'done',
        'toolCalls': [
          {
            'id': 'call-react-1',
            'name': 'calculator',
            'status': 'completed',
            'result': 30,
            'durationMs': 12,
          }
        ],
      });
      expect(doneChunk.rawToolCalls, isNotNull);
      expect(doneChunk.rawToolCalls!.length, 1);
      expect(doneChunk.rawToolCalls!.first['result'], 30);
    });
  });
}
