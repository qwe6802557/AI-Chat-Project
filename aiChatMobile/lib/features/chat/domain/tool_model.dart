/// 工具模型与内置工具定义
class ToolExecutionResultModel {
  final String status;
  final dynamic output;
  final int durationMs;
  final String? error;
  final String? rawOutput;

  const ToolExecutionResultModel({
    required this.status,
    this.output,
    this.durationMs = 0,
    this.error,
    this.rawOutput,
  });

  bool get isSuccess => status == 'success';

  factory ToolExecutionResultModel.fromJson(Map<String, dynamic> json) {
    return ToolExecutionResultModel(
      status: json['status'] as String? ?? 'success',
      output: json['output'],
      durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      error: json['error'] as String?,
      rawOutput: json['rawOutput'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'status': status,
    if (output != null) 'output': output,
    'durationMs': durationMs,
    if (error != null) 'error': error,
    if (rawOutput != null) 'rawOutput': rawOutput,
  };
}

/// 单次工具调用与执行记录模型
class ToolExecutionRecordModel {
  final String id;
  final String name;
  final String title;
  final String callType;
  final Map<String, dynamic> args;
  final ToolExecutionResultModel result;
  final String? createdAt;

  const ToolExecutionRecordModel({
    required this.id,
    required this.name,
    required this.title,
    this.callType = 'user_preset',
    this.args = const {},
    required this.result,
    this.createdAt,
  });

  factory ToolExecutionRecordModel.fromJson(Map<String, dynamic> json) {
    final rawResult = json['result'];
    final resultModel = rawResult is Map<String, dynamic>
        ? ToolExecutionResultModel.fromJson(rawResult)
        : ToolExecutionResultModel(
            status: 'success',
            output: rawResult,
          );

    return ToolExecutionRecordModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      title: json['title'] as String? ?? (json['name'] as String? ?? '工具调用'),
      callType: json['callType'] as String? ?? 'user_preset',
      args: (json['args'] as Map<String, dynamic>?) ?? const {},
      result: resultModel,
      createdAt: json['createdAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'title': title,
    'callType': callType,
    'args': args,
    'result': result.toJson(),
    if (createdAt != null) 'createdAt': createdAt,
  };
}

/// 客户端可用工具元数据模型
class ToolMetadataModel {
  final String id;
  final String name;
  final String title;
  final String description;
  final String icon;
  final String category;
  final bool supportsPresetMode;
  final bool supportsFunctionCall;

  const ToolMetadataModel({
    required this.id,
    required this.name,
    required this.title,
    required this.description,
    required this.icon,
    this.category = 'utility',
    this.supportsPresetMode = true,
    this.supportsFunctionCall = true,
  });

  factory ToolMetadataModel.fromJson(Map<String, dynamic> json) {
    return ToolMetadataModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? 'extension',
      category: json['category'] as String? ?? 'utility',
      supportsPresetMode: json['supportsPresetMode'] as bool? ?? true,
      supportsFunctionCall: json['supportsFunctionCall'] as bool? ?? true,
    );
  }
}

/// 移动端内置的 6 大工具插件配置
class BuiltinTools {
  BuiltinTools._();

  static const List<ToolMetadataModel> defaults = [
    ToolMetadataModel(
      id: 'calculator',
      name: 'calculator',
      title: '数学计算器',
      description: '执行高精度四则运算、代数公式、统计学与三角函数',
      icon: 'calculate',
      category: 'data',
    ),
    ToolMetadataModel(
      id: 'clock_calendar',
      name: 'clock_calendar',
      title: '时钟日历',
      description: '查询当前高精度时区、UTC换算与日程差值',
      icon: 'schedule',
      category: 'utility',
    ),
    ToolMetadataModel(
      id: 'weather',
      name: 'weather',
      title: '实时天气',
      description: '获取全国城市多维气象、温度、风向及湿度趋势',
      icon: 'wb_sunny',
      category: 'utility',
    ),
    ToolMetadataModel(
      id: 'web_search_v2',
      name: 'web_search_v2',
      title: '网络搜索',
      description: '全网检索最新事实资讯与知识库文档',
      icon: 'language',
      category: 'network',
    ),
    ToolMetadataModel(
      id: 'url_fetcher',
      name: 'url_fetcher',
      title: '网页抓取',
      description: '安全抓取指定 URL 页面文本内容并过滤清洗',
      icon: 'link',
      category: 'network',
    ),
    ToolMetadataModel(
      id: 'code_interpreter',
      name: 'code_interpreter',
      title: '代码解释器',
      description: '在隔离受限子进程环境中安全执行代码分析与算法脚本',
      icon: 'terminal',
      category: 'system',
    ),
  ];
}
