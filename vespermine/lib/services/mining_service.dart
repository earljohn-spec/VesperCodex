import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/mining_session.dart';
import '../config/constants.dart';

/// Mining service that simulates cloud mining operations
/// Later: swap simulation with real cloud mining API calls
class MiningService {
  MiningSession? _activeSession;
  Timer? _miningTimer;
  double _bitcoinPrice = 67500.0; // Simulated BTC price
  
  MiningSession? get activeSession => _activeSession;
  double get bitcoinPrice => _bitcoinPrice;

  /// Start a new mining session
  MiningSession startMining(String userId, double hashRate, String tierName) {
    if (_activeSession != null && _activeSession!.status == MiningStatus.active) {
      throw Exception('Mining session already active');
    }

    _activeSession = MiningSession(
      sessionId: 'session_${DateTime.now().millisecondsSinceEpoch}',
      userId: userId,
      startTime: DateTime.now(),
      hashRate: hashRate,
      status: MiningStatus.active,
      powerConsumption: _calculatePowerConsumption(hashRate),
      tierName: tierName,
    );

    _startMiningTimer();
    return _activeSession!;
  }

  /// Stop the current mining session
  MiningSession? stopMining() {
    if (_activeSession == null) return null;

    _miningTimer?.cancel();
    final stoppedSession = _activeSession!.copyWith(
      status: MiningStatus.idle,
      endTime: DateTime.now(),
      btcEarned: _activeSession!.calculateCurrentEarnings(),
    );
    _activeSession = null; // Clear the active session
    return stoppedSession;
  }

  /// Pause mining (cooldown)
  MiningSession? pauseMining() {
    if (_activeSession == null) return null;

    _miningTimer?.cancel();
    _activeSession = _activeSession!.copyWith(
      status: MiningStatus.paused,
    );
    return _activeSession;
  }

  /// Resume mining
  MiningSession? resumeMining() {
    if (_activeSession == null || _activeSession!.status != MiningStatus.paused) {
      return null;
    }

    _activeSession = _activeSession!.copyWith(
      status: MiningStatus.active,
    );
    _startMiningTimer();
    return _activeSession;
  }

  /// Simulate mining tick - updates earnings periodically
  void _startMiningTimer() {
    _miningTimer?.cancel();
    _miningTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_activeSession == null || _activeSession!.status != MiningStatus.active) {
        timer.cancel();
        return;
      }

      // Simulate share completion every ~30 seconds
      if (_activeSession!.uptime.inSeconds % 30 == 0) {
        _activeSession = _activeSession!.copyWith(
          sharesCompleted: _activeSession!.sharesCompleted + 1,
          btcEarned: _activeSession!.calculateCurrentEarnings(),
        );
      }

      // Simulate hash rate fluctuation (±5%)
      final fluctuation = 1.0 + (Random().nextDouble() * 0.1 - 0.05);
      _activeSession = _activeSession!.copyWith(
        btcEarned: _activeSession!.calculateCurrentEarnings(),
      );
    });
  }

  /// Calculate simulated power consumption
  double _calculatePowerConsumption(double hashRate) {
    return hashRate * 0.5; // watts per MH/s
  }

  /// Fetch current Bitcoin price (simulated)
  Future<double> fetchBitcoinPrice() async {
    await Future.delayed(const Duration(milliseconds: 500));
    
    // Simulate price fluctuation
    final change = Random().nextDouble() * 1000 - 500;
    _bitcoinPrice = (_bitcoinPrice + change).clamp(50000, 100000);
    
    return _bitcoinPrice;
  }

  /// Get estimated daily earnings based on hash rate
  double estimateDailyEarnings(double hashRate) {
    // Simulated: hashRate MH/s * 86400 seconds * satoshiPerHash
    final hashes = hashRate * 1e6 * 86400;
    return hashes * AppConstants.satoshiPerHash;
  }

  /// Get estimated monthly earnings
  double estimateMonthlyEarnings(double hashRate) {
    return estimateDailyEarnings(hashRate) * 30;
  }

  /// Convert BTC to USD
  double btcToUsd(double btc) {
    return btc * _bitcoinPrice;
  }

  /// Convert USD to BTC
  double usdToBtc(double usd) {
    return usd / _bitcoinPrice;
  }

  void dispose() {
    _miningTimer?.cancel();
  }
}

/// Mining state
class MiningState {
  final MiningSession? session;
  final double currentEarnings;
  final double bitcoinPrice;
  final bool isLoading;
  final String? error;

  MiningState({
    this.session,
    this.currentEarnings = 0.0,
    this.bitcoinPrice = 67500.0,
    this.isLoading = false,
    this.error,
  });

  MiningState copyWith({
    MiningSession? session,
    double? currentEarnings,
    double? bitcoinPrice,
    bool? isLoading,
    String? error,
    bool clearSession = false,
  }) {
    return MiningState(
      session: clearSession ? null : (session ?? this.session),
      currentEarnings: currentEarnings ?? this.currentEarnings,
      bitcoinPrice: bitcoinPrice ?? this.bitcoinPrice,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Mining state notifier
class MiningNotifier extends StateNotifier<MiningState> {
  final MiningService _miningService;
  Timer? _updateTimer;

  MiningNotifier(this._miningService) : super(MiningState()) {
    _initPrice();
  }

  void _initPrice() {
    _miningService.fetchBitcoinPrice().then((price) {
      state = state.copyWith(bitcoinPrice: price);
    });
  }

  void startMining(String userId, double hashRate, String tierName) {
    try {
      final session = _miningService.startMining(userId, hashRate, tierName);
      state = state.copyWith(session: session);
      _startUpdateTimer();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void stopMining() {
    _updateTimer?.cancel();
    _miningService.stopMining();
    // Clear the session to force UI update
    state = state.copyWith(clearSession: true);
  }

  void pauseMining() {
    _updateTimer?.cancel();
    final session = _miningService.pauseMining();
    state = state.copyWith(session: session);
  }

  void resumeMining() {
    final session = _miningService.resumeMining();
    if (session != null) {
      state = state.copyWith(session: session);
      _startUpdateTimer();
    }
  }

  void _startUpdateTimer() {
    _updateTimer?.cancel();
    _updateTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_miningService.activeSession != null && 
          _miningService.activeSession!.status == MiningStatus.active) {
        state = state.copyWith(
          session: _miningService.activeSession,
          currentEarnings: _miningService.activeSession!.calculateCurrentEarnings(),
        );
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> refreshPrice() async {
    final price = await _miningService.fetchBitcoinPrice();
    state = state.copyWith(bitcoinPrice: price);
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    _miningService.dispose();
    super.dispose();
  }
}

// Providers
final miningServiceProvider = Provider<MiningService>((ref) => MiningService());
final miningStateProvider = StateNotifierProvider<MiningNotifier, MiningState>((ref) {
  return MiningNotifier(ref.watch(miningServiceProvider));
});
