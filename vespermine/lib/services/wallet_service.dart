import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/wallet.dart';
import '../config/constants.dart';

/// Wallet service manages in-app ledger and external wallet connections
class WalletService {
  WalletModel? _ledgerWallet;
  List<WalletModel> _externalWallets = [];

  WalletModel? get ledgerWallet => _ledgerWallet;
  List<WalletModel> get externalWallets => _externalWallets;

  /// Initialize default ledger
  void initializeLedger(String userId) {
    _ledgerWallet = WalletModel(
      walletId: 'ledger_$userId',
      userId: userId,
      type: WalletType.ledger,
      label: 'VesperMine Ledger',
      balanceBtc: 0.0008, // Starting balance for demo
      balanceUsd: 0.0,
      createdAt: DateTime.now(),
    );
  }

  /// Add external wallet
  WalletModel addExternalWallet(String userId, String address, String label) {
    final wallet = WalletModel(
      walletId: 'ext_${DateTime.now().millisecondsSinceEpoch}',
      userId: userId,
      type: WalletType.external,
      label: label,
      address: address,
      isVerified: true,
      createdAt: DateTime.now(),
    );
    _externalWallets.add(wallet);
    return wallet;
  }

  /// Remove external wallet
  void removeExternalWallet(String walletId) {
    _externalWallets.removeWhere((w) => w.walletId == walletId);
  }

  /// Update ledger balance (after mining or task reward)
  void addEarnings(double amountBtc, double bitcoinPrice) {
    if (_ledgerWallet == null) return;

    _ledgerWallet = _ledgerWallet!.copyWith(
      balanceBtc: _ledgerWallet!.balanceBtc + amountBtc,
      balanceUsd: (_ledgerWallet!.balanceBtc + amountBtc) * bitcoinPrice,
      totalDeposited: _ledgerWallet!.totalDeposited + amountBtc,
      lastTransactionAt: DateTime.now(),
    );
  }

  /// Process withdrawal to external wallet
  WalletModel? withdraw(String externalWalletId, double amountBtc, double bitcoinPrice) {
    if (_ledgerWallet == null) return null;
    if (_ledgerWallet!.balanceBtc < amountBtc) return null;

    final fee = amountBtc * AppConstants.withdrawalFee;
    final netAmount = amountBtc - fee;

    // Update ledger
    _ledgerWallet = _ledgerWallet!.copyWith(
      balanceBtc: _ledgerWallet!.balanceBtc - amountBtc,
      balanceUsd: (_ledgerWallet!.balanceBtc - amountBtc) * bitcoinPrice,
      totalWithdrawn: _ledgerWallet!.totalWithdrawn + netAmount,
      lastTransactionAt: DateTime.now(),
    );

    return _ledgerWallet;
  }

  /// Get withdrawal fee for amount
  double calculateWithdrawalFee(double amountBtc) {
    return amountBtc * AppConstants.withdrawalFee;
  }

  /// Check minimum withdrawal amount
  bool meetsMinimumWithdrawal(double amountBtc) {
    return amountBtc >= AppConstants.minWithdrawalAmount;
  }

  /// Update USD values based on current BTC price
  void updateUsdValues(double bitcoinPrice) {
    if (_ledgerWallet != null) {
      _ledgerWallet = _ledgerWallet!.copyWith(
        balanceUsd: _ledgerWallet!.balanceBtc * bitcoinPrice,
      );
    }
  }
}

/// Wallet state
class WalletState {
  final WalletModel? ledger;
  final List<WalletModel> externalWallets;
  final double bitcoinPrice;
  final bool isLoading;
  final String? error;

  WalletState({
    this.ledger,
    this.externalWallets = const [],
    this.bitcoinPrice = 67500.0,
    this.isLoading = false,
    this.error,
  });

  WalletState copyWith({
    WalletModel? ledger,
    List<WalletModel>? externalWallets,
    double? bitcoinPrice,
    bool? isLoading,
    String? error,
  }) {
    return WalletState(
      ledger: ledger ?? this.ledger,
      externalWallets: externalWallets ?? this.externalWallets,
      bitcoinPrice: bitcoinPrice ?? this.bitcoinPrice,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Wallet state notifier
class WalletNotifier extends StateNotifier<WalletState> {
  final WalletService _walletService;

  WalletNotifier(this._walletService) : super(WalletState());

  void initializeLedger(String userId) {
    _walletService.initializeLedger(userId);
    state = state.copyWith(
      ledger: _walletService.ledgerWallet,
    );
  }

  void addExternalWallet(String userId, String address, String label) {
    final wallet = _walletService.addExternalWallet(userId, address, label);
    state = state.copyWith(
      externalWallets: [...state.externalWallets, wallet],
    );
  }

  void removeExternalWallet(String walletId) {
    _walletService.removeExternalWallet(walletId);
    state = state.copyWith(
      externalWallets: _walletService.externalWallets,
    );
  }

  void addEarnings(double amountBtc) {
    _walletService.addEarnings(amountBtc, state.bitcoinPrice);
    state = state.copyWith(ledger: _walletService.ledgerWallet);
  }

  bool withdraw(String externalWalletId, double amountBtc) {
    if (!_walletService.meetsMinimumWithdrawal(amountBtc)) return false;
    
    final result = _walletService.withdraw(externalWalletId, amountBtc, state.bitcoinPrice);
    if (result != null) {
      state = state.copyWith(ledger: result);
      return true;
    }
    return false;
  }

  void updateBitcoinPrice(double price) {
    _walletService.updateUsdValues(price);
    state = state.copyWith(
      bitcoinPrice: price,
      ledger: _walletService.ledgerWallet,
    );
  }
}

// Providers
final walletServiceProvider = Provider<WalletService>((ref) => WalletService());
final walletStateProvider = StateNotifierProvider<WalletNotifier, WalletState>((ref) {
  return WalletNotifier(ref.watch(walletServiceProvider));
});
