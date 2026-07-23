import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/earnings.dart';
import '../config/constants.dart';

/// Earnings service tracks all earning data
class EarningsService {
  EarningsModel? _earnings;

  EarningsModel? get earnings => _earnings;

  void initialize(String userId) {
    _earnings = EarningsModel(
      userId: userId,
      totalEarnedBtc: 0.0015, // Demo starting balance
      totalEarnedUsd: 0.0,
      todayEarnedBtc: 0.0,
      todayEarnedUsd: 0.0,
      weeklyEarnedBtc: 0.0,
      monthlyEarnedBtc: 0.0,
      miningEarningsBtc: 0.001,
      taskEarningsBtc: 0.0003,
      referralEarningsBtc: 0.0002,
      history: _generateDemoHistory(),
      lastUpdated: DateTime.now(),
    );
  }

  /// Record mining earnings
  void addMiningEarning(double amountBtc) {
    if (_earnings == null) return;

    final entry = EarningEntry(
      timestamp: DateTime.now(),
      amountBtc: amountBtc,
      source: 'mining',
      description: 'Cloud mining reward',
    );

    _earnings = _earnings!.copyWith(
      totalEarnedBtc: _earnings!.totalEarnedBtc + amountBtc,
      todayEarnedBtc: _earnings!.todayEarnedBtc + amountBtc,
      weeklyEarnedBtc: _earnings!.weeklyEarnedBtc + amountBtc,
      monthlyEarnedBtc: _earnings!.monthlyEarnedBtc + amountBtc,
      miningEarningsBtc: _earnings!.miningEarningsBtc + amountBtc,
      history: [entry, ..._earnings!.history.take(99)],
      lastUpdated: DateTime.now(),
    );
  }

  /// Record task earnings
  void addTaskEarning(double amountBtc, String taskDescription) {
    if (_earnings == null) return;

    final entry = EarningEntry(
      timestamp: DateTime.now(),
      amountBtc: amountBtc,
      source: 'task',
      description: taskDescription,
    );

    _earnings = _earnings!.copyWith(
      totalEarnedBtc: _earnings!.totalEarnedBtc + amountBtc,
      todayEarnedBtc: _earnings!.todayEarnedBtc + amountBtc,
      weeklyEarnedBtc: _earnings!.weeklyEarnedBtc + amountBtc,
      monthlyEarnedBtc: _earnings!.monthlyEarnedBtc + amountBtc,
      taskEarningsBtc: _earnings!.taskEarningsBtc + amountBtc,
      history: [entry, ..._earnings!.history.take(99)],
      lastUpdated: DateTime.now(),
    );
  }

  /// Record referral earnings
  void addReferralEarning(double amountBtc, String referralName) {
    if (_earnings == null) return;

    final entry = EarningEntry(
      timestamp: DateTime.now(),
      amountBtc: amountBtc,
      source: 'referral',
      description: 'Referral: $referralName',
    );

    _earnings = _earnings!.copyWith(
      totalEarnedBtc: _earnings!.totalEarnedBtc + amountBtc,
      referralEarningsBtc: _earnings!.referralEarningsBtc + amountBtc,
      history: [entry, ..._earnings!.history.take(99)],
      lastUpdated: DateTime.now(),
    );
  }

  /// Update USD values based on current BTC price
  void updateUsdValues(double bitcoinPrice) {
    if (_earnings == null) return;

    _earnings = _earnings!.copyWith(
      totalEarnedUsd: _earnings!.totalEarnedBtc * bitcoinPrice,
      todayEarnedUsd: _earnings!.todayEarnedBtc * bitcoinPrice,
      lastUpdated: DateTime.now(),
    );
  }

  /// Generate demo history for UI display
  List<EarningEntry> _generateDemoHistory() {
    final entries = <EarningEntry>[];
    final sources = ['mining', 'task', 'referral'];
    
    for (int i = 0; i < 14; i++) {
      final source = sources[Random().nextInt(sources.length)];
      final amount = (Random().nextDouble() * 0.0001).round() / 100000000.0 * 1e8;
      entries.add(EarningEntry(
        timestamp: DateTime.now().subtract(Duration(days: i, hours: Random().nextInt(12))),
        amountBtc: amount,
        source: source,
        description: source == 'mining' ? 'Cloud mining' : source == 'task' ? 'Task reward' : 'Referral bonus',
      ));
    }
    
    return entries;
  }

  /// Get weekly chart data (7 days)
  List<double> getWeeklyChartData() {
    final data = List.filled(7, 0.0);
    if (_earnings == null) return data;
    
    for (final entry in _earnings!.history) {
      final daysAgo = DateTime.now().difference(entry.timestamp).inDays;
      if (daysAgo < 7) {
        data[6 - daysAgo] += entry.amountBtc;
      }
    }
    return data;
  }
}

/// Earnings state
class EarningsState {
  final EarningsModel? earnings;
  final List<double> weeklyChartData;
  final double bitcoinPrice;
  final bool isLoading;

  EarningsState({
    this.earnings,
    this.weeklyChartData = const [],
    this.bitcoinPrice = 67500.0,
    this.isLoading = false,
  });

  EarningsState copyWith({
    EarningsModel? earnings,
    List<double>? weeklyChartData,
    double? bitcoinPrice,
    bool? isLoading,
  }) {
    return EarningsState(
      earnings: earnings ?? this.earnings,
      weeklyChartData: weeklyChartData ?? this.weeklyChartData,
      bitcoinPrice: bitcoinPrice ?? this.bitcoinPrice,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

/// Earnings state notifier
class EarningsNotifier extends StateNotifier<EarningsState> {
  final EarningsService _earningsService;

  EarningsNotifier(this._earningsService) : super(EarningsState());

  void initialize(String userId) {
    _earningsService.initialize(userId);
    state = state.copyWith(
      earnings: _earningsService.earnings,
      weeklyChartData: _earningsService.getWeeklyChartData(),
    );
  }

  void addMiningEarning(double amountBtc) {
    _earningsService.addMiningEarning(amountBtc);
    _refreshState();
  }

  void addTaskEarning(double amountBtc, String description) {
    _earningsService.addTaskEarning(amountBtc, description);
    _refreshState();
  }

  void updateBitcoinPrice(double price) {
    _earningsService.updateUsdValues(price);
    state = state.copyWith(
      bitcoinPrice: price,
      earnings: _earningsService.earnings,
    );
  }

  void _refreshState() {
    state = state.copyWith(
      earnings: _earningsService.earnings,
      weeklyChartData: _earningsService.getWeeklyChartData(),
    );
  }
}

// Providers
final earningsServiceProvider = Provider<EarningsService>((ref) => EarningsService());
final earningsStateProvider = StateNotifierProvider<EarningsNotifier, EarningsState>((ref) {
  return EarningsNotifier(ref.watch(earningsServiceProvider));
});
