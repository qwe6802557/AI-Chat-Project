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
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _handleSendMessage() {
    final text = _textController.text;
    if (text.trim().isEmpty) return;
    _textController.clear();
    ref.read(chatProvider.notifier).sendMessage(text);
    _scrollToBottom();
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
        children: const [
          Icon(
            Icons.auto_awesome_rounded,
            size: 48.0,
            color: StitchTokens.primaryGlowSubtle,
          ),
          SizedBox(height: 16.0),
          Text(
            '向 AI Spark 开启新的探讨',
            style: TextStyle(
              fontSize: 15.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
          SizedBox(height: 4.0),
          Text(
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

    // 监听消息增量并吸底滚动
    ref.listen(chatProvider, (previous, next) {
      if (previous?.messages.length != next.messages.length ||
          previous?.messages.lastOrNull?.content != next.messages.lastOrNull?.content) {
        _scrollToBottom();
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
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
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
              onSend: _handleSendMessage,
              onStop: () => ref.read(chatProvider.notifier).stopGeneration(),
            ),
          ],
        ),
      ),
    );
  }
}
