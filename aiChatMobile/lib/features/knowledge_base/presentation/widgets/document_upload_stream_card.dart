import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// 移动端文档即时上传与解析流式卡片
class DocumentUploadStreamCard extends StatelessWidget {
  final String fileName;
  final double progress; // 0.0 ~ 1.0
  final bool isProcessing;
  final String? error;
  final VoidCallback? onCancel;

  const DocumentUploadStreamCard({
    super.key,
    required this.fileName,
    required this.progress,
    this.isProcessing = false,
    this.error,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final percentInt = (progress * 100).clamp(0, 100).toInt();

    return Container(
      margin: const EdgeInsets.only(bottom: 16.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F7FF),
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        border: Border.all(
          color: const Color(0xFFB9DBFE),
          width: 1.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(21, 112, 239, 0.08),
            blurRadius: 12.0,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: StitchTokens.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(
                  Icons.upload_file_rounded,
                  color: StitchTokens.primary,
                  size: 18.0,
                ),
              ),
              const SizedBox(width: 10.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      isProcessing
                          ? '正在进行文本提取与向量化切片...'
                          : '正在推流上传文件... $percentInt%',
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: StitchTokens.primary,
                      ),
                    ),
                  ],
                ),
              ),
              if (error != null)
                const Icon(Icons.error_outline_rounded, color: StitchTokens.crimsonStop, size: 20.0)
              else if (isProcessing)
                const SizedBox(
                  width: 16.0,
                  height: 16.0,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.0,
                    valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
                  ),
                )
              else
                Text(
                  '$percentInt%',
                  style: const TextStyle(
                    fontSize: 12.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.primary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10.0),
          ClipRRect(
            borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
            child: LinearProgressIndicator(
              value: isProcessing ? null : progress,
              backgroundColor: const Color(0xFFD6E9FE),
              valueColor: const AlwaysStoppedAnimation(StitchTokens.primary),
              minHeight: 4.0,
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 6.0),
            Text(
              error!,
              style: const TextStyle(
                fontSize: 11.0,
                color: StitchTokens.crimsonStop,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
