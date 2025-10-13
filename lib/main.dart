// lib/main.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'chat_screen.dart';
import 'config.dart';

// 1. A provider to hold the current theme mode (defaults to dark)
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.dark);

void main() async {
  // Your Supabase initialization is preserved
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  );

  runApp(const ProviderScope(child: MyApp()));
}

// 2. Converted to a ConsumerWidget to watch the provider
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 3. Watch the provider to rebuild when the theme changes
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp(
      title: 'AI Data Assistant',
      debugShowCheckedModeBanner: false,

      // 4. Define your light and dark themes
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4A4E69), // A nice seed color for light mode
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF9A8C98), // A complementary seed for dark
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),

      // 5. Set the current theme mode
      themeMode: themeMode,
      home: const ChatScreen(),
    );
  }
}