/// 智能体角色与 Swarm 协同团队模型
class AgentRoleModel {
  final String id;
  final String name;
  final String? description;
  final String? boundModelId;
  final bool isDefault;
  final bool isTeam;
  final List<String> subAgentRoleIds;

  const AgentRoleModel({
    required this.id,
    required this.name,
    this.description,
    this.boundModelId,
    this.isDefault = false,
    this.isTeam = false,
    this.subAgentRoleIds = const [],
  });

  factory AgentRoleModel.fromJson(Map<String, dynamic> json) {
    final teamConfig = json['teamConfig'] is Map<String, dynamic>
        ? json['teamConfig'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawSubIds = (teamConfig['subAgentRoleIds'] as List?) ?? const [];
    return AgentRoleModel(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '智能体角色').toString(),
      description: json['description'] as String?,
      boundModelId: json['boundModelId'] as String?,
      isDefault: json['isDefault'] == true,
      isTeam: json['isTeam'] == true,
      subAgentRoleIds: rawSubIds.map((e) => e.toString()).toList(),
    );
  }
}

/// IM 智能助理通道实例状态模型
class ChannelInstanceModel {
  final String? id;
  final String channelType;
  final String name;
  final String? instanceName;
  final String? roleId;
  final String? roleName;
  final String? workflowId;
  final bool isEnabled;
  final String status;
  final String? loginStatus;
  final String? boundModelId;
  final Map<String, String> credentialsMasked;
  final String? lastError;

  const ChannelInstanceModel({
    this.id,
    required this.channelType,
    required this.name,
    this.instanceName,
    this.roleId,
    this.roleName,
    this.workflowId,
    this.isEnabled = false,
    this.status = 'disconnected',
    this.loginStatus,
    this.boundModelId,
    this.credentialsMasked = const {},
    this.lastError,
  });

  String get displayName =>
      (instanceName != null && instanceName!.trim().isNotEmpty)
          ? instanceName!
          : name;

  bool get isConnected => status == 'connected';
  bool get isConnecting =>
      status == 'connecting' ||
      loginStatus == 'waiting_scan' ||
      loginStatus == 'scanned';

  String get channelLabel {
    switch (channelType) {
      case 'wecom_bot':
        return '企微智能机器人';
      case 'feishu':
        return '飞书机器人';
      case 'dingtalk':
        return '钉钉机器人';
      case 'qq':
        return 'QQ 机器人';
      case 'weixin':
        return '微信 iLink';
      default:
        return channelType;
    }
  }

  factory ChannelInstanceModel.fromJson(Map<String, dynamic> json) {
    final rawMasked = json['credentialsMasked'];
    final maskedMap = <String, String>{};
    if (rawMasked is Map) {
      rawMasked.forEach((k, v) {
        if (v != null) maskedMap[k.toString()] = v.toString();
      });
    }
    return ChannelInstanceModel(
      id: json['id'] as String?,
      channelType: (json['channelType'] ?? '').toString(),
      name: (json['name'] ?? 'IM 通道').toString(),
      instanceName: json['instanceName'] as String?,
      roleId: json['roleId'] as String?,
      roleName: json['roleName'] as String?,
      workflowId: json['workflowId'] as String?,
      isEnabled: json['isEnabled'] == true,
      status: (json['status'] ?? 'disconnected').toString(),
      loginStatus: json['loginStatus'] as String?,
      boundModelId: json['boundModelId'] as String?,
      credentialsMasked: maskedMap,
      lastError: json['lastError'] as String?,
    );
  }
}

/// 通道运行指标模型
class ChannelMetricsModel {
  final int totalRequests;
  final double successRate;
  final int avgLatencyMs;
  final int errorCount;

  const ChannelMetricsModel({
    this.totalRequests = 0,
    this.successRate = 100,
    this.avgLatencyMs = 0,
    this.errorCount = 0,
  });

  factory ChannelMetricsModel.fromJson(Map<String, dynamic> json) {
    return ChannelMetricsModel(
      totalRequests: (json['totalRequests'] as num?)?.toInt() ?? 0,
      successRate: (json['successRate'] as num?)?.toDouble() ?? 100,
      avgLatencyMs: (json['avgLatencyMs'] as num?)?.toInt() ?? 0,
      errorCount: (json['errorCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 外部联系人审计会话摘要
class ChannelAuditSessionModel {
  final String fromId;
  final String? senderName;
  final int totalMessages;
  final int totalCredits;
  final String lastContent;
  final DateTime? lastMessageAt;

  const ChannelAuditSessionModel({
    required this.fromId,
    this.senderName,
    this.totalMessages = 0,
    this.totalCredits = 0,
    this.lastContent = '',
    this.lastMessageAt,
  });

  factory ChannelAuditSessionModel.fromJson(Map<String, dynamic> json) {
    return ChannelAuditSessionModel(
      fromId: (json['fromId'] ?? '').toString(),
      senderName: json['senderName'] as String?,
      totalMessages: (json['totalMessages'] as num?)?.toInt() ?? 0,
      totalCredits: (json['totalCredits'] as num?)?.toInt() ?? 0,
      lastContent: (json['lastContent'] ?? '').toString(),
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.tryParse(json['lastMessageAt'].toString())
          : null,
    );
  }
}

/// 外部联系人审计对话消息流水
class ChannelAuditMessageModel {
  final String id;
  final String senderType;
  final String? senderName;
  final String content;
  final int costCredits;
  final DateTime createdAt;

  const ChannelAuditMessageModel({
    required this.id,
    required this.senderType,
    this.senderName,
    required this.content,
    this.costCredits = 0,
    required this.createdAt,
  });

  bool get isUser => senderType == 'user';

  factory ChannelAuditMessageModel.fromJson(Map<String, dynamic> json) {
    return ChannelAuditMessageModel(
      id: (json['id'] ?? '').toString(),
      senderType: (json['senderType'] ?? 'user').toString(),
      senderName: json['senderName'] as String?,
      content: (json['content'] ?? '').toString(),
      costCredits: (json['costCredits'] as num?)?.toInt() ?? 0,
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}
