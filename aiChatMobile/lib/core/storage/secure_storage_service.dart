import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/domain/user_model.dart';

/// 安全凭据持久化存储服务（双重保障：SecureStorage 与 SharedPreferences 互备，确保 Web 与 Native 100% 持久）
class SecureStorageService {
  static const String _keyToken = 'auth_jwt_token';
  static const String _keyUserId = 'auth_user_id';
  static const String _keyUsername = 'auth_user_name';
  static const String _keyUserJson = 'auth_user_json';
  static const String _keySavedAccount = 'dev_saved_account';
  static const String _keySavedPassword = 'dev_saved_password';

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

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    await prefs.setString(_keyUserId, userId);
    await prefs.setString(_keyUsername, username);
  }

  Future<String?> getToken() async {
    final token = await _storage.read(key: _keyToken);
    if (token != null && token.isNotEmpty) return token;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  Future<String?> getUserId() async {
    final id = await _storage.read(key: _keyUserId);
    if (id != null && id.isNotEmpty) return id;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserId);
  }

  Future<String?> getUsername() async {
    final name = await _storage.read(key: _keyUsername);
    if (name != null && name.isNotEmpty) return name;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUsername);
  }

  Future<void> saveCachedUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserJson, jsonEncode(user.toJson()));
  }

  Future<UserModel?> getCachedUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_keyUserJson);
      if (str == null || str.isEmpty) return null;
      return UserModel.fromJson(jsonDecode(str) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSavedAccount({required String username, required String password}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySavedAccount, username);
    await prefs.setString(_keySavedPassword, password);
  }

  Future<Map<String, String>?> getSavedAccount() async {
    final prefs = await SharedPreferences.getInstance();
    final user = prefs.getString(_keySavedAccount);
    final pass = prefs.getString(_keySavedPassword);
    if (user != null && user.isNotEmpty) {
      return {'username': user, 'password': pass ?? ''};
    }
    return null;
  }

  Future<void> clearAuthCredentials() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyUserId);
    await _storage.delete(key: _keyUsername);

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUsername);
    await prefs.remove(_keyUserJson);
  }
}
