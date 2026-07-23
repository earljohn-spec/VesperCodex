import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/theme.dart';
import '../config/routes.dart';

class MainScaffold extends StatelessWidget {
  final Widget child;

  const MainScaffold({super.key, required this.child});

  int _getCurrentIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith(RouteNames.mining)) return 1;
    if (location.startsWith(RouteNames.tasks)) return 2;
    if (location.startsWith(RouteNames.wallet)) return 3;
    if (location.startsWith(RouteNames.profile)) return 4;
    return 0; // dashboard
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: VesperTheme.bgSecondary,
          border: Border(
            top: BorderSide(
              color: VesperTheme.neonCyan.withAlpha(26),
              width: 1,
            ),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavButton(
                  icon: Icons.dashboard_rounded,
                  label: 'Home',
                  index: 0,
                  currentIndex: _getCurrentIndex(context),
                ),
                _NavButton(
                  icon: Icons.memory_rounded,
                  label: 'Mine',
                  index: 1,
                  currentIndex: _getCurrentIndex(context),
                ),
                _NavButton(
                  icon: Icons.task_alt_rounded,
                  label: 'Tasks',
                  index: 2,
                  currentIndex: _getCurrentIndex(context),
                ),
                _NavButton(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'Wallet',
                  index: 3,
                  currentIndex: _getCurrentIndex(context),
                ),
                _NavButton(
                  icon: Icons.person_rounded,
                  label: 'Profile',
                  index: 4,
                  currentIndex: _getCurrentIndex(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final int index;
  final int currentIndex;

  const _NavButton({
    required this.icon,
    required this.label,
    required this.index,
    required this.currentIndex,
  });

  String _getRoute(int index) {
    switch (index) {
      case 0: return RouteNames.dashboard;
      case 1: return RouteNames.mining;
      case 2: return RouteNames.tasks;
      case 3: return RouteNames.wallet;
      case 4: return RouteNames.profile;
      default: return RouteNames.dashboard;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSelected = index == currentIndex;

    return GestureDetector(
      onTap: () {
        if (!isSelected) {
          context.go(_getRoute(index));
        }
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? VesperTheme.neonCyan.withAlpha(20) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 24,
              color: isSelected ? VesperTheme.neonCyan : VesperTheme.textMuted,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected ? VesperTheme.neonCyan : VesperTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
