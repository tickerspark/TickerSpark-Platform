import 'package:flutter/material.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Welcome to TickerSpark'),
      ),
      body: const Center(
        child: Text('This is the Landing & Pricing Page.'),
      ),
    );
  }
}