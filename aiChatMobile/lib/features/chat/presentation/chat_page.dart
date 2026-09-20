import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../providers/chat_provider.dart';
import 'widgets/chat_assistant_message_bubble.dart';
import 'widgets/chat_bottom_input_bar.dart';
import 'widgets/chat_sticky_model_bar.dart';
import 'widgets/chat_top_header.dart';
import 'widgets/chat_user_message_bubble.dart';
import 'widgets/model_switcher_bottom_sheet.dart';

/// Stitch AI 智能对话工作台主页面
class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key});

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    // 首次进入会话时立即吸底，并多帧校准 Markdown 动态排版尺寸
    _scrollToBottom(animate: false, retries: 5);
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  /// 智能吸底：包含多帧高度变化重试，彻底解决 Markdown/代码块等懒加载导致滚动停在半路的问题
  void _scrollToBottom({bool animate = true, int retries = 3}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      final maxExtent = _scrollController.position.maxScrollExtent;
      if (animate) {
        _scrollController.animateTo(
          maxExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(maxExtent);
      }

      // 如果因富文本排版导致列表高度扩展，下一帧持续校准直到真正到达最底部
      if (retries > 0) {
        Future.delayed(const Duration(milliseconds: 60), () {
          if (mounted && _scrollController.hasClients) {
            if (_scrollController.position.pixels < _scrollController.position.maxScrollExtent - 2) {
              _scrollToBottom(animate: animate, retries: retries - 1);
            }
          }
        });
      }
    });
  }

  void _handleSendMessage() {
    final text = _textController.text;
    final pending = ref.read(chatProvider).pendingAttachments;
    if (text.trim().isEmpty && pending.isEmpty) return;
    _textController.clear();
    ref.read(chatProvider.notifier).sendMessage(text);
    _scrollToBottom(animate: true, retries: 4);
  }

  void _openModelSwitcher() {
    final currentModel = ref.read(chatProvider).selectedModel;
    ModelSwitcherBottomSheet.show(
      context,
      currentModel: currentModel,
      onModelSelected: (model) {
        ref.read(chatProvider.notifier).setModel(model);
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 56.0,
            height: 56.0,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
              border: Border.all(
                color: StitchTokens.primaryGlow.withValues(alpha: 0.25),
                width: 1.0,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Image.asset(
              'assets/images/logo.png',
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(height: 16.0),
          const Text(
            '向 ERJ Chat 开启新的探讨',
            style: TextStyle(
              fontSize: 15.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4.0),
          const Text(
            '支持深度思考、多语言代码与 Markdown 输出',
            style: TextStyle(fontSize: 12.0, color: StitchTokens.outline),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);

    // 监听会话切换、消息数量变动或流式输出增量并吸底滚动
    ref.listen(chatProvider, (previous, next) {
      final sessionChanged = previous?.activeSessionId != next.activeSessionId;
      final lengthChanged = previous?.messages.length != next.messages.length;
      final contentChanged = previous?.messages.lastOrNull?.content != next.messages.lastOrNull?.content;
      final finishedGenerating = (previous?.isGenerating == true) && !next.isGenerating;

      if (sessionChanged) {
        // 会话切换时无动画快速吸底并多轮校准
        _scrollToBottom(animate: false, retries: 5);
      } else if (lengthChanged || contentChanged || finishedGenerating) {
        _scrollToBottom(animate: true, retries: 3);
      }
    });

    return Scaffold(
      backgroundColor: StitchTokens.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            ChatTopHeader(
              selectedModel: chatState.selectedModel,
              onModelTap: _openModelSwitcher,
              onProfileTap: () => context.push('/profile'),
            ),
            const SizedBox(height: 4.0),
            ChatStickyModelBar(
              model: chatState.selectedModel,
              onTap: _openModelSwitcher,
            ),
            if (chatState.errorMessage != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 16.0, color: StitchTokens.crimsonStop),
                    const SizedBox(width: 6.0),
                    Expanded(
                      child: Text(
                        chatState.errorMessage!,
                        style: const TextStyle(fontSize: 12.0, color: Color(0xFF991B1B)),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8.0),
            Expanded(
              child: chatState.messages.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.only(
                        left: 16.0,
                        right: 16.0,
                        top: 4.0,
                        bottom: 16.0,
                      ),
                      itemCount: chatState.messages.length,
                      itemBuilder: (context, index) {
                        final msg = chatState.messages[index];
                        return msg.isUser
                            ? ChatUserMessageBubble(msg: msg)
                            : ChatAssistantMessageBubble(msg: msg);
                      },
                    ),
            ),
            ChatBottomInputBar(
              textController: _textController,
              isGenerating: chatState.isGenerating,
              creditsRemaining: chatState.creditsRemaining,
              attachments: chatState.pendingAttachments,
              onPickImages: () => ref.read(chatProvider.notifier).pickAndUploadImages(),
              onPickDocument: () => ref.read(chatProvider.notifier).pickDocument(),
              onRemoveAttachment: (id) => ref.read(chatProvider.notifier).removeAttachment(id),
              onSend: _handleSendMessage,
              onStop: () => ref.read(chatProvider.notifier).stopGeneration(),
            ),
          ],
        ),
      ),
    );
  }
}
