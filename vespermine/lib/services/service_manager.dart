import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_service.dart';
import 'mining_service.dart';
import 'task_service.dart';
import 'wallet_service.dart';
import 'earnings_service.dart';
import 'ad_service.dart';
import 'payment_service.dart';
import 'mining/mining_provider_manager.dart';

/// Central service manager that coordinates all app services
/// 
/// Handles initialization of all services in the correct order.
/// Works in both simulation mode (no Firebase) and production mode.
class ServiceManager {
  ServiceManager._();
  static final ServiceManager instance = ServiceManager._();

  // ============= SERVICE STATE =============
  bool _isInitialized = false;
  bool _isFirebaseConnected = false;
  bool _isAdMobReady = false;
  String? _currentUserId;

  bool get isInitialized => _isInitialized;
  bool get isFirebaseConnected => _isFirebaseConnected;
  bool get isAdMobReady => _isAdMobReady;
  String? get currentUserId => _currentUserId;

  // ============= SERVICES =============
  late final AuthService _authService;
  late final MiningService _miningService;
  late final TaskService _taskService;
  late final WalletService _walletService;
  late final EarningsService _earningsService;
  late final AdService _adService;
  late final PaymentService _paymentService;
  late final MiningProviderManager _miningProviderManager;

  AuthService get authService => _authService;
  MiningService get miningService => _miningService;
  TaskService get taskService => _taskService;
  WalletService get walletService => _walletService;
  EarningsService get earningsService => _earningsService;
  AdService get adService => _adService;
  PaymentService get paymentService => _paymentService;
  MiningProviderManager get miningProviderManager => _miningProviderManager;

  // ============= INITIALIZATION =============

  /// Initialize all services
  Future<void> initializeAll({bool firebaseEnabled = false}) async {
    if (_isInitialized) return;

    print('🚀 Initializing VesperMine services...');
    print('   Firebase: ${firebaseEnabled ? "enabled" : "disabled (simulation)"}');

    _isFirebaseConnected = firebaseEnabled;

    // 1. Initialize services
    _authService = AuthService();
    _miningService = MiningService();
    _taskService = TaskService();
    _walletService = WalletService();
    _earningsService = EarningsService();
    _adService = AdService();
    _paymentService = PaymentService();
    _miningProviderManager = MiningProviderManager();

    // 2. Initialize mining provider (start with simulated)
    await _initMiningProvider();

    // 3. Initialize ad service (best-effort)
    await _initAdService();

    // 4. Initialize task system
    _taskService.initialize();
    print('✅ Task system initialized');

    _isInitialized = true;
    print('✅ All services initialized');
  }

  /// Initialize mining provider
  Future<void> _initMiningProvider() async {
    try {
      await _miningProviderManager.initializeDefault();
      print('✅ Mining provider: ${_miningProviderManager.activeProviderType.name}');
    } catch (e) {
      print('⚠️ Mining provider init failed: $e');
    }
  }

  /// Initialize ad service
  Future<void> _initAdService() async {
    try {
      await _adService.initialize();
      _isAdMobReady = true;
      print('✅ Ad service ready');
    } catch (e) {
      print('⚠️ Ad service init skipped: $e');
    }
  }

  // ============= USER ACTIONS =============

  /// Called after successful login/registration
  Future<void> onUserAuthenticated(String userId) async {
    _currentUserId = userId;
    
    // Initialize user-specific data
    _walletService.initializeLedger(userId);
    _earningsService.initialize(userId);
    
    // Initialize payment service for this user
    try {
      await _paymentService.initialize(userId);
    } catch (e) {
      print('⚠️ Payment service init skipped: $e');
    }
    
    print('✅ User services initialized for: $userId');
  }

  /// Called when user starts mining
  Future<void> startMiningSession() async {
    final userId = _currentUserId ?? 'demo_user';
    
    // Use the mining provider manager
    try {
      final order = await _miningProviderManager.rentHashPower(
        hashRate: 10,
        duration: const Duration(hours: 24),
      );
      
      // Also start local session tracking
      _miningService.startMining(userId, order.hashRate, 'free');
    } catch (e) {
      // Fallback: start local simulation directly
      _miningService.startMining(userId, 10, 'free');
    }
  }

  /// Called when user stops mining
  Future<void> stopMiningSession(String sessionId) async {
    _miningService.stopMining();
    try {
      await _miningProviderManager.stopMining(sessionId);
    } catch (e) {
      // Ignore if provider not available
    }
  }

  /// Called when user completes a task
  Future<int?> completeTask(String taskId, String taskType) async {
    final reward = _taskService.completeTask(taskId);
    if (reward != null) {
      final btcReward = reward.rewardSatoshi / 1e8;
      _walletService.addEarnings(btcReward, _miningService.bitcoinPrice);
      _earningsService.addTaskEarning(btcReward, reward.title);
      return reward.rewardSatoshi;
    }
    return null;
  }

  /// Called when user watches a rewarded ad
  Future<AdReward> watchRewardedAd() async {
    final reward = await _adService.showRewardedAd();
    if (reward.success) {
      final btcReward = reward.amount / 1e8;
      _walletService.addEarnings(btcReward, _miningService.bitcoinPrice);
      _earningsService.addTaskEarning(btcReward, 'Ad reward');
    }
    return reward;
  }

  /// Called when user changes subscription
  Future<PurchaseResult> purchaseSubscription(String packageId) async {
    final result = await _paymentService.purchasePackage(packageId);
    if (result.success && result.tier != null) {
      print('✅ Subscription upgraded to: ${result.tier}');
    }
    return result;
  }

  /// Process withdrawal
  Future<bool> processWithdrawal(double amountBtc, String address) async {
    final result = _walletService.withdraw(address, amountBtc, _miningService.bitcoinPrice);
    return result != null;
  }

  /// Get current Bitcoin price
  Future<double> getBitcoinPrice() async {
    return await _miningService.fetchBitcoinPrice();
  }

  /// Dispose all services
  void dispose() {
    _miningService.dispose();
    _adService.dispose();
    _paymentService.dispose();
    print('🔌 Services disposed');
  }
}

/// Riverpod provider for ServiceManager
final serviceManagerProvider = Provider<ServiceManager>((ref) {
  return ServiceManager.instance;
});
