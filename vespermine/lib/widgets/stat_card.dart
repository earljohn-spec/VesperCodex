import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Stats card with icon, label, and value - used on dashboard
class StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? iconColor;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: VesperTheme.bgCard,
          borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
          border: Border.all(
            color: VesperTheme.neonCyan.withAlpha(20),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: (iconColor ?? VesperTheme.neonCyan).withAlpha(26),
                borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
              ),
              child: Icon(
                icon,
                color: iconColor ?? VesperTheme.neonCyan,
                size: 20,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: VesperTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: VesperTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Balance card - large card showing primary balance
class BalanceCard extends StatelessWidget {
  final String balance;
  final String balanceUsd;
  final String changePercent;
  final bool isPositive;

  const BalanceCard({
    super.key,
    required this.balance,
    required this.balanceUsd,
    required this.changePercent,
    this.isPositive = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(26),
                  borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                ),
                child: const Icon(
                  Icons.currency_bitcoin,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isPositive
                      ? VesperTheme.neonGreen.withAlpha(38)
                      : VesperTheme.error.withAlpha(38),
                  borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                ),
                child: Text(
                  '${isPositive ? '+' : ''}$changePercent',
                  style: TextStyle(
                    color: isPositive ? VesperTheme.neonGreen : VesperTheme.error,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            balance,
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            balanceUsd,
            style: TextStyle(
              fontSize: 16,
              color: Colors.white.withAlpha(179),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Total Balance',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withAlpha(128),
            ),
          ),
        ],
      ),
    );
  }
}
