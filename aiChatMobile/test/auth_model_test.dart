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
  });
}
