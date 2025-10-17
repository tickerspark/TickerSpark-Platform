import 'package:flutter/material.dart';

class MainAppScreen extends StatelessWidget {
  const MainAppScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('TickerSpark Feed'),
      ),
      body: const Center(
        child: Text('This is the main app for logged-in users.'),
      ),
      // We will add the BottomNavigationBar here later
    );
  }
}