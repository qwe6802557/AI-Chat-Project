import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../data/auth_repository.dart';
import '../domain/user_model.dart';

enum AuthStatus { initial, authenticated, unauthenticated, loading, error }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

final Provider<SecureStorageService> secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final Provider<DioClient> dioClientProvider = Provider<DioClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return DioClient(
    storageService: storage,
    onUnauthorized: () {
      ref.read(authProvider.notifier).handleUnauthorized();
    },
  );
});

final Provider<AuthRepository> authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return AuthRepository(client);
});

final StateNotifierProvider<AuthNotifier, AuthState> authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  final storage = ref.watch(secureStorageProvider);
  return AuthNotifier(repo, storage)..initialize();
});

/// 认证状态机管理
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;
  final SecureStorageService _storage;

  AuthNotifier(this._repository, this._storage) : super(const AuthState());

  Future<void> initialize() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    try {
      final user = await _repository.getUserProfile();
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
      );
    } catch (_) {
      await _storage.clearAuthCredentials();
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login({
    required String username,
    required String password,
    required String captcha,
    required String captchaId,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);

    try {
      final res = await _repository.login(
        username: username,
        password: password,
        captcha: captcha,
        captchaId: captchaId,
      );

      await _storage.saveAuthCredentials(
        token: res.token,
        userId: res.user.id,
        username: res.user.username,
      );

      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: res.user,
      );
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    await _storage.clearAuthCredentials();
    state = state.copyWith(
      status: AuthStatus.unauthenticated,
      user: null,
    );
  }

  void handleUnauthorized() {
    state = state.copyWith(
      status: AuthStatus.unauthenticated,
      user: null,
    );
  }
}
