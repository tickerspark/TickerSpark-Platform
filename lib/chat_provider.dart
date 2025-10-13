// lib/chat_provider.dart

import 'dart:convert';
import 'package:flutter/foundation.dart'; // Import for debugPrint
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'message_model.dart';

// Riverpod Notifier that holds the list of messages
class ChatNotifier extends StateNotifier<List<Message>> {
  ChatNotifier() : super([]);

  Future<void> sendMessage(String userMessage) async {
    if (userMessage.trim().isEmpty) return;

    // 1. Add user message to the state
    state = [
      ...state,
      Message(content: userMessage, sender: MessageSender.user),
    ];
    
    // 2. Add a temporary loading message using the isLoading flag
    state = [
      ...state,
      Message(content: '', sender: MessageSender.ai, isLoading: true),
    ];

    try {
      // Create a sublist of the history *before* adding the loading message
      final conversationHistory = state.sublist(0, state.length - 1);
      const int historyLimit = 10;
      
      final recentHistory = conversationHistory.length > historyLimit
          ? conversationHistory.sublist(conversationHistory.length - historyLimit)
          : conversationHistory;

      final messagesPayload = recentHistory.map((msg) {
        return {
          'role': msg.sender == MessageSender.user ? 'user' : 'assistant',
          'content': msg.content,
        };
      }).toList();

      // 3. Call the Supabase Edge Function
      final response = await http.post(
        Uri.parse('$supabaseUrl/functions/v1/chat-proxy'),
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': 'Bearer $supabaseAnonKey',
        },
        body: jsonEncode({'messages': messagesPayload}),
      );

      // 4. Handle the response
      String aiReply;
      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        aiReply = responseData['reply'] as String? ?? 'Error: AI did not respond.';
      } else {
        final responseData = jsonDecode(response.body);
        final errorMsg = responseData['error'] ?? 'Unknown server error.';
        aiReply = 'Error: Server failed. Status ${response.statusCode}. Details: $errorMsg';
      }
      
      // 5. Remove the loading message and add the final AI response
      state = state.where((msg) => !msg.isLoading).toList(); // Safely remove loading message
      state = [
        ...state,
        Message(content: aiReply, sender: MessageSender.ai)
      ];

    } catch (e) {
      // Handle network or other client-side errors
      state = state.where((msg) => !msg.isLoading).toList(); // Also remove loading on error
      state = [
        ...state,
        Message(content: 'Error: Could not connect to the service.', sender: MessageSender.ai)
      ];
      // Use debugPrint instead of print to fix the warning
      debugPrint('API Call Error: $e');
    }
  }
}

// Global provider to access the ChatNotifier from the UI
final chatProvider = StateNotifierProvider<ChatNotifier, List<Message>>((ref) {
  return ChatNotifier();
});