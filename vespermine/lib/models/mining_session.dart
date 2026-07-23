import 'package:flutter/foundation.dart';
import '../config/constants.dart';

/// Represents an active or completed mining session
class MiningSession {
  final String sessionId;
  final String userId;
  final DateTime startTime;
  final DateTime? endTime;
  final double hashRate; // MH/s
  final MiningStatus status;
  final double btcEarned;
  final int sharesCompleted;
  final double powerConsumption; // simulated watts
  final String tierName;

  MiningSession({
    required this.sessionId,
    required this.userId,
    required this.startTime,
    this.endTime,
    required this.hashRate,
    this.status = MiningStatus.active,
    this.btcEarned = 0.0,
    this.sharesCompleted = 0,
    this.powerConsumption = 0.0,
    this.tierName = 'free',
  });

  /// Calculate current earnings based on hash rate and elapsed time
  double calculateCurrentEarnings() {
    if (status != MiningStatus.active) return btcEarned;
    
    final elapsed = DateTime.now().difference(startTime).inSeconds;
    // Simulate: hashRate * time * satoshiPerHash
    // Real implementation would use actual difficulty and pool data
    final hashes = hashRate * 1e6 * elapsed; // Convert MH to H
    return hashes * AppConstants.satoshiPerHash;
  }

  /// Get uptime duration
  Duration get uptime {
    final end = endTime ?? DateTime.now();
    return end.difference(startTime);
  }

  /// Get formatted uptime string
  String get formattedUptime {
    final duration = uptime;
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    final seconds = duration.inSeconds % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  /// Check if session should be in cooldown (max 24h sessions)
  bool get needsCooldown {
    return uptime.inHours >= AppConstants.miningCycleDuration.round();
  }

  MiningSession copyWith({
    String? sessionId,
    String? userId,
    DateTime? startTime,
    DateTime? endTime,
    double? hashRate,
    MiningStatus? status,
    double? btcEarned,
    int? sharesCompleted,
    double? powerConsumption,
    String? tierName,
  }) {
    return MiningSession(
      sessionId: sessionId ?? this.sessionId,
      userId: userId ?? this.userId,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      hashRate: hashRate ?? this.hashRate,
      status: status ?? this.status,
      btcEarned: btcEarned ?? this.btcEarned,
      sharesCompleted: sharesCompleted ?? this.sharesCompleted,
      powerConsumption: powerConsumption ?? this.powerConsumption,
      tierName: tierName ?? this.tierName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'userId': userId,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'hashRate': hashRate,
      'status': status.name,
      'btcEarned': btcEarned,
      'sharesCompleted': sharesCompleted,
      'powerConsumption': powerConsumption,
      'tierName': tierName,
    };
  }

  factory MiningSession.fromJson(Map<String, dynamic> json) {
    return MiningSession(
      sessionId: json['sessionId'] as String,
      userId: json['userId'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null ? DateTime.parse(json['endTime'] as String) : null,
      hashRate: (json['hashRate'] as num).toDouble(),
      status: MiningStatus.values.firstWhere((e) => e.name == json['status'], orElse: () => MiningStatus.active),
      btcEarned: (json['btcEarned'] as num?)?.toDouble() ?? 0.0,
      sharesCompleted: json['sharesCompleted'] as int? ?? 0,
      powerConsumption: (json['powerConsumption'] as num?)?.toDouble() ?? 0.0,
      tierName: json['tierName'] as String? ?? 'free',
    );
  }
}
