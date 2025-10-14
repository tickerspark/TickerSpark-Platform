// lib/chat_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart'; // import for launching URLs
import 'chat_provider.dart';
import 'main.dart'; // Import to access the theme provider
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
      // Scroll to the bottom when a new message is sent
      // Since ListView is reversed, this means scrolling to the top
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollController.animateTo(
          0.0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      });
    }
  }

  // Method to handle suggested prompt taps
  void _onSuggestedPromptTap(String prompt) {
    _controller.text = prompt; // Prefill the text field
    _handleSend(prompt); // Send immediately
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
              ref.read(themeModeProvider.notifier).state =
                  themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
            },
          ),
        ],
      ),
      body: messages.isEmpty
          ? _SuggestedPrompts(onTap: _onSuggestedPromptTap) // Display prompts when no messages exist
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

// -----------------------------------------------------------------------------
// WIDGET FOR SUGGESTED PROMPTS
// -----------------------------------------------------------------------------
class _SuggestedPrompts extends StatelessWidget {
  final void Function(String) onTap;
  
  // Example prompts relevant to a "TickerSpark AI"
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
            Text(
              'What can I help you with?',
              style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ...prompts.map((prompt) => Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: _PromptCard(prompt: prompt, onTap: onTap),
            )).toList(),
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
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface,
                  ),
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

// ---Message Bubble Widget----
class MessageBubble extends StatelessWidget {
  final Message message;
  const MessageBubble({super.key, required this.message});

  // Function to handle link clicks
  void _onLinkTap(String? url, String? href, String title) async {
    if (href != null) {
      final uri = Uri.tryParse(href);
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
    
    final markdownStyle = MarkdownStyleSheet.fromTheme(theme).copyWith(
      p: theme.textTheme.bodyMedium?.copyWith(color: textColor),
      h3: theme.textTheme.titleMedium?.copyWith(color: textColor, fontWeight: FontWeight.bold),
      strong: theme.textTheme.bodyMedium?.copyWith(color: textColor, fontWeight: FontWeight.bold),
    );

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
                  ? SelectableText(
                      message.content,
                      style: theme.textTheme.bodyMedium?.copyWith(color: textColor),
                    )
                  : MarkdownBody(
                      data: message.content,
                      selectable: true,
                      styleSheet: markdownStyle,
                      onTapLink: (text, href, title) => _onLinkTap(text, href, title), // Enable link tapping
                    ),
      ),
    );
  }
}