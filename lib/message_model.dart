// lib/message_model.dart

enum MessageSender { user, ai }

class Message {
  final String content;
  final MessageSender sender;
  final bool isLoading;

  Message({
    required this.content,
    required this.sender,
    this.isLoading = false,
  });
}