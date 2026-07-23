import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../services/wallet_service.dart';
import '../../services/earnings_service.dart';
import '../../widgets/neon_button.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(walletStateProvider);
    final earningsState = ref.watch(earningsStateProvider);
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    final ledger = walletState.ledger;
    final btcBalance = ledger?.balanceBtc ?? 0.0;
    final usdBalance = btcBalance * walletState.bitcoinPrice;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: VesperTheme.miningGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Wallet',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: VesperTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 24),

                // Wallet Balance Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: VesperTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusXl),
                    boxShadow: [
                      BoxShadow(
                        color: VesperTheme.neonCyan.withAlpha(51),
                        blurRadius: 30,
                        offset: const Offset(0, 15),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.account_balance_wallet, color: Colors.white, size: 24),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withAlpha(26),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'LEDGER',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        '${btcBalance.toStringAsFixed(8)} BTC',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '\$${usdBalance.toStringAsFixed(2)} USD',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.white.withAlpha(179),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          _WalletAction(
                            icon: Icons.arrow_upward,
                            label: 'Withdraw',
                            onTap: () => _showWithdrawDialog(context),
                          ),
                          const SizedBox(width: 16),
                          _WalletAction(
                            icon: Icons.link,
                            label: 'Link Wallet',
                            onTap: () => _showLinkWalletDialog(context),
                          ),
                          const SizedBox(width: 16),
                          _WalletAction(
                            icon: Icons.history,
                            label: 'History',
                            onTap: () {
                              // TODO: Show transaction history
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Earnings Summary
                const Text(
                  'Earnings Summary',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: VesperTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: VesperTheme.bgCard,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                    border: Border.all(color: VesperTheme.textMuted.withAlpha(20)),
                  ),
                  child: Column(
                    children: [
                      _summaryRow('Total Earned', 
                        '${(earningsState.earnings?.totalEarnedBtc ?? 0).toStringAsFixed(8)} BTC',
                        '\$${(earningsState.earnings?.totalEarnedUsd ?? 0).toStringAsFixed(2)}'),
                      const Divider(height: 24),
                      _summaryRow('Today', 
                        '${(earningsState.earnings?.todayEarnedBtc ?? 0).toStringAsFixed(8)} BTC',
                        '\$${(earningsState.earnings?.todayEarnedUsd ?? 0).toStringAsFixed(4)}'),
                      const Divider(height: 24),
                      _summaryRow('This Week', 
                        '${(earningsState.earnings?.weeklyEarnedBtc ?? 0).toStringAsFixed(8)} BTC',
                        null),
                      const Divider(height: 24),
                      _summaryRow('This Month', 
                        '${(earningsState.earnings?.monthlyEarnedBtc ?? 0).toStringAsFixed(8)} BTC',
                        null),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Withdrawal Info
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: VesperTheme.bgCard,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                    border: Border.all(color: VesperTheme.neonGold.withAlpha(30)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: VesperTheme.neonGold.withAlpha(26),
                          borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                        ),
                        child: const Icon(Icons.info_outline, color: VesperTheme.neonGold, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Withdrawal Info',
                              style: TextStyle(
                                color: VesperTheme.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Min: ${(AppConstants.minWithdrawalAmount * 1e8).toStringAsFixed(0)} sats • Fee: ${(AppConstants.withdrawalFee * 100).toStringAsFixed(0)}%',
                              style: const TextStyle(color: VesperTheme.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String btcValue, String? usdValue) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: VesperTheme.textSecondary, fontSize: 14)),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              btcValue,
              style: const TextStyle(
                color: VesperTheme.neonCyan,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            if (usdValue != null)
              Text(usdValue, style: const TextStyle(color: VesperTheme.textMuted, fontSize: 11)),
          ],
        ),
      ],
    );
  }

  void _showWithdrawDialog(BuildContext context) {
    final walletState = ref.read(walletStateProvider);
    final controller = TextEditingController();
    final balance = walletState.ledger?.balanceBtc ?? 0.0;
    String? error;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: VesperTheme.bgCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VesperTheme.radiusLg)),
          title: const Text('Withdraw BTC', style: TextStyle(color: VesperTheme.textPrimary)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Available: ${balance.toStringAsFixed(8)} BTC',
                style: const TextStyle(color: VesperTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: VesperTheme.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Amount (BTC)',
                  hintText: '0.00010000',
                ),
                onChanged: (v) {
                  final amount = double.tryParse(v) ?? 0;
                  if (amount < AppConstants.minWithdrawalAmount) {
                    setDialogState(() => error = 'Minimum ${(AppConstants.minWithdrawalAmount * 1e8).toStringAsFixed(0)} sats');
                  } else if (amount > balance) {
                    setDialogState(() => error = 'Insufficient balance');
                  } else {
                    setDialogState(() => error = null);
                  }
                },
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: const TextStyle(color: VesperTheme.error, fontSize: 12)),
              ],
              const SizedBox(height: 8),
              Text(
                'Fee: ${(AppConstants.withdrawalFee * 100).toStringAsFixed(0)}% commission',
                style: const TextStyle(color: VesperTheme.textMuted, fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: VesperTheme.textMuted)),
            ),
            ElevatedButton(
              onPressed: error != null
                  ? null
                  : () {
                      final amount = double.tryParse(controller.text) ?? 0;
                      if (amount > 0) {
                        // Process withdrawal
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Withdrawal of ${amount.toStringAsFixed(8)} BTC initiated'),
                            backgroundColor: VesperTheme.neonCyan,
                          ),
                        );
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: VesperTheme.neonCyan),
              child: const Text('Withdraw', style: TextStyle(color: VesperTheme.bgPrimary)),
            ),
          ],
        ),
      ),
    );
  }

  void _showLinkWalletDialog(BuildContext context) {
    final addressController = TextEditingController();
    final labelController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VesperTheme.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VesperTheme.radiusLg)),
        title: const Text('Link External Wallet', style: TextStyle(color: VesperTheme.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: labelController,
              style: const TextStyle(color: VesperTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Wallet Label',
                hintText: 'e.g., My Trust Wallet',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: addressController,
              style: const TextStyle(color: VesperTheme.textPrimary, fontSize: 12),
              decoration: const InputDecoration(
                labelText: 'Bitcoin Address',
                hintText: 'bc1q...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: VesperTheme.textMuted)),
          ),
          ElevatedButton(
            onPressed: () {
              final user = ref.read(authStateProvider).user;
              if (user != null && addressController.text.isNotEmpty) {
                ref.read(walletStateProvider.notifier).addExternalWallet(
                  user.uid,
                  addressController.text,
                  labelController.text.isEmpty ? 'External Wallet' : labelController.text,
                );
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Wallet linked successfully!'),
                    backgroundColor: VesperTheme.neonGreen,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: VesperTheme.neonCyan),
            child: const Text('Link', style: TextStyle(color: VesperTheme.bgPrimary)),
          ),
        ],
      ),
    );
  }
}

class _WalletAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _WalletAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(26),
                borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(color: Colors.white, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
