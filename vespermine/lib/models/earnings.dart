import 'package:flutter/foundation.dart';

/// Tracks earnings data with historical breakdown
class EarningsModel {
  final String userId;
  final double totalEarnedBtc;
  final double totalEarnedUsd;
  final double todayEarnedBtc;
  final double todayEarnedUsd;
  final double weeklyEarnedBtc;
  final double monthlyEarnedBtc;
  final double miningEarningsBtc;
  final double taskEarningsBtc;
  final double referralEarningsBtc;
  final List<EarningEntry> history;
  final DateTime lastUpdated;

  EarningsModel({
    required this.userId,
    this.totalEarnedBtc = 0.0,
    this.totalEarnedUsd = 0.0,
    this.todayEarnedBtc = 0.0,
    this.todayEarnedUsd = 0.0,
    this.weeklyEarnedBtc = 0.0,
    this.monthlyEarnedBtc = 0.0,
    this.miningEarningsBtc = 0.0,
    this.taskEarningsBtc = 0.0,
    this.referralEarningsBtc = 0.0,
    this.history = const [],
    required this.lastUpdated,
  });

  /// Get total in satoshi
  int get totalSatoshi => (totalEarnedBtc * 100000000).round();

  /// Get today's earnings in satoshi
  int get todaySatoshi => (todayEarnedBtc * 100000000).round();

  /// Get earnings breakdown percentage
  double get miningPercentage {
    if (totalEarnedBtc == 0) return 0;
    return miningEarningsBtc / totalEarnedBtc * 100;
  }

  double get taskPercentage {
    if (totalEarnedBtc == 0) return 0;
    return taskEarningsBtc / totalEarnedBtc * 100;
  }

  double get referralPercentage {
    if (totalEarnedBtc == 0) return 0;
    return referralEarningsBtc / totalEarnedBtc * 100;
  }

  EarningsModel copyWith({
    String? userId,
    double? totalEarnedBtc,
    double? totalEarnedUsd,
    double? todayEarnedBtc,
    double? todayEarnedUsd,
    double? weeklyEarnedBtc,
    double? monthlyEarnedBtc,
    double? miningEarningsBtc,
    double? taskEarningsBtc,
    double? referralEarningsBtc,
    List<EarningEntry>? history,
    DateTime? lastUpdated,
  }) {
    return EarningsModel(
      userId: userId ?? this.userId,
      totalEarnedBtc: totalEarnedBtc ?? this.totalEarnedBtc,
      totalEarnedUsd: totalEarnedUsd ?? this.totalEarnedUsd,
      todayEarnedBtc: todayEarnedBtc ?? this.todayEarnedBtc,
      todayEarnedUsd: todayEarnedUsd ?? this.todayEarnedUsd,
      weeklyEarnedBtc: weeklyEarnedBtc ?? this.weeklyEarnedBtc,
      monthlyEarnedBtc: monthlyEarnedBtc ?? this.monthlyEarnedBtc,
      miningEarningsBtc: miningEarningsBtc ?? this.miningEarningsBtc,
      taskEarningsBtc: taskEarningsBtc ?? this.taskEarningsBtc,
      referralEarningsBtc: referralEarningsBtc ?? this.referralEarningsBtc,
      history: history ?? this.history,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'totalEarnedBtc': totalEarnedBtc,
      'totalEarnedUsd': totalEarnedUsd,
      'todayEarnedBtc': todayEarnedBtc,
      'todayEarnedUsd': todayEarnedUsd,
      'weeklyEarnedBtc': weeklyEarnedBtc,
      'monthlyEarnedBtc': monthlyEarnedBtc,
      'miningEarningsBtc': miningEarningsBtc,
      'taskEarningsBtc': taskEarningsBtc,
      'referralEarningsBtc': referralEarningsBtc,
      'history': history.map((e) => e.toJson()).toList(),
      'lastUpdated': lastUpdated.toIso8601String(),
    };
  }

  factory EarningsModel.fromJson(Map<String, dynamic> json) {
    return EarningsModel(
      userId: json['userId'] as String,
      totalEarnedBtc: (json['totalEarnedBtc'] as num?)?.toDouble() ?? 0.0,
      totalEarnedUsd: (json['totalEarnedUsd'] as num?)?.toDouble() ?? 0.0,
      todayEarnedBtc: (json['todayEarnedBtc'] as num?)?.toDouble() ?? 0.0,
      todayEarnedUsd: (json['todayEarnedUsd'] as num?)?.toDouble() ?? 0.0,
      weeklyEarnedBtc: (json['weeklyEarnedBtc'] as num?)?.toDouble() ?? 0.0,
      monthlyEarnedBtc: (json['monthlyEarnedBtc'] as num?)?.toDouble() ?? 0.0,
      miningEarningsBtc: (json['miningEarningsBtc'] as num?)?.toDouble() ?? 0.0,
      taskEarningsBtc: (json['taskEarningsBtc'] as num?)?.toDouble() ?? 0.0,
      referralEarningsBtc: (json['referralEarningsBtc'] as num?)?.toDouble() ?? 0.0,
      history: (json['history'] as List?)
          ?.map((e) => EarningEntry.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      lastUpdated: DateTime.parse(json['lastUpdated'] as String),
    );
  }
}

/// Individual earning entry
class EarningEntry {
  final DateTime timestamp;
  final double amountBtc;
  final String source; // 'mining', 'task', 'referral'
  final String? description;

  EarningEntry({
    required this.timestamp,
    required this.amountBtc,
    required this.source,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'amountBtc': amountBtc,
      'source': source,
      'description': description,
    };
  }

  factory EarningEntry.fromJson(Map<String, dynamic> json) {
    return EarningEntry(
      timestamp: DateTime.parse(json['timestamp'] as String),
      amountBtc: (json['amountBtc'] as num).toDouble(),
      source: json['source'] as String,
      description: json['description'] as String?,
    );
  }
}
