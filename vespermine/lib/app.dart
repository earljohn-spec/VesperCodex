import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'screens/splash_screen.dart';

class VesperMineApp extends ConsumerWidget {
  const VesperMineApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'VesperMine',
      debugShowCheckedModeBanner: false,
      theme: VesperTheme.dark(),
      routerConfig: router,
      builder: (context, child) {
        return ScrollConfiguration(
          behavior: ScrollConfiguration.of(context).copyWith(
            physics: const BouncingScrollPhysics(),
          ),
          child: child ?? const SplashScreen(),
        );
      },
    );
  }
}
