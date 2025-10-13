// lib/chat_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  void _handleSend() {
    final message = _controller.text;
    if (message.isNotEmpty) {
      ref.read(chatProvider.notifier).sendMessage(message);
      _controller.clear();
    }
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
      // 1. The body is NOW ONLY the list of messages.
      body: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
        reverse: true,
        itemCount: messages.length,
        itemBuilder: (context, index) {
          final message = messages[messages.length - 1 - index];
          return MessageBubble(message: message);
        },
      ),
      // 2. The input composer is moved to the bottomNavigationBar property.
      bottomNavigationBar: _buildInputComposer(),
    );
  }

  Widget _buildInputComposer() {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      elevation: 4, // Add a subtle shadow for separation
      child: Padding(
        // The Scaffold handles the bottom safe area for this property
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

// MessageBubble class remains unchanged
class MessageBubble extends StatelessWidget {
  final Message message;
  const MessageBubble({super.key, required this.message});

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
            : MarkdownBody(
                data: message.content,
                selectable: true,
                styleSheet: markdownStyle,
              ),
      ),
    );
  }
}