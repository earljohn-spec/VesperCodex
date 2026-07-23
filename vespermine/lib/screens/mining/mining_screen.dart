import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../services/mining_service.dart';

/// Simple, reliable mining screen - rebuilt from scratch
class MiningScreen extends ConsumerWidget {
  const MiningScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final miningState = ref.watch(miningStateProvider);
    final user = authState.user;
    final session = miningState.session;
    final isMining = session?.status == MiningStatus.active;
    
    // Debug logging
    print('=== BUILD CALLED ===');
    print('session: $session');
    print('session status: ${session?.status}');
    print('isMining: $isMining');

    final tier = SubscriptionTier.values.firstWhere(
      (t) => t.label.toLowerCase() == (user?.subscriptionTier ?? 'free'),
      orElse: () => SubscriptionTier.free,
    );

    final double hashRate = session?.hashRate ?? tier.hashRate;

    return Scaffold(
      backgroundColor: VesperTheme.bgPrimary,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Center content with max width for readability
            final maxWidth = 500.0;
            final isWide = constraints.maxWidth > maxWidth;
            
            return Center(
              child: Container(
                width: isWide ? maxWidth : constraints.maxWidth,
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Title
                    const Text(
                      'Cloud Mining',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: VesperTheme.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    
                    // Status badge
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isMining 
                              ? VesperTheme.neonGreen.withAlpha(30)
                              : VesperTheme.textMuted.withAlpha(20),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isMining 
                                ? VesperTheme.neonGreen.withAlpha(80)
                                : VesperTheme.textMuted.withAlpha(40),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: isMining ? VesperTheme.neonGreen : VesperTheme.textMuted,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isMining ? 'Active' : 'Idle',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isMining ? VesperTheme.neonGreen : VesperTheme.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Mining visualization (simple circle)
                    Center(
                      child: Container(
                        width: 160,
                        height: 160,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: VesperTheme.bgCard,
                          border: Border.all(
                            color: isMining 
                                ? VesperTheme.neonCyan.withAlpha(100)
                                : VesperTheme.textMuted.withAlpha(30),
                            width: 2,
                          ),
                          boxShadow: isMining
                              ? [
                                  BoxShadow(
                                    color: VesperTheme.neonCyan.withAlpha(40),
                                    blurRadius: 30,
                                    spreadRadius: 5,
                                  ),
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.memory,
                                size: 40,
                                color: VesperTheme.neonCyan,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${hashRate.toStringAsFixed(1)}',
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: VesperTheme.textPrimary,
                                ),
                              ),
                              const Text(
                                'MH/s',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: VesperTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Stats (only show when mining)
                    if (isMining && session != null) ...[
                      Row(
                        children: [
                          Expanded(
                            child: _StatBox(
                              label: 'Uptime',
                              value: session.formattedUptime,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatBox(
                              label: 'Shares',
                              value: '${session.sharesCompleted}',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatBox(
                              label: 'Earned',
                              value: '${(miningState.currentEarnings * 1e8).toStringAsFixed(0)}',
                              suffix: 'sats',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Estimated earnings
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: VesperTheme.bgCard,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: VesperTheme.textMuted.withAlpha(30)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Estimated Earnings',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: VesperTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _EarningsRow(
                            label: 'Daily',
                            value: '${(ref.read(miningServiceProvider).estimateDailyEarnings(tier.hashRate) * 1e8).toStringAsFixed(0)} sats',
                          ),
                          const SizedBox(height: 8),
                          _EarningsRow(
                            label: 'Monthly',
                            value: '${(ref.read(miningServiceProvider).estimateMonthlyEarnings(tier.hashRate) * 1e8).toStringAsFixed(0)} sats',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Start/Stop button
                    ElevatedButton(
                      onPressed: () {
                        print('=== BUTTON PRESSED ===');
                        print('isMining: $isMining');
                        
                        if (isMining) {
                          print('Attempting to STOP mining...');
                          ref.read(miningStateProvider.notifier).stopMining();
                          print('✅ Stop called');
                          
                          // Show confirmation
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Mining stopped!'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        } else {
                          print('Attempting to START mining...');
                          final userId = ref.read(authStateProvider).user?.uid ?? 'demo_user';
                          ref.read(miningStateProvider.notifier).startMining(
                            userId,
                            hashRate,
                            user?.subscriptionTier ?? 'free',
                          );
                          print('✅ Start called');
                          
                          // Show confirmation
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Mining started!'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isMining ? Colors.red : VesperTheme.neonCyan,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 4,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(isMining ? Icons.stop : Icons.play_arrow),
                          const SizedBox(width: 8),
                          Text(
                            isMining ? 'Stop Mining' : 'Start Mining',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;
  final String? suffix;

  const _StatBox({
    required this.label,
    required this.value,
    this.suffix,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: VesperTheme.bgCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: VesperTheme.textMuted.withAlpha(30)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: VesperTheme.neonCyan,
            ),
          ),
          if (suffix != null)
            Text(
              suffix!,
              style: const TextStyle(
                fontSize: 10,
                color: VesperTheme.textMuted,
              ),
            ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: VesperTheme.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _EarningsRow extends StatelessWidget {
  final String label;
  final String value;

  const _EarningsRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: VesperTheme.textSecondary,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: VesperTheme.neonCyan,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}
