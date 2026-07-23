import '../../../models/mining_session.dart';

/// Abstract interface for cloud mining providers
/// 
/// This allows swapping mining providers without changing app code.
/// Implementations:
/// - NiceHashProvider
/// - GenesisMiningProvider
/// - KuCoinPoolProvider
/// - SimulatedProvider (for testing)
abstract class MiningProviderInterface {
  /// Provider name
  String get name;

  /// Initialize the provider with API credentials
  Future<void> initialize({
    required String apiKey,
    required String apiSecret,
  });

  /// Get current available hash rate
  Future<double> getAvailableHashRate();

  /// Rent/buy hash power
  Future<MiningOrder> rentHashPower({
    required double hashRate,
    required Duration duration,
  });

  /// Get current mining stats for an active order
  Future<MiningStats> getMiningStats(String orderId);

  /// Stop/cancel a mining order
  Future<void> stopMining(String orderId);

  /// Get all active mining orders
  Future<List<MiningOrder>> getActiveOrders();

  /// Get earnings history
  Future<List<MiningEarning>> getEarningsHistory({
    DateTime? startDate,
    DateTime? endDate,
  });

  /// Get provider health/status
  Future<ProviderStatus> getStatus();
}

/// Represents a mining order from a provider
class MiningOrder {
  final String orderId;
  final String providerName;
  final double hashRate; // MH/s
  final double hashRateUnit; // 1 = MH/s, 1000 = GH/s, etc.
  final DateTime startTime;
  final DateTime? endTime;
  final MiningOrderStatus status;
  final double btcEarned;
  final double costUsd;
  final String algorithm; // SHA256, Scrypt, etc.

  MiningOrder({
    required this.orderId,
    required this.providerName,
    required this.hashRate,
    this.hashRateUnit = 1,
    required this.startTime,
    this.endTime,
    this.status = MiningOrderStatus.active,
    this.btcEarned = 0,
    this.costUsd = 0,
    this.algorithm = 'SHA-256',
  });
}

enum MiningOrderStatus {
  pending,
  active,
  completed,
  cancelled,
  failed,
}

/// Real-time mining statistics
class MiningStats {
  final double currentHashRate;
  final double acceptedShares;
  final double rejectedShares;
  final double btcEarnedToday;
  final double btcEarnedTotal;
  final double estimatedDailyBtc;
  final double profitability; // USD/day
  final double powerCost; // USD/day
  final DateTime timestamp;

  MiningStats({
    required this.currentHashRate,
    required this.acceptedShares,
    required this.rejectedShares,
    required this.btcEarnedToday,
    required this.btcEarnedTotal,
    required this.estimatedDailyBtc,
    required this.profitability,
    required this.powerCost,
    required this.timestamp,
  });
}

/// Individual earning record from mining
class MiningEarning {
  final DateTime timestamp;
  final double amountBtc;
  final String orderId;
  final String? txId;

  MiningEarning({
    required this.timestamp,
    required this.amountBtc,
    required this.orderId,
    this.txId,
  });
}

/// Provider operational status
class ProviderStatus {
  final bool isOperational;
  final String message;
  final double? networkDifficulty;
  final double? btcPrice;
  final int? activeUsers;
  final DateTime timestamp;

  ProviderStatus({
    required this.isOperational,
    required this.message,
    this.networkDifficulty,
    this.btcPrice,
    this.activeUsers,
    required this.timestamp,
  });
}
