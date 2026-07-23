import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Simple bar chart for weekly earnings visualization
class EarningsChart extends StatelessWidget {
  final List<double> data; // 7 days of earnings in BTC
  final double bitcoinPrice;

  const EarningsChart({
    super.key,
    required this.data,
    required this.bitcoinPrice,
  });

  @override
  Widget build(BuildContext context) {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final maxVal = data.isEmpty ? 1.0 : data.reduce((a, b) => a > b ? a : b);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: VesperTheme.bgCard,
        borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
        border: Border.all(color: VesperTheme.neonCyan.withAlpha(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Weekly Earnings',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: VesperTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Last 7 days',
            style: TextStyle(color: VesperTheme.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(7, (i) {
                final value = i < data.length ? data[i] : 0;
                final ratio = maxVal > 0 ? value / maxVal : 0.0;
                final usdValue = value * bitcoinPrice;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (usdValue > 0)
                          Text(
                            '\$${usdValue.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: VesperTheme.neonCyan,
                              fontSize: 8,
                            ),
                          ),
                        const SizedBox(height: 4),
                        Flexible(
                          child: Container(
                            height: (ratio * 100).clamp(2.0, 100.0),
                            width: double.infinity,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [VesperTheme.neonCyan, VesperTheme.neonPurple],
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                              ),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          days[i],
                          style: const TextStyle(
                            color: VesperTheme.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
