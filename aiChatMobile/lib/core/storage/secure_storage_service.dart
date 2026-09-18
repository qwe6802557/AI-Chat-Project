import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 安全凭据持久化存储服务
class SecureStorageService {
  static const String _keyToken = 'auth_jwt_token';
  static const String _keyUserId = 'auth_user_id';
  static const String _keyUsername = 'auth_user_name';

  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  Future<void> saveAuthCredentials({
    required String token,
    required String userId,
    required String username,
  }) async {
    await _storage.write(key: _keyToken, value: token);
    await _storage.write(key: _keyUserId, value: userId);
    await _storage.write(key: _keyUsername, value: username);
  }

  Future<String?> getToken() => _storage.read(key: _keyToken);
  Future<String?> getUserId() => _storage.read(key: _keyUserId);
  Future<String?> getUsername() => _storage.read(key: _keyUsername);

  Future<void> clearAuthCredentials() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyUserId);
    await _storage.delete(key: _keyUsername);
  }
}
