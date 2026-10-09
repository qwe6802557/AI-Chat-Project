/// 客户端版本模型与更新元数据
class AppVersionInfo {
  final String latestVersion;
  final int latestVersionCode;
  final String minSupportedVersion;
  final String downloadUrl;
  final String packageSize;
  final List<String> releaseNotes;
  final bool forceUpdate;
  final bool hasUpdate;
  final String currentVersion;
  final String publishedAt;

  const AppVersionInfo({
    required this.latestVersion,
    required this.latestVersionCode,
    required this.minSupportedVersion,
    required this.downloadUrl,
    required this.packageSize,
    required this.releaseNotes,
    required this.forceUpdate,
    required this.hasUpdate,
    required this.currentVersion,
    required this.publishedAt,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) {
    return AppVersionInfo(
      latestVersion: json['latestVersion'] as String? ?? '1.0.0',
      latestVersionCode: json['latestVersionCode'] as int? ?? 1,
      minSupportedVersion: json['minSupportedVersion'] as String? ?? '1.0.0',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      packageSize: json['packageSize'] as String? ?? '45 MB',
      releaseNotes: (json['releaseNotes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      hasUpdate: json['hasUpdate'] as bool? ?? false,
      currentVersion: json['currentVersion'] as String? ?? '1.0.0',
      publishedAt: json['publishedAt'] as String? ?? '',
    );
  }
}
