import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../services/ad_service.dart';

/// Dialog shown when user watches a rewarded ad
class RewardedAdDialog extends ConsumerStatefulWidget {
  final VoidCallback onReward;

  const RewardedAdDialog({super.key, required this.onReward});

  @override
  ConsumerState<RewardedAdDialog> createState() => _RewardedAdDialogState();
}

class _RewardedAdDialogState extends ConsumerState<RewardedAdDialog> {
  bool _isLoading = true;
  bool _showingAd = false;
  int _countdown = 0;
  AdReward? _reward;

  @override
  void initState() {
    super.initState();
    _startAd();
  }

  Future<void> _startAd() async {
    setState(() => _isLoading = true);
    
    // Simulate ad loading
    await Future.delayed(const Duration(seconds: 1));
    
    setState(() {
      _isLoading = false;
      _showingAd = true;
      _countdown = 30; // 30 second simulated ad
    });

    // Simulate ad countdown
    while (_countdown > 0) {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        setState(() => _countdown--);
      }
    }

    // Ad complete - get reward
    final adService = ref.read(adServiceProvider);
    final reward = await adService.showRewardedAd();
    
    setState(() {
      _showingAd = false;
      _reward = reward;
    });

    if (reward.success) {
      widget.onReward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final adService = ref.watch(adServiceProvider);

    return Dialog(
      backgroundColor: VesperTheme.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VesperTheme.radiusXl)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_isLoading) ...[
              // Loading state
              const Icon(Icons.play_circle_outline, size: 64, color: VesperTheme.neonCyan),
              const SizedBox(height: 16),
              const Text(
                'Loading ad...',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: VesperTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              const CircularProgressIndicator(color: VesperTheme.neonCyan),
            ] else if (_showingAd) ...[
              // Ad playing state
              Container(
                width: double.infinity,
                height: 180,
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
                    const Icon(Icons.movie, size: 48, color: VesperTheme.neonPurple),
                    const SizedBox(height: 12),
                    Text(
                      'Playing Ad...',
                      style: TextStyle(
                        fontSize: 16,
                        color: VesperTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$_countdown seconds remaining',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: VesperTheme.neonCyan,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (30 - _countdown) / 30,
                  backgroundColor: VesperTheme.bgCardElevated,
                  valueColor: const AlwaysStoppedAnimation<Color>(VesperTheme.neonCyan),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.currency_bitcoin, size: 20, color: VesperTheme.neonGold),
                  const SizedBox(width: 8),
                  Text(
                    '+${AdService.rewardPerAd} sats',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: VesperTheme.neonGold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '(${adService.rewardedAdsRemaining} left today)',
                    style: TextStyle(
                      fontSize: 12,
                      color: VesperTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ] else if (_reward != null) ...[
              // Reward complete
              if (_reward!.success) ...[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: VesperTheme.neonGreen.withAlpha(26),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle,
                    size: 64,
                    color: VesperTheme.neonGreen,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Reward Earned!',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: VesperTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _reward!.message,
                  style: const TextStyle(
                    fontSize: 16,
                    color: VesperTheme.neonGreen,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${adService.rewardedAdsRemaining} ads remaining today',
                  style: TextStyle(color: VesperTheme.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: VesperTheme.neonGreen,
                      foregroundColor: VesperTheme.bgPrimary,
                    ),
                    child: const Text('Collect'),
                  ),
                ),
              ] else ...[
                const Icon(Icons.error_outline, size: 64, color: VesperTheme.error),
                const SizedBox(height: 16),
                Text(
                  _reward!.message,
                  style: const TextStyle(color: VesperTheme.error, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('OK'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
