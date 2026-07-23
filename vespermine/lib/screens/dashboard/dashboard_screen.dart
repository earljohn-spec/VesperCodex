import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../services/mining_service.dart';
import '../../services/wallet_service.dart';
import '../../services/earnings_service.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/neon_button.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Initialize services with user data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = ref.read(authStateProvider).user;
      if (user != null) {
        ref.read(walletStateProvider.notifier).initializeLedger(user.uid);
        ref.read(earningsStateProvider.notifier).initialize(user.uid);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final miningState = ref.watch(miningStateProvider);
    final walletState = ref.watch(walletStateProvider);
    final earningsState = ref.watch(earningsStateProvider);
    final user = authState.user;

    final btcBalance = walletState.ledger?.balanceBtc ?? 0.0;
    final usdBalance = btcBalance * walletState.bitcoinPrice;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: VesperTheme.miningGradient,
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hello, ${user?.displayName ?? 'Miner'} 👋',
                          style: TextStyle(
                            fontSize: 16,
                            color: VesperTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Welcome to VesperMine',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: VesperTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => context.go(RouteNames.subscription),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: VesperTheme.neonGold.withAlpha(26),
                          borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                          border: Border.all(
                            color: VesperTheme.neonGold.withAlpha(60),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.diamond_rounded,
                              color: VesperTheme.neonGold,
                              size: 16,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              user?.subscriptionTier.toUpperCase() ?? 'FREE',
                              style: TextStyle(
                                color: VesperTheme.neonGold,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Balance Card
                BalanceCard(
                  balance: '${btcBalance.toStringAsFixed(8)} BTC',
                  balanceUsd: '\$${usdBalance.toStringAsFixed(2)} USD',
                  changePercent: '+2.4%',
                  isPositive: true,
                ),
                const SizedBox(height: 24),

                // Quick Actions Row
                Row(
                  children: [
                    Expanded(
                      child: _QuickActionCard(
                        icon: Icons.memory_rounded,
                        label: 'Mine',
                        color: VesperTheme.neonCyan,
                        onTap: () => context.go(RouteNames.mining),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickActionCard(
                        icon: Icons.task_alt_rounded,
                        label: 'Earn More',
                        color: VesperTheme.neonGreen,
                        onTap: () => context.go(RouteNames.tasks),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickActionCard(
                        icon: Icons.send_rounded,
                        label: 'Withdraw',
                        color: VesperTheme.neonPurple,
                        onTap: () => context.go(RouteNames.wallet),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Stats Grid
                const Text(
                  'Your Stats',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: VesperTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        icon: Icons.trending_up,
                        label: 'Today\'s Earnings',
                        value: '${earningsState.earnings?.todaySatoshi ?? 0} sats',
                        iconColor: VesperTheme.neonGreen,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        icon: Icons.local_fire_department,
                        label: 'Current Streak',
                        value: '${user?.currentStreak ?? 0} days',
                        iconColor: VesperTheme.neonOrange,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        icon: Icons.memory,
                        label: 'Hash Rate',
                        value: '${miningState.session?.hashRate.toStringAsFixed(1) ?? '0'} MH/s',
                        iconColor: VesperTheme.neonCyan,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        icon: Icons.people_alt,
                        label: 'Referrals',
                        value: '${user?.totalReferrals ?? 0}',
                        iconColor: VesperTheme.neonPurple,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Mining Status
                _MiningStatusCard(
                  isMining: miningState.session?.status == MiningStatus.active,
                  hashRate: miningState.session?.hashRate ?? 0,
                  uptime: miningState.session?.formattedUptime ?? '00:00:00',
                  earned: miningState.currentEarnings,
                  onTap: () => context.go(RouteNames.mining),
                ),
                const SizedBox(height: 24),

                // Earnings Breakdown
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: VesperTheme.bgCard,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                    border: Border.all(
                      color: VesperTheme.neonCyan.withAlpha(20),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Earnings Breakdown',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: VesperTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildEarningsBar(
                        'Cloud Mining',
                        earningsState.earnings?.miningPercentage ?? 0,
                        VesperTheme.neonCyan,
                      ),
                      const SizedBox(height: 12),
                      _buildEarningsBar(
                        'Tasks',
                        earningsState.earnings?.taskPercentage ?? 0,
                        VesperTheme.neonGreen,
                      ),
                      const SizedBox(height: 12),
                      _buildEarningsBar(
                        'Referrals',
                        earningsState.earnings?.referralPercentage ?? 0,
                        VesperTheme.neonPurple,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 100), // Space for bottom nav
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEarningsBar(String label, double percentage, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: VesperTheme.textSecondary, fontSize: 13)),
            Text('${percentage.toStringAsFixed(1)}%', style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: percentage / 100,
            backgroundColor: color.withAlpha(26),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: VesperTheme.bgCard,
          borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
          border: Border.all(color: color.withAlpha(30)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiningStatusCard extends StatelessWidget {
  final bool isMining;
  final double hashRate;
  final String uptime;
  final double earned;
  final VoidCallback onTap;

  const _MiningStatusCard({
    required this.isMining,
    required this.hashRate,
    required this.uptime,
    required this.earned,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: VesperTheme.bgCard,
          borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
          border: Border.all(
            color: isMining ? VesperTheme.neonCyan.withAlpha(60) : VesperTheme.textMuted.withAlpha(20),
          ),
          boxShadow: isMining
              ? [BoxShadow(color: VesperTheme.neonCyan.withAlpha(20), blurRadius: 20)]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isMining ? VesperTheme.neonGreen.withAlpha(26) : VesperTheme.bgCardElevated,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isMining ? Icons.play_arrow : Icons.pause,
                color: isMining ? VesperTheme.neonGreen : VesperTheme.textMuted,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isMining ? 'Mining Active' : 'Mining Idle',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isMining ? VesperTheme.neonGreen : VesperTheme.textMuted,
                    ),
                  ),
                  Text(
                    '${hashRate.toStringAsFixed(1)} MH/s • $uptime',
                    style: const TextStyle(
                      fontSize: 12,
                      color: VesperTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${(earned * 1e8).toStringAsFixed(0)} sats',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: isMining ? VesperTheme.neonCyan : VesperTheme.textMuted,
                  ),
                ),
                Text(
                  'earned this session',
                  style: const TextStyle(fontSize: 10, color: VesperTheme.textMuted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
