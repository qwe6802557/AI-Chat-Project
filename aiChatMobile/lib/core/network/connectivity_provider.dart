import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 网络连通性状态模型
class NetworkState {
  final bool isOnline;
  final bool wasOffline;
  final DateTime lastChanged;

  const NetworkState({
    this.isOnline = true,
    this.wasOffline = false,
    required this.lastChanged,
  });

  NetworkState copyWith({
    bool? isOnline,
    bool? wasOffline,
    DateTime? lastChanged,
  }) {
    return NetworkState(
      isOnline: isOnline ?? this.isOnline,
      wasOffline: wasOffline ?? this.wasOffline,
      lastChanged: lastChanged ?? this.lastChanged,
    );
  }
}

/// 移动端全局网络状态监听机
class ConnectivityNotifier extends StateNotifier<NetworkState> {
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  ConnectivityNotifier(this._connectivity)
      : super(NetworkState(lastChanged: DateTime.now())) {
    _init();
  }

  Future<void> _init() async {
    try {
      final results = await _connectivity.checkConnectivity();
      _handleConnectivityChange(results);
    } catch (_) {}

    _subscription = _connectivity.onConnectivityChanged.listen(_handleConnectivityChange);
  }

  void _handleConnectivityChange(List<ConnectivityResult> results) {
    final hasConnection = results.any(
      (r) => r != ConnectivityResult.none && r != ConnectivityResult.bluetooth,
    );

    if (hasConnection != state.isOnline) {
      state = state.copyWith(
        isOnline: hasConnection,
        wasOffline: !hasConnection && state.isOnline,
        lastChanged: DateTime.now(),
      );
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

final connectivityProvider =
    StateNotifierProvider<ConnectivityNotifier, NetworkState>((ref) {
  return ConnectivityNotifier(Connectivity());
});
