import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

/// Ad Service for VesperMine - Google Mobile Ads Integration
/// 
/// Manages all ad types:
/// - Rewarded ads (watch for sats)
/// - Interstitial ads (between actions)  
/// - Banner ads (dashboard)
///
/// Works in both REAL mode (with AdMob SDK) and SIMULATION mode.
class AdService {
  // ============= AD UNIT IDS =============
  // TEST IDs (for development) - replace with your real AdMob unit IDs
  // Find your real IDs at: https://admob.google.com -> Apps -> Ad Units
  
  static String get rewardedAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/5224354917';
    if (Platform.isIOS) return 'ca-app-pub-3940256099942544/1712485313';
    return 'ca-app-pub-3940256099942544/5224354917'; // Default to Android test
  }

  static String get interstitialAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/1033173712';
    if (Platform.isIOS) return 'ca-app-pub-3940256099942544/4411468910';
    return 'ca-app-pub-3940256099942544/1033173712';
  }

  static String get bannerAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/6300978111';
    if (Platform.isIOS) return 'ca-app-pub-3940256099942544/2934735710';
    return 'ca-app-pub-3940256099942544/6300978111';
  }

  // ============= CONFIG =============
  static const int maxDailyRewardedAds = 10;
  static const int rewardPerAd = 50; // satoshi
  static const int interstitialFrequency = 5;

  // ============= STATE =============
  int _rewardedAdsWatchedToday = 0;
  int _actionCounter = 0;
  RewardedAd? _rewardedAd;
  InterstitialAd? _interstitialAd;
  bool _isRewardedAdLoading = false;
  bool _isInterstitialAdLoading = false;
  bool _sdkAvailable = false;
  Function? _onInterstitialDismissed;

  int get rewardedAdsWatchedToday => _rewardedAdsWatchedToday;
  int get rewardedAdsRemaining => maxDailyRewardedAds - _rewardedAdsWatchedToday;
  bool get canWatchRewardedAd => _rewardedAdsWatchedToday < maxDailyRewardedAds;
  bool get isSdkAvailable => _sdkAvailable;

  // ============= INITIALIZATION =============

  /// Initialize ad service and load ads
  Future<void> initialize() async {
    try {
      final status = await MobileAds.instance.initialize();
      _sdkAvailable = true;
      print('✅ AdMob SDK initialized. Adapters: ${status.adapterStatuses.length}');
      
      // Pre-load ads
      _loadRewardedAd();
      _loadInterstitialAd();
    } catch (e) {
      _sdkAvailable = false;
      print('⚠️ AdMob SDK not available ($e). Running in simulation mode.');
    }
  }

  /// Reset daily counters
  void resetDailyCounters() {
    _rewardedAdsWatchedToday = 0;
    _actionCounter = 0;
  }

  // ============= REWARDED ADS =============

  /// Load a rewarded ad (real SDK)
  void _loadRewardedAd() {
    if (_isRewardedAdLoading || !_sdkAvailable) return;
    _isRewardedAdLoading = true;

    RewardedAd.load(
      adUnitId: rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedAd = ad;
          _isRewardedAdLoading = false;
          
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (ad) {},
            onAdDismissedFullScreenContent: (ad) {
              _rewardedAd = null;
              _loadRewardedAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _rewardedAd = null;
              _isRewardedAdLoading = false;
              _loadRewardedAd();
            },
          );
        },
        onAdFailedToLoad: (error) {
          _rewardedAd = null;
          _isRewardedAdLoading = false;
        },
      ),
    );
  }

  /// Show a rewarded ad and return the reward
  Future<AdReward> showRewardedAd({
    BuildContext? context,
    Function(int amount)? onRewarded,
  }) async {
    if (!canWatchRewardedAd) {
      return AdReward(
        success: false,
        amount: 0,
        message: 'Daily ad limit reached. Come back tomorrow!',
      );
    }

    // REAL SDK MODE
    if (_sdkAvailable && _rewardedAd != null) {
      final ad = _rewardedAd!;
      bool rewardEarned = false;

      try {
        await ad.show(
        onUserEarnedReward: (_, item) {
          rewardEarned = true;
          _rewardedAdsWatchedToday++;
          onRewarded?.call(rewardPerAd);
        },
        );
        
        _rewardedAd = null;
        _loadRewardedAd();

        return rewardEarned
            ? AdReward(success: true, amount: rewardPerAd, message: '+$rewardPerAd sats earned! 🎉')
            : AdReward(success: false, amount: 0, message: 'Watch the full ad to earn sats.');
      } catch (e) {
        return AdReward(success: false, amount: 0, message: 'Failed to show ad.');
      }
    }

    // SIMULATION MODE - simulate watching an ad
    return await _simulateRewardedAd(onRewarded);
  }

  /// Simulate watching a rewarded ad (no SDK needed)
  Future<AdReward> _simulateRewardedAd(Function(int amount)? onRewarded) async {
    // Simulate 3-second ad watch
    await Future.delayed(const Duration(seconds: 3));
    
    _rewardedAdsWatchedToday++;
    onRewarded?.call(rewardPerAd);
    
    return AdReward(
      success: true,
      amount: rewardPerAd,
      message: '+$rewardPerAd sats earned! 🎉 (simulated)',
    );
  }

  // ============= INTERSTITIAL ADS =============

  void _loadInterstitialAd() {
    if (_isInterstitialAdLoading || !_sdkAvailable) return;
    _isInterstitialAdLoading = true;

    InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _isInterstitialAdLoading = false;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              _interstitialAd = null;
              _loadInterstitialAd();
              _onInterstitialDismissed?.call();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _interstitialAd = null;
              _loadInterstitialAd();
            },
          );
        },
        onAdFailedToLoad: (error) {
          _interstitialAd = null;
          _isInterstitialAdLoading = false;
        },
      ),
    );
  }

  Future<void> showInterstitialAd({
    BuildContext? context,
    Function? onDismissed,
  }) async {
    _onInterstitialDismissed = onDismissed;

    if (_sdkAvailable && _interstitialAd != null) {
      try {
        await _interstitialAd!.show();
        _interstitialAd = null;
      } catch (e) {
        // Silently fail
      }
    }
    // Simulation mode: no-op
  }

  bool shouldShowInterstitial() {
    _actionCounter++;
    return _actionCounter % interstitialFrequency == 0;
  }

  // ============= BANNER ADS =============

  BannerAdWidget createBannerAd() {
    return BannerAdWidget(adUnitId: bannerAdUnitId, sdkAvailable: _sdkAvailable);
  }

  void dispose() {
    _rewardedAd?.dispose();
    _interstitialAd?.dispose();
  }
}

/// Result of watching a rewarded ad
class AdReward {
  final bool success;
  final int amount;
  final String message;

  AdReward({required this.success, required this.amount, required this.message});
}

/// Banner Ad Widget
class BannerAdWidget extends StatefulWidget {
  final String adUnitId;
  final bool sdkAvailable;

  const BannerAdWidget({super.key, required this.adUnitId, this.sdkAvailable = false});

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _bannerAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    if (widget.sdkAvailable) _loadBannerAd();
  }

  void _loadBannerAd() {
    _bannerAd = BannerAd(
      adUnitId: widget.adUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) => setState(() => _isLoaded = true),
        onAdFailedToLoad: (ad, error) {
          setState(() => _isLoaded = false);
          _bannerAd?.dispose();
          _bannerAd = null;
        },
      ),
    );
    _bannerAd?.load();
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.sdkAvailable || _bannerAd == null || !_isLoaded) {
      return const SizedBox(height: 0);
    }
    return SizedBox(
      width: _bannerAd!.size.width.toDouble(),
      height: _bannerAd!.size.height.toDouble(),
      child: AdWidget(ad: _bannerAd!),
    );
  }
}

// ============= PROVIDERS =============
final adServiceProvider = Provider<AdService>((ref) {
  final service = AdService();
  ref.onDispose(() => service.dispose());
  return service;
});
