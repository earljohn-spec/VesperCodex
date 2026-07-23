import 'dart:math';
import 'mining_provider_interface.dart';

/// Simulated Mining Provider
/// 
/// Uses realistic mining algorithms to simulate cloud mining behavior.
/// Perfect for development, testing, and demo purposes.
/// 
/// When ready to go live, swap with NiceHashProvider or any other
/// implementation of MiningProviderInterface.
class SimulatedMiningProvider implements MiningProviderInterface {
  final Map<String, _SimulatedOrder> _activeOrders = {};
  final Random _random = Random();
  
  // Simulated network conditions
  double _networkDifficulty = 50000000000.0; // Current BTC difficulty (simplified)
  double _btcPrice = 67500.0;
  
  @override
  String get name => 'Simulated';

  @override
  Future<void> initialize({
    required String apiKey,
    required String apiSecret,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));
    print('SimulatedMiningProvider initialized');
  }

  @override
  Future<double> getAvailableHashRate() async {
    // Simulate available hash rate based on "network conditions"
    await Future.delayed(const Duration(milliseconds: 200));
    return 1000.0; // 1000 MH/s available
  }

  @override
  Future<MiningOrder> rentHashPower({
    required double hashRate,
    required Duration duration,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));

    final orderId = 'SIM_${DateTime.now().millisecondsSinceEpoch}';
    final order = _SimulatedOrder(
      order: MiningOrder(
        orderId: orderId,
        providerName: name,
        hashRate: hashRate,
        startTime: DateTime.now(),
        status: MiningOrderStatus.active,
        algorithm: 'SHA-256',
        costUsd: _calculateCost(hashRate, duration),
      ),
      difficulty: _networkDifficulty,
      pricePerBtc: _btcPrice,
    );

    _activeOrders[orderId] = order;
    return order.order;
  }

  @override
  Future<MiningStats> getMiningStats(String orderId) async {
    await Future.delayed(const Duration(milliseconds: 100));

    final simOrder = _activeOrders[orderId];
    if (simOrder == null) {
      throw Exception('Order not found: $orderId');
    }

    final order = simOrder.order;
    final elapsed = DateTime.now().difference(order.startTime).inSeconds;
    
    // Realistic hash rate fluctuation (±3%)
    final fluctuation = 1.0 + (_random.nextDouble() * 0.06 - 0.03);
    final currentHashRate = order.hashRate * fluctuation;
    
    // Simulate share acceptance rate (98-100%)
    final acceptedShares = elapsed * (currentHashRate / 30).floor().toDouble();
    final rejectedShares = acceptedShares * (0.005 + _random.nextDouble() * 0.015);
    
    // Calculate BTC earned based on simplified mining formula
    // Real formula: (hashRate * time) / (difficulty * 2^32) * blockReward
    final btcPerSecond = _calculateBtcPerSecond(currentHashRate);
    final btcEarned = btcPerSecond * elapsed;
    
    // Estimate daily earnings
    final estimatedDaily = btcPerSecond * 86400;
    
    return MiningStats(
      currentHashRate: currentHashRate,
      acceptedShares: acceptedShares,
      rejectedShares: rejectedShares,
      btcEarnedToday: btcEarned,
      btcEarnedTotal: btcEarned,
      estimatedDailyBtc: estimatedDaily,
      profitability: estimatedDaily * _btcPrice, // USD/day
      powerCost: 0, // Cloud mining, no direct power cost
      timestamp: DateTime.now(),
    );
  }

  @override
  Future<void> stopMining(String orderId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    
    final simOrder = _activeOrders[orderId];
    if (simOrder != null) {
      _activeOrders[orderId] = _SimulatedOrder(
        order: MiningOrder(
          orderId: simOrder.order.orderId,
          providerName: simOrder.order.providerName,
          hashRate: simOrder.order.hashRate,
          startTime: simOrder.order.startTime,
          endTime: DateTime.now(),
          status: MiningOrderStatus.completed,
          algorithm: simOrder.order.algorithm,
          costUsd: simOrder.order.costUsd,
          btcEarned: _calculateBtcPerSecond(simOrder.order.hashRate) * 
              DateTime.now().difference(simOrder.order.startTime).inSeconds,
        ),
        difficulty: simOrder.difficulty,
        pricePerBtc: simOrder.pricePerBtc,
      );
    }
  }

  @override
  Future<List<MiningOrder>> getActiveOrders() async {
    return _activeOrders.values
        .where((o) => o.order.status == MiningOrderStatus.active)
        .map((o) => o.order)
        .toList();
  }

  @override
  Future<List<MiningEarning>> getEarningsHistory({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    // Generate simulated earnings history
    final earnings = <MiningEarning>[];
    final now = DateTime.now();
    
    for (int i = 0; i < 30; i++) {
      final day = now.subtract(Duration(days: i));
      final amount = 0.00001 + _random.nextDouble() * 0.00005;
      
      earnings.add(MiningEarning(
        timestamp: day,
        amountBtc: amount,
        orderId: 'hist_$i',
      ));
    }
    
    return earnings;
  }

  @override
  Future<ProviderStatus> getStatus() async {
    // Simulate occasional network fluctuations
    await Future.delayed(const Duration(milliseconds: 100));
    
    // Update simulated network conditions
    _networkDifficulty += (_random.nextDouble() - 0.5) * 1000000;
    _btcPrice += (_random.nextDouble() - 0.5) * 500;

    return ProviderStatus(
      isOperational: true,
      message: 'Simulated provider operational',
      networkDifficulty: _networkDifficulty,
      btcPrice: _btcPrice,
      activeUsers: 1247 + _random.nextInt(100),
      timestamp: DateTime.now(),
    );
  }

  /// Calculate BTC per second based on simplified mining economics
  /// 
  /// Real Bitcoin mining:
  ///   blocks_per_day = 144 (one block every 10 minutes)
  ///   block_reward = 3.125 BTC (after 2024 halving)
  ///   your_share = (your_hash_rate / network_hash_rate) * blocks_per_day * block_reward
  ///
  /// Simplified for simulation:
  double _calculateBtcPerSecond(double hashRateMHs) {
    // Assume network hash rate of ~500 EH/s = 500,000,000,000 MH/s
    const networkHashRate = 500000000000.0; // MH/s
    
    // 144 blocks/day * 3.125 BTC/block / 86400 seconds
    const btcPerBlock = 3.125;
    const blocksPerSecond = 144.0 / 86400.0;
    
    final share = hashRateMHs / networkHashRate;
    return share * blocksPerSecond * btcPerBlock;
  }

  double _calculateCost(double hashRate, Duration duration) {
    // Simulate cost based on hash rate and duration
    return hashRate * 0.00008 * (duration.inHours / 24);
  }

  /// Update simulated conditions (for testing)
  void updateConditions({double? btcPrice, double? difficulty}) {
    if (btcPrice != null) _btcPrice = btcPrice;
    if (difficulty != null) _networkDifficulty = difficulty;
  }
}

class _SimulatedOrder {
  final MiningOrder order;
  final double difficulty;
  final double pricePerBtc;

  _SimulatedOrder({
    required this.order,
    required this.difficulty,
    required this.pricePerBtc,
  });
}
