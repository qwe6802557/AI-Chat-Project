/// 用户积分信息实体
class UserCredits {
  final int total;
  final int consumed;
  final int remaining;
  final int reserved;

  const UserCredits({
    required this.total,
    required this.consumed,
    required this.remaining,
    required this.reserved,
  });

  factory UserCredits.fromJson(Map<String, dynamic> json) {
    return UserCredits(
      total: (json['total'] as num?)?.toInt() ?? 0,
      consumed: (json['consumed'] as num?)?.toInt() ?? 0,
      remaining: (json['remaining'] as num?)?.toInt() ?? 0,
      reserved: (json['reserved'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 用户基础资料实体
class UserModel {
  final String id;
  final String username;
  final String? email;
  final String? phone;
  final String role;
  final UserCredits credits;

  const UserModel({
    required this.id,
    required this.username,
    this.email,
    this.phone,
    required this.role,
    required this.credits,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      role: (json['role'] as String?) ?? 'user',
      credits: json['credits'] != null
          ? UserCredits.fromJson(json['credits'] as Map<String, dynamic>)
          : const UserCredits(total: 0, consumed: 0, remaining: 0, reserved: 0),
    );
  }
}
