import 'package:flutter/material.dart';
import 'landing_screen.dart'; // We will create this next
import 'main_app_screen.dart'; // And this one too

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    // --- Placeholder Logic ---
    // For now, we will pretend the user is always logged out.
    // In the future, we'll replace this with real Supabase auth logic.
    const bool isLoggedIn = false;

    if (isLoggedIn) {
      // If the user IS logged in, show the main app with the news feed.
      return const MainAppScreen();
    } else {
      // If the user is NOT logged in, show the marketing/pricing page.
      return const LandingScreen();
    }
  }
}