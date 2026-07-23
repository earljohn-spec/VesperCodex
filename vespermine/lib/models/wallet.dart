import 'package:flutter/foundation.dart';

/// Represents a cryptocurrency wallet (external or in-app ledger)
class WalletModel {
  final String walletId;
  final String userId;
  final WalletType type;
  final String label;
  final String? address; // External wallet address
  final double balanceBtc; // Current balance in BTC
  final double balanceUsd; // Current balance in USD
  final double totalDeposited;
  final double totalWithdrawn;
  final bool isDefault;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime? lastTransactionAt;
  final List<TransactionModel> transactions;

  WalletModel({
    required this.walletId,
    required this.userId,
    required this.type,
    required this.label,
    this.address,
    this.balanceBtc = 0.0,
    this.balanceUsd = 0.0,
    this.totalDeposited = 0.0,
    this.totalWithdrawn = 0.0,
    this.isDefault = false,
    this.isVerified = false,
    required this.createdAt,
    this.lastTransactionAt,
    this.transactions = const [],
  });

  /// Get formatted BTC balance
  String get balanceFormatted {
    return balanceBtc.toStringAsFixed(8);
  }

  /// Get formatted USD balance
  String get balanceUsdFormatted {
    return '\$${balanceUsd.toStringAsFixed(2)}';
  }

  WalletModel copyWith({
    String? walletId,
    String? userId,
    WalletType? type,
    String? label,
    String? address,
    double? balanceBtc,
    double? balanceUsd,
    double? totalDeposited,
    double? totalWithdrawn,
    bool? isDefault,
    bool? isVerified,
    DateTime? createdAt,
    DateTime? lastTransactionAt,
    List<TransactionModel>? transactions,
  }) {
    return WalletModel(
      walletId: walletId ?? this.walletId,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      label: label ?? this.label,
      address: address ?? this.address,
      balanceBtc: balanceBtc ?? this.balanceBtc,
      balanceUsd: balanceUsd ?? this.balanceUsd,
      totalDeposited: totalDeposited ?? this.totalDeposited,
      totalWithdrawn: totalWithdrawn ?? this.totalWithdrawn,
      isDefault: isDefault ?? this.isDefault,
      isVerified: isVerified ?? this.isVerified,
      createdAt: createdAt ?? this.createdAt,
      lastTransactionAt: lastTransactionAt ?? this.lastTransactionAt,
      transactions: transactions ?? this.transactions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'walletId': walletId,
      'userId': userId,
      'type': type.name,
      'label': label,
      'address': address,
      'balanceBtc': balanceBtc,
      'balanceUsd': balanceUsd,
      'totalDeposited': totalDeposited,
      'totalWithdrawn': totalWithdrawn,
      'isDefault': isDefault,
      'isVerified': isVerified,
      'createdAt': createdAt.toIso8601String(),
      'lastTransactionAt': lastTransactionAt?.toIso8601String(),
      'transactions': transactions.map((t) => t.toJson()).toList(),
    };
  }

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    return WalletModel(
      walletId: json['walletId'] as String,
      userId: json['userId'] as String,
      type: WalletType.values.firstWhere((e) => e.name == json['type'], orElse: () => WalletType.ledger),
      label: json['label'] as String,
      address: json['address'] as String?,
      balanceBtc: (json['balanceBtc'] as num?)?.toDouble() ?? 0.0,
      balanceUsd: (json['balanceUsd'] as num?)?.toDouble() ?? 0.0,
      totalDeposited: (json['totalDeposited'] as num?)?.toDouble() ?? 0.0,
      totalWithdrawn: (json['totalWithdrawn'] as num?)?.toDouble() ?? 0.0,
      isDefault: json['isDefault'] as bool? ?? false,
      isVerified: json['isVerified'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastTransactionAt: json['lastTransactionAt'] != null 
          ? DateTime.parse(json['lastTransactionAt'] as String) 
          : null,
      transactions: (json['transactions'] as List?)
          ?.map((t) => TransactionModel.fromJson(t as Map<String, dynamic>))
          .toList() ?? [],
    );
  }
}

/// Wallet types
enum WalletType {
  ledger, // In-app earnings ledger (not real wallet, tracks simulated BTC)
  external, // User's own external wallet
  custodial, // Platform custodial wallet
}

/// Transaction record
class TransactionModel {
  final String transactionId;
  final String walletId;
  final TransactionType type;
  final double amountBtc;
  final double amountUsd;
  final double? feeBtc;
  final TransactionStatus status;
  final String? description;
  final String? externalAddress;
  final DateTime timestamp;

  TransactionModel({
    required this.transactionId,
    required this.walletId,
    required this.type,
    required this.amountBtc,
    required this.amountUsd,
    this.feeBtc,
    this.status = TransactionStatus.completed,
    this.description,
    this.externalAddress,
    required this.timestamp,
  });

  String get amountFormatted => '${type == TransactionType.withdrawal ? '-' : '+'}${amountBtc.toStringAsFixed(8)} BTC';

  String get amountUsdFormatted => '\$${amountUsd.toStringAsFixed(2)}';

  Map<String, dynamic> toJson() {
    return {
      'transactionId': transactionId,
      'walletId': walletId,
      'type': type.name,
      'amountBtc': amountBtc,
      'amountUsd': amountUsd,
      'feeBtc': feeBtc,
      'status': status.name,
      'description': description,
      'externalAddress': externalAddress,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      transactionId: json['transactionId'] as String,
      walletId: json['walletId'] as String,
      type: TransactionType.values.firstWhere((e) => e.name == json['type']),
      amountBtc: (json['amountBtc'] as num).toDouble(),
      amountUsd: (json['amountUsd'] as num).toDouble(),
      feeBtc: (json['feeBtc'] as num?)?.toDouble(),
      status: TransactionStatus.values.firstWhere((e) => e.name == json['status'], orElse: () => TransactionStatus.completed),
      description: json['description'] as String?,
      externalAddress: json['externalAddress'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}

enum TransactionType {
  miningReward,
  taskReward,
  referralBonus,
  deposit,
  withdrawal,
  commission,
}

enum TransactionStatus {
  pending,
  completed,
  failed,
  cancelled,
}
