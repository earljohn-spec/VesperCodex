/// Application-wide constants for VesperMine
class AppConstants {
  // App Info
  static const String appName = 'VesperMine';
  static const String appTagline = 'Mine. Earn. Repeat.';
  static const String appVersion = '1.0.0';

  // Mining Defaults
  static const double defaultHashRate = 10.0; // MH/s base
  static const double minHashRate = 1.0;
  static const double maxFreeHashRate = 50.0;
  static const double maxProHashRate = 500.0;
  static const double miningCycleDuration = 24.0; // hours
  static const double satoshiPerHash = 1.16e-15; // BTC per hash (~10 sats per MH/s per day)

  // Rewards
  static const int dailyCheckInReward = 100; // satoshi
  static const int referralBonus = 500; // satoshi per referral
  static const int adWatchReward = 50; // satoshi per ad
  static const int surveyReward = 200; // satoshi per survey
  static const int maxDailyAds = 10;
  static const int streakBonusMultiplier = 2; // doubles at 7-day streak

  // Subscription Tiers
  static const double freeTierHashRate = 10.0;
  static const double starterTierHashRate = 50.0;
  static const double proTierHashRate = 200.0;
  static const double eliteTierHashRate = 500.0;

  // Pricing (USD)
  static const double starterMonthlyPrice = 4.99;
  static const double proMonthlyPrice = 14.99;
  static const double eliteMonthlyPrice = 29.99;

  // Commission
  static const double withdrawalFee = 0.02; // 2% withdrawal commission
  static const double minWithdrawalAmount = 0.0001; // BTC (~$5)

  // API Endpoints (simulated)
  static const String baseUrl = 'https://api.vespermine.app/v1';
  static const String bitcoinPriceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

  // Storage Keys
  static const String keyAuthToken = 'auth_token';
  static const String keyUserId = 'user_id';
  static const String keyMiningActive = 'mining_active';
  static const String keyLastCheckIn = 'last_check_in';
  static const String keyStreak = 'streak_count';
  static const String keySubscriptionTier = 'subscription_tier';

  // Animation Durations
  static const Duration animFast = Duration(milliseconds: 200);
  static const Duration animNormal = Duration(milliseconds: 400);
  static const Duration animSlow = Duration(milliseconds: 800);
}

/// Subscription tier enum
enum SubscriptionTier {
  free('Free', 0, AppConstants.freeTierHashRate),
  starter('Starter', AppConstants.starterMonthlyPrice, AppConstants.starterTierHashRate),
  pro('Pro', AppConstants.proMonthlyPrice, AppConstants.proTierHashRate),
  elite('Elite', AppConstants.eliteMonthlyPrice, AppConstants.eliteTierHashRate);

  final String label;
  final double price;
  final double hashRate;

  const SubscriptionTier(this.label, this.price, this.hashRate);
}

/// Mining status enum
enum MiningStatus {
  idle,
  active,
  paused,
  cooldown,
}

/// Task type enum
enum TaskType {
  dailyCheckIn,
  watchAd,
  completeSurvey,
  referral,
  socialShare,
  achieveStreak,
}
