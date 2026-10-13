import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/video/domain/video_task_model.dart';
import 'package:ai_chat_mobile/features/video/presentation/widgets/video_preview_modal.dart';
import 'package:ai_chat_mobile/features/video/presentation/widgets/video_task_card.dart';

void main() {
  group('VideoTaskModel & VideoStatusPayload', () {
    test('正确解析后端返回的视频生成任务结构与相对路径 URL 拼接', () {
      final json = {
        'id': 'video-task-001',
        'prompt': '赛博朋克风格未来都市雨夜，霓虹灯倒映在积水路面',
        'modelId': 'Wan-AI/Wan2.2-T2V-A14B',
        'aspectRatio': '16:9',
        'duration': 5,
        'costCredits': 200,
        'status': 'success',
        'videoUrl': '/videos/media/sample_001.mp4',
        'createdAt': '2026-10-13T10:00:00.000Z',
        'updatedAt': '2026-10-13T10:01:00.000Z',
      };

      final model = VideoTaskModel.fromJson(json);

      expect(model.id, 'video-task-001');
      expect(model.prompt, '赛博朋克风格未来都市雨夜，霓虹灯倒映在积水路面');
      expect(model.modelId, 'Wan-AI/Wan2.2-T2V-A14B');
      expect(model.aspectRatio, '16:9');
      expect(model.aspectRatioValue, closeTo(16.0 / 9.0, 0.001));
      expect(model.duration, 5);
      expect(model.costCredits, 200);
      expect(model.status, VideoTaskStatus.success);
      expect(model.status.isRunning, isFalse);
      expect(
        model.resolvedVideoUrl,
        'https://aichat.yanggenbwebsite.site/videos/media/sample_001.mp4',
      );
    });

    test('支持轮询状态更新载荷解析与状态流转判断', () {
      final statusJson = {
        'id': 'video-task-002',
        'status': 'processing',
        'videoUrl': null,
        'errorMessage': null,
        'updatedAt': '2026-10-13T10:02:00.000Z',
      };

      final payload = VideoStatusPayload.fromJson(statusJson);
      expect(payload.id, 'video-task-002');
      expect(payload.status, VideoTaskStatus.processing);
      expect(payload.status.isRunning, isTrue);
    });
  });

  group('VideoTaskCard & VideoPreviewModal Widget', () {
    testWidgets('VideoTaskCard 支持原地流式加载态展示与两行省略 + Tooltip 完整提示词', (tester) async {
      final now = DateTime.now();
      final runningTask = VideoTaskModel(
        id: 'temp_100',
        prompt: '超长提示词测试：清晨阳光穿透迷雾森林，金色丁达尔光束洒在溪流与苔藓岩石上，微风吹动树叶，4K自然纪录片质感',
        modelId: 'Wan-AI/Wan2.2-T2V-A14B',
        aspectRatio: '16:9',
        duration: 5,
        costCredits: 200,
        status: VideoTaskStatus.pending,
        createdAt: now,
        updatedAt: now,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VideoTaskCard(
              task: runningTask,
              isLatestGenerating: true,
              elapsedSeconds: 15,
              onSelectPreview: () {},
              onReuse: () {},
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.textContaining('万相视频渲染中 · 00:15s'), findsOneWidget);
      final textWidget = tester.widget<Text>(
        find.text(runningTask.prompt),
      );
      expect(textWidget.maxLines, 2);
      expect(textWidget.overflow, TextOverflow.ellipsis);
    });

    testWidgets('VideoPreviewModal 渲染高对比度关闭按钮与完整提示词', (tester) async {
      final now = DateTime.now();
      final completedTask = VideoTaskModel(
        id: 'video-task-999',
        prompt: '宇航员漂浮在璀璨星云与巨型环状行星之间',
        modelId: 'Wan-AI/Wan2.2-I2V-A14B',
        aspectRatio: '9:16',
        duration: 5,
        costCredits: 200,
        status: VideoTaskStatus.success,
        videoUrl: 'https://aichat.yanggenbwebsite.site/videos/media/space.mp4',
        createdAt: now,
        updatedAt: now,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VideoPreviewModal(
              task: completedTask,
              onReuse: () {},
            ),
          ),
        ),
      );

      expect(find.text('宇航员漂浮在璀璨星云与巨型环状行星之间'), findsOneWidget);
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);
      expect(find.text('流式播放 / 下载高清 MP4'), findsOneWidget);
    });
  });
}
