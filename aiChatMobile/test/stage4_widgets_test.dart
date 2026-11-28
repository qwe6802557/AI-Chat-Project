import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/domain/swarm_timeline_event_model.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/agent_collaboration_timeline.dart';
import 'package:ai_chat_mobile/features/orchestration/domain/trace_model.dart';
import 'package:ai_chat_mobile/features/orchestration/presentation/widgets/trace_span_waterfall.dart';

void main() {
  testWidgets(
    'AgentCollaborationTimeline expands during streaming and auto-collapses to a 1-line summary pill on done',
    (WidgetTester tester) async {
      final runningTimeline = [
        const SwarmTimelineEventModel(
          id: 'e1',
          type: 'dag_node',
          timestamp: 1000,
          fromAgent: 'DAG 引擎',
          toAgent: '巡检分析节点',
          task: '扫描核心接口延迟',
          status: 'running',
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AgentCollaborationTimeline(
              timeline: runningTimeline,
              streaming: true,
              autoCollapseOnComplete: true,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('协同执行中'), findsOneWidget);
      expect(find.text('巡检分析节点'), findsOneWidget);

      final doneTimeline = [
        const SwarmTimelineEventModel(
          id: 'e1',
          type: 'dag_node',
          timestamp: 1000,
          fromAgent: 'DAG 引擎',
          toAgent: '巡检分析节点',
          durationMs: 1200,
          status: 'completed',
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AgentCollaborationTimeline(
              timeline: doneTimeline,
              streaming: false,
              autoCollapseOnComplete: true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('已完成'), findsOneWidget);
      expect(find.text('1 节点'), findsOneWidget);
      expect(find.text('1.2s'), findsOneWidget);
      expect(find.text('巡检分析节点'), findsNothing);

      // 点击单行胶囊重新展开详情
      await tester.tap(find.text('多智能体协同'));
      await tester.pumpAndSettle();
      expect(find.text('巡检分析节点'), findsOneWidget);
    },
  );

  testWidgets('TraceSpanWaterfall renders spans and updates inspector on tap', (
    WidgetTester tester,
  ) async {
    const spans = [
      AgentSpanItemModel(
        id: '1',
        traceId: 'tr_1',
        spanId: 'sp_wf',
        spanType: 'workflow',
        name: '工作流根节点',
        status: 'completed',
        startedAt: 1000,
        durationMs: 800,
        inputSummary: '{"query":"health check"}',
        outputSummary: '{"ok":true}',
      ),
      AgentSpanItemModel(
        id: '2',
        traceId: 'tr_1',
        spanId: 'sp_llm',
        parentSpanId: 'sp_wf',
        spanType: 'llm',
        name: 'Spark 模型推理',
        modelId: 'spark-x2.6-4b',
        status: 'completed',
        startedAt: 1100,
        durationMs: 600,
        promptTokens: 80,
        completionTokens: 40,
        inputSummary: '{"prompt":"inspect"}',
        outputSummary: '{"advice":"healthy"}',
      ),
    ];

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: TraceSpanWaterfall(spans: spans),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Span 调用瀑布流'), findsOneWidget);
    expect(find.text('工作流根节点'), findsWidgets);
    expect(find.text('{"query":"health check"}'), findsOneWidget);

    await tester.tap(find.text('Spark 模型推理').first);
    await tester.pump();

    expect(find.text('{"prompt":"inspect"}'), findsOneWidget);
    expect(find.text('{"advice":"healthy"}'), findsOneWidget);
  });
}
