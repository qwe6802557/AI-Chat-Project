import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/core/network/sse_parser.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_session_model.dart';
import 'package:ai_chat_mobile/features/chat/domain/swarm_timeline_event_model.dart';
import 'package:ai_chat_mobile/features/orchestration/domain/channel_model.dart';
import 'package:ai_chat_mobile/features/orchestration/domain/trace_model.dart';
import 'package:ai_chat_mobile/features/orchestration/domain/workflow_model.dart';

void main() {
  group('Stage 4 SSE & Domain Models', () {
    test('SseChunk parses trace_started, agent_timeline_event, and done telemetry', () {
      final startChunk = SseChunk.fromJson({
        'type': 'trace_started',
        'traceId': 'tr_abcdef123456',
      });
      expect(startChunk.type, 'trace_started');
      expect(startChunk.traceId, 'tr_abcdef123456');

      final eventChunk = SseChunk.fromJson({
        'type': 'agent_timeline_event',
        'timelineEvent': {
          'id': 'evt_1',
          'type': 'dag_node',
          'timestamp': 1700000001000,
          'fromAgent': 'DAG 引擎',
          'toAgent': '巡检分析节点',
          'modelId': 'spark-x2.6-4b',
          'durationMs': 420,
          'status': 'completed',
        },
      });
      expect(eventChunk.rawTimelineEvent?['toAgent'], '巡检分析节点');

      final doneChunk = SseChunk.fromJson({
        'type': 'done',
        'finish_reason': 'stop',
        'traceId': 'tr_abcdef123456',
        'durationMs': 1580,
        'usage': {'totalTokens': 320},
        'agentTimeline': [
          {
            'id': 'evt_1',
            'type': 'dag_node',
            'timestamp': 1700000001000,
            'fromAgent': 'DAG 引擎',
            'toAgent': '巡检分析节点',
            'status': 'completed',
          },
        ],
      });
      expect(doneChunk.durationMs, 1580);
      expect(doneChunk.rawUsage?['totalTokens'], 320);
      expect(doneChunk.rawAgentTimeline, hasLength(1));
    });

    test('ChatMessageModel preserves Stage 4 fields across toJson/fromJson and falls back on legacy cache', () {
      final original = ChatMessageModel(
        id: 'm1',
        sessionId: 's1',
        role: 'assistant',
        content: '诊断完毕',
        createdAt: DateTime.parse('2026-11-28T10:00:00.000Z'),
        traceId: 'tr_99887766',
        durationMs: 1200,
        totalTokens: 210,
        agentTimeline: const [
          SwarmTimelineEventModel(
            id: 'n1',
            type: 'dag_node',
            timestamp: 100,
            fromAgent: 'DAG 引擎',
            toAgent: '分析节点',
            durationMs: 600,
            status: 'completed',
          ),
        ],
      );

      final roundTrip = ChatMessageModel.fromJson(original.toJson());
      expect(roundTrip.traceId, 'tr_99887766');
      expect(roundTrip.durationMs, 1200);
      expect(roundTrip.totalTokens, 210);
      expect(roundTrip.agentTimeline, hasLength(1));
      expect(roundTrip.agentTimeline.first.toAgent, '分析节点');

      final legacy = ChatMessageModel.fromJson({
        'id': 'old1',
        'sessionId': 's1',
        'role': 'assistant',
        'content': '旧版消息',
        'createdAt': '2026-11-20T00:00:00.000Z',
      });
      expect(legacy.agentTimeline, isEmpty);
      expect(legacy.traceId, isNull);
    });

    test('ChatSessionModel, WorkflowItemModel, TraceDetailModel, and ChannelInstanceModel decode backend contracts', () {
      final session = ChatSessionModel.fromJson({
        'id': 'sess-1',
        'title': '工作流会话',
        'activeWorkflowId': 'wf-1',
        'createdAt': '2026-11-28T00:00:00.000Z',
        'updatedAt': '2026-11-28T00:00:00.000Z',
      });
      expect(session.activeWorkflowId, 'wf-1');

      final wf = WorkflowItemModel.fromJson({
        'id': 'wf-1',
        'name': '微服务巡检链',
        'status': 'published',
        'version': 2,
        'draftGraph': {
          'nodes': [
            {'id': 'end', 'type': 'end', 'data': {'label': '汇总输出'}},
            {'id': 'start', 'type': 'start', 'data': {'label': '开始输入'}},
            {'id': 'agent', 'type': 'agent', 'data': {'label': '诊断智能体'}},
          ],
          'edges': [
            {'id': 'e1', 'source': 'start', 'target': 'agent'},
            {'id': 'e2', 'source': 'agent', 'target': 'end'},
          ],
        },
      });
      expect(wf.isPublished, isTrue);
      expect(
        wf.displayGraph.orderedNodes.map((n) => n.id).toList(),
        ['start', 'agent', 'end'],
      );

      final channel = ChannelInstanceModel.fromJson({
        'id': 'ch-1',
        'channelType': 'wecom_bot',
        'name': '企微智能机器人',
        'instanceName': '研发企微助手',
        'workflowId': 'wf-1',
        'isEnabled': true,
        'status': 'connected',
        'credentialsMasked': {'botId': 'aib***99'},
      });
      expect(channel.channelLabel, '企微智能机器人');
      expect(channel.isConnected, isTrue);
      expect(channel.workflowId, 'wf-1');

      final detail = TraceDetailModel.fromJson({
        'trace': {
          'id': 't-uuid',
          'traceId': 'tr_12345678',
          'source': 'workflow_chat',
          'status': 'completed',
          'durationMs': 980,
          'totalPromptTokens': 100,
          'totalCompletionTokens': 50,
          'totalCredits': 1.5,
          'createdAt': '2026-11-28T10:00:00.000Z',
        },
        'spans': [
          {
            'id': 'sp-1',
            'traceId': 'tr_12345678',
            'spanId': 'span_root',
            'spanType': 'workflow',
            'name': 'DAG 主干',
            'status': 'completed',
            'startedAt': 1000,
            'durationMs': 980,
          },
        ],
      });
      expect(detail.trace.shortId, '12345678');
      expect(detail.trace.totalTokens, 150);
      expect(detail.spans.single.name, 'DAG 主干');
    });
  });
}
