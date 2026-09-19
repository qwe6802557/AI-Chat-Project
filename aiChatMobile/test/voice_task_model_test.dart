import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/voice/domain/voice_task_model.dart';
import 'package:ai_chat_mobile/core/constants/api_constants.dart';

void main() {
  group('VoiceTaskModel & VoiceInfoModel', () {
    test('正确解析 TTS 任务并补全相对音频路径', () {
      final json = {
        'id': 'voice-task-001',
        'userId': 'user-123',
        'type': 'tts',
        'model': 'grok-voice-think-fast-1.0',
        'voiceId': 'voice_xiaoyan',
        'language': 'zh',
        'speed': 1.25,
        'text': '你好，欢迎使用 AI 语音工作台！',
        'audioUrl': '/uploads/voice/tts_001.mp3',
        'costCredits': 20,
        'duration': 3.5,
        'status': 'success',
        'createdAt': '2026-09-19T12:00:00.000Z',
        'updatedAt': '2026-09-19T12:00:05.000Z',
      };

      final model = VoiceTaskModel.fromJson(json);

      expect(model.id, 'voice-task-001');
      expect(model.userId, 'user-123');
      expect(model.type, VoiceTaskType.tts);
      expect(model.model, 'grok-voice-think-fast-1.0');
      expect(model.voiceId, 'voice_xiaoyan');
      expect(model.language, 'zh');
      expect(model.speed, 1.25);
      expect(model.text, '你好，欢迎使用 AI 语音工作台！');
      expect(model.audioUrl, '${ApiConstants.baseUrl}/uploads/voice/tts_001.mp3');
      expect(model.costCredits, 20);
      expect(model.duration, 3.5);
      expect(model.status, VoiceTaskStatus.success);
      expect(model.errorMessage, isNull);
    });

    test('正确解析 STT 语音转写任务并支持 failed 状态', () {
      final json = {
        'id': 'stt-task-002',
        'userId': 'user-123',
        'type': 'stt',
        'model': 'grok-stt',
        'language': 'en',
        'text': 'Audio recognition encountered network jitter.',
        'audioUrl': 'https://custom-cdn.example.com/audio/sample.wav',
        'costCredits': 20,
        'status': 'failed',
        'errorMessage': '音频解码异常，已退还积分',
        'createdAt': '2026-09-19T12:10:00.000Z',
      };

      final model = VoiceTaskModel.fromJson(json);

      expect(model.id, 'stt-task-002');
      expect(model.type, VoiceTaskType.stt);
      expect(model.audioUrl, 'https://custom-cdn.example.com/audio/sample.wav');
      expect(model.status, VoiceTaskStatus.failed);
      expect(model.errorMessage, '音频解码异常，已退还积分');
    });

    test('空值与默认字段容错处理', () {
      final json = {
        'id': 'empty-task',
        'type': 'tts',
      };

      final model = VoiceTaskModel.fromJson(json);

      expect(model.id, 'empty-task');
      expect(model.type, VoiceTaskType.tts);
      expect(model.speed, 1.0);
      expect(model.language, 'zh');
      expect(model.costCredits, ApiConstants.voiceUnitCost);
      expect(model.audioUrl, isNull);
      expect(model.status, VoiceTaskStatus.pending);
    });

    test('VoiceInfoModel 正确解析音色数据', () {
      final json = {
        'voice_id': 'voice_xiaoyan',
        'name': '晓燕 (活力女声)',
        'language': 'zh',
      };

      final voice = VoiceInfoModel.fromJson(json);

      expect(voice.voiceId, 'voice_xiaoyan');
      expect(voice.name, '晓燕 (活力女声)');
      expect(voice.language, 'zh');
    });
  });
}
