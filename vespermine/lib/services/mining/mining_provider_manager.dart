import 'providers/mining_provider_interface.dart';
import 'providers/nicehash_provider.dart';
import 'providers/simulated_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mining Provider Manager
/// 
/// Manages the active mining provider and handles failover.
/// When one provider goes down, it automatically switches to a fallback.
/// 
/// Usage:
/// ```dart
/// final manager = MiningProviderManager();
/// await manager.setProvider(ProviderType.nicehash, apiKey: '...', apiSecret: '...');
/// final stats = await manager.getMiningStats(orderId);
/// ```
class MiningProviderManager {
  MiningProviderInterface? _activeProvider;
  ProviderType _activeProviderType = ProviderType.simulated;
  final List<MiningProviderInterface> _fallbackProviders = [];
  
  MiningProviderInterface? get activeProvider => _activeProvider;
  ProviderType get activeProviderType => _activeProviderType;
  bool get isUsingRealProvider => _activeProviderType != ProviderType.simulated;

  /// Set the active mining provider
  Future<void> setProvider(
    ProviderType type, {
    String? apiKey,
    String? apiSecret,
    String? orgId,
  }) async {
    MiningProviderInterface provider;
    
    switch (type) {
      case ProviderType.nicehash:
        provider = NiceHashProvider();
        break;
      case ProviderType.simulated:
        provider = SimulatedMiningProvider();
        break;
    }

    // Initialize with credentials
    await provider.initialize(
      apiKey: apiKey ?? 'simulated_key',
      apiSecret: apiSecret ?? 'simulated_secret',
    );

    _activeProvider = provider;
    _activeProviderType = type;
  }

  /// Initialize with default providers
  /// Uses simulated provider for development, switches to real when configured
  Future<void> initializeDefault() async {
    // Start with simulated provider
    final simulated = SimulatedMiningProvider();
    await simulated.initialize(
      apiKey: 'simulated',
      apiSecret: 'simulated',
    );
    _activeProvider = simulated;
    _activeProviderType = ProviderType.simulated;

    // Prepare NiceHash as fallback (not initialized until credentials provided)
    _fallbackProviders.add(NiceHashProvider());
  }

  /// Switch to fallback provider if current one fails
  Future<void> failover() async {
    print('Mining provider failover triggered');
    
    if (_fallbackProviders.isNotEmpty) {
      final fallback = _fallbackProviders.first;
      await fallback.initialize(
        apiKey: 'simulated',
        apiSecret: 'simulated',
      );
      _activeProvider = fallback;
      _activeProviderType = ProviderType.simulated;
    }
  }

  /// Delegate all methods to the active provider
  Future<double> getAvailableHashRate() => _activeProvider!.getAvailableHashRate();
  
  Future<MiningOrder> rentHashPower({
    required double hashRate,
    required Duration duration,
  }) => _activeProvider!.rentHashPower(hashRate: hashRate, duration: duration);
  
  Future<MiningStats> getMiningStats(String orderId) => _activeProvider!.getMiningStats(orderId);
  
  Future<void> stopMining(String orderId) => _activeProvider!.stopMining(orderId);
  
  Future<List<MiningOrder>> getActiveOrders() => _activeProvider!.getActiveOrders();
  
  Future<List<MiningEarning>> getEarningsHistory({
    DateTime? startDate,
    DateTime? endDate,
  }) => _activeProvider!.getEarningsHistory(startDate: startDate, endDate: endDate);
  
  Future<ProviderStatus> getStatus() => _activeProvider!.getStatus();
}

/// Available provider types
enum ProviderType {
  nicehash,
  simulated,
}

/// Provider for MiningProviderManager
final miningProviderManagerProvider = Provider<MiningProviderManager>((ref) {
  final manager = MiningProviderManager();
  // Initialize lazily
  return manager;
});

/// Provider for active mining provider type
final activeProviderTypeProvider = StateProvider<ProviderType>((ref) {
  return ProviderType.simulated;
});
