import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../services/ad_service.dart';

/// Banner ad widget for dashboard and other screens
class AdBannerWidget extends ConsumerWidget {
  const AdBannerWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // In production, this would return the real AdMob banner widget
    // For now, return a placeholder that shows the concept
    
    return Container(
      width: double.infinity,
      height: 56,
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: VesperTheme.bgCard,
        borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
        border: Border.all(
          color: VesperTheme.textMuted.withAlpha(20),
          style: BorderStyle.solid,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.auto_awesome,
            color: VesperTheme.textMuted.withAlpha(100),
            size: 18,
          ),
          const SizedBox(width: 8),
          Text(
            'Banner Ad Space',
            style: TextStyle(
              color: VesperTheme.textMuted.withAlpha(100),
              fontSize: 12,
              letterSpacing: 2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Watch Ad Button - triggers the rewarded ad flow
class WatchAdButton extends ConsumerWidget {
  final VoidCallback onReward;
  final int satsPerAd;

  const WatchAdButton({
    super.key,
    required this.onReward,
    this.satsPerAd = AdService.rewardPerAd,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final adService = ref.watch(adServiceProvider);

    return GestureDetector(
      onTap: adService.canWatchRewardedAd
          ? () => _showRewardedAd(context, ref)
          : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: adService.canWatchRewardedAd
              ? LinearGradient(
                  colors: [
                    VesperTheme.neonGold.withAlpha(50),
                    VesperTheme.neonOrange.withAlpha(30),
                  ],
                )
              : null,
          color: adService.canWatchRewardedAd ? null : VesperTheme.bgCard,
          borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
          border: Border.all(
            color: adService.canWatchRewardedAd
                ? VesperTheme.neonGold.withAlpha(60)
                : VesperTheme.textMuted.withAlpha(20),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.play_circle_fill,
              color: adService.canWatchRewardedAd
                  ? VesperTheme.neonGold
                  : VesperTheme.textMuted,
              size: 24,
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  adService.canWatchRewardedAd
                      ? 'Watch Ad for $satsPerAd sats'
                      : 'Ads completed for today',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: adService.canWatchRewardedAd
                        ? VesperTheme.neonGold
                        : VesperTheme.textMuted,
                  ),
                ),
                Text(
                  adService.canWatchRewardedAd
                      ? '${adService.rewardedAdsRemaining} remaining today'
                      : 'Come back tomorrow!',
                  style: TextStyle(
                    fontSize: 10,
                    color: adService.canWatchRewardedAd
                        ? VesperTheme.textMuted
                        : VesperTheme.textMuted,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showRewardedAd(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _RewardedAdOverlay(
        onReward: onReward,
      ),
    );
  }
}

/// Simplified rewarded ad overlay
class _RewardedAdOverlay extends ConsumerStatefulWidget {
  final VoidCallback onReward;

  const _RewardedAdOverlay({required this.onReward});

  @override
  ConsumerState<_RewardedAdOverlay> createState() => _RewardedAdOverlayState();
}

class _RewardedAdOverlayState extends ConsumerState<_RewardedAdOverlay> {
  int _countdown = 15; // Shorter for UX demo
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() async {
    while (_countdown > 0 && mounted) {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) setState(() => _countdown--);
    }

    if (mounted) {
      setState(() => _completed = true);
      // Claim reward
      final adService = ref.read(adServiceProvider);
      final reward = await adService.showRewardedAd();
      if (reward.success) {
        widget.onReward();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: VesperTheme.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VesperTheme.radiusXl)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!_completed) ...[
              Container(
                width: 200,
                height: 150,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      VesperTheme.neonPurple.withAlpha(30),
                      VesperTheme.neonCyan.withAlpha(20),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.movie, size: 40, color: VesperTheme.neonPurple),
                    const SizedBox(height: 8),
                    Text(
                      '$_countdown',
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: VesperTheme.neonCyan,
                      ),
                    ),
                    Text(
                      'seconds',
                      style: TextStyle(color: VesperTheme.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (15 - _countdown) / 15,
                  backgroundColor: VesperTheme.bgCardElevated,
                  valueColor: const AlwaysStoppedAnimation(VesperTheme.neonCyan),
                  minHeight: 4,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.currency_bitcoin, size: 16, color: VesperTheme.neonGold),
                  const SizedBox(width: 4),
                  Text(
                    '+${AdService.rewardPerAd} sats',
                    style: const TextStyle(
                      color: VesperTheme.neonGold,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ] else ...[
              const Icon(Icons.celebration, size: 64, color: VesperTheme.neonGold),
              const SizedBox(height: 16),
              const Text(
                'Reward Claimed!',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: VesperTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '+${AdService.rewardPerAd} satoshi earned',
                style: const TextStyle(color: VesperTheme.neonGreen, fontSize: 16),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: VesperTheme.neonGreen,
                  foregroundColor: VesperTheme.bgPrimary,
                ),
                child: const Text('Collect'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
