// lib/chat_screen.dart

import 'package:flutter/material.dart';
import 'package:gpt_markdown/gpt_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'chat_provider.dart';
import 'main.dart';
import 'message_model.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  void _handleSend([String? message]) {
    final textToSend = message ?? _controller.text;
    if (textToSend.isNotEmpty) {
      ref.read(chatProvider.notifier).sendMessage(textToSend);
      _controller.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollController.animateTo(0.0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      });
    }
  }

  void _onSuggestedPromptTap(String prompt) {
    _controller.text = prompt;
    _handleSend(prompt);
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(chatProvider);
    final themeMode = ref.watch(themeModeProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('TickerSpark AI'),
        actions: [
          IconButton(
            icon: Icon(themeMode == ThemeMode.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
            onPressed: () {
              ref.read(themeModeProvider.notifier).state = themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
            },
          ),
        ],
      ),
      // SelectionArea is expected in lib/main.dart
      body: messages.isEmpty
            ? _SuggestedPrompts(onTap: _onSuggestedPromptTap)
            : ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                reverse: true,
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final message = messages[messages.length - 1 - index];
                  return MessageBubble(message: message);
                },
              ),
      bottomNavigationBar: _buildInputComposer(),
    );
  }

  Widget _buildInputComposer() {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _controller,
                onSubmitted: (_) => _handleSend(),
                decoration: InputDecoration.collapsed(
                  hintText: 'Ask me anything...',
                  hintStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                ),
                style: TextStyle(color: theme.colorScheme.onSurface),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.send_rounded),
              onPressed: _handleSend,
              color: theme.colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}

class _SuggestedPrompts extends StatelessWidget {
  final void Function(String) onTap;
  final List<String> prompts = const [
    'What is the current stock price of TSLA?',
    'Catch me up on the latest economic news and data.',
    'Tell me which stocks are trending this month and why.',
    'Explain the competitive positioning of AMD.',
  ];
  const _SuggestedPrompts({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('What can I help you with?', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            // Fixed: Removed .toList()
            ...prompts.map((prompt) => Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: _PromptCard(prompt: prompt, onTap: onTap),
            )),
          ],
        ),
      ),
    );
  }
}

class _PromptCard extends StatelessWidget {
  final String prompt;
  final void Function(String) onTap;
  const _PromptCard({required this.prompt, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.surfaceContainerHigh,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant, width: 1),
      ),
      child: InkWell(
        onTap: () => onTap(prompt),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              const Icon(Icons.flash_on, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  prompt,
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface),
                ),
              ),
              const Icon(Icons.arrow_forward_ios, size: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class MessageBubble extends StatelessWidget {
  final Message message;
  const MessageBubble({super.key, required this.message});

  // Updated method signature to match GptMarkdown's onLinkTap callback
  void _onLinkTap(String url, String title) async { 
    if (url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isUser = message.sender == MessageSender.user;
    final theme = Theme.of(context);
    final bgColor = isUser ? theme.colorScheme.primary : theme.colorScheme.surfaceContainer;
    final textColor = isUser ? theme.colorScheme.onPrimary : theme.colorScheme.onSurfaceVariant;
    
    // MarkdownStyleSheet block was deleted
    
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        margin: const EdgeInsets.symmetric(vertical: 5.0),
        padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 14.0),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(18.0),
        ),
        child: message.isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(textColor)),
                )
              : isUser 
                  ? Text( // Simple Text widget for user, selection handled by outer SelectionArea
                      message.content,
                      style: theme.textTheme.bodyMedium?.copyWith(color: textColor),
                    )
                  // Use GptMarkdown and corrected parameters
                  : SelectionArea( 
                      child: GptMarkdown( // Correct widget name
                          message.content, // Positional argument for content
                          style: theme.textTheme.bodyMedium?.copyWith(color: textColor), // Base style applied directly
                          onLinkTap: _onLinkTap, // Correct named parameter
                      ),
                    ),
      ),
    );
  }
}