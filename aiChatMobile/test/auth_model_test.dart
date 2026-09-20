import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/auth/domain/user_model.dart';

void main() {
  group('UserModel & UserCredits', () {
    test('正确从后端 JSON 结构映射用户与积分实体', () {
      final json = {
        'id': 'user-uuid-1234',
        'username': 'tester',
        'email': 'tester@example.com',
        'role': 'user',
        'credits': {
          'total': 2000,
          'consumed': 150,
          'remaining': 1850,
          'reserved': 10,
        },
      };

      final user = UserModel.fromJson(json);

      expect(user.id, 'user-uuid-1234');
      expect(user.username, 'tester');
      expect(user.email, 'tester@example.com');
      expect(user.credits.total, 2000);
      expect(user.credits.consumed, 150);
      expect(user.credits.remaining, 1850);
      expect(user.credits.reserved, 10);
    });

    test('toJson 和 fromJson 互转序列化一致性', () {
      const user = UserModel(
        id: 'u-1',
        username: 'alice',
        email: 'alice@example.com',
        role: 'user',
        credits: UserCredits(total: 100, consumed: 10, remaining: 90, reserved: 0),
      );

      final map = user.toJson();
      expect(map['id'], 'u-1');
      expect(map['credits']['remaining'], 90);

      final reconstructed = UserModel.fromJson(map);
      expect(reconstructed.id, user.id);
      expect(reconstructed.username, user.username);
      expect(reconstructed.credits.remaining, 90);
    });
  });
}
