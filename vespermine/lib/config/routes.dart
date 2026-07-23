import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/mining/mining_screen.dart';
import '../screens/tasks/tasks_screen.dart';
import '../screens/wallet/wallet_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/subscriptions/subscription_screen.dart';
import '../screens/splash_screen.dart';
import '../widgets/bottom_nav.dart';

// Route Names
class RouteNames {
  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String dashboard = '/dashboard';
  static const String mining = '/mining';
  static const String tasks = '/tasks';
  static const String wallet = '/wallet';
  static const String profile = '/profile';
  static const String subscription = '/subscription';
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: RouteNames.splash,
    routes: [
      GoRoute(
        path: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: RouteNames.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return MainScaffold(child: child);
        },
        routes: [
          GoRoute(
            path: RouteNames.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: RouteNames.mining,
            builder: (context, state) => const MiningScreen(),
          ),
          GoRoute(
            path: RouteNames.tasks,
            builder: (context, state) => const TasksScreen(),
          ),
          GoRoute(
            path: RouteNames.wallet,
            builder: (context, state) => const WalletScreen(),
          ),
          GoRoute(
            path: RouteNames.profile,
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
      GoRoute(
        path: RouteNames.subscription,
        builder: (context, state) => const SubscriptionScreen(),
      ),
    ],
  );
});
