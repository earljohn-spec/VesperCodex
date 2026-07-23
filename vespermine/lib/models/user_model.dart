import 'package:flutter/foundation.dart';

/// User model representing a VesperMine user
class UserModel {
  final String uid;
  final String email;
  final String displayName;
  final String? avatarUrl;
  final String referralCode;
  final String? referredBy;
  final DateTime createdAt;
  final DateTime lastActiveAt;
  final bool emailVerified;
  final bool biometricEnabled;

  // Stats
  final double totalEarned; // BTC
  final double currentBalance; // BTC
  final int currentStreak;
  final String subscriptionTier; // 'free', 'starter', 'pro', 'elite'
  final int totalReferrals;
  final int totalTasksCompleted;
  final int miningHoursTotal;

  UserModel({
    required this.uid,
    required this.email,
    required this.displayName,
    this.avatarUrl,
    required this.referralCode,
    this.referredBy,
    required this.createdAt,
    required this.lastActiveAt,
    this.emailVerified = false,
    this.biometricEnabled = false,
    this.totalEarned = 0.0,
    this.currentBalance = 0.0,
    this.currentStreak = 0,
    this.subscriptionTier = 'free',
    this.totalReferrals = 0,
    this.totalTasksCompleted = 0,
    this.miningHoursTotal = 0,
  });

  UserModel copyWith({
    String? uid,
    String? email,
    String? displayName,
    String? avatarUrl,
    String? referralCode,
    String? referredBy,
    DateTime? createdAt,
    DateTime? lastActiveAt,
    bool? emailVerified,
    bool? biometricEnabled,
    double? totalEarned,
    double? currentBalance,
    int? currentStreak,
    String? subscriptionTier,
    int? totalReferrals,
    int? totalTasksCompleted,
    int? miningHoursTotal,
  }) {
    return UserModel(
      uid: uid ?? this.uid,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      referralCode: referralCode ?? this.referralCode,
      referredBy: referredBy ?? this.referredBy,
      createdAt: createdAt ?? this.createdAt,
      lastActiveAt: lastActiveAt ?? this.lastActiveAt,
      emailVerified: emailVerified ?? this.emailVerified,
      biometricEnabled: biometricEnabled ?? this.biometricEnabled,
      totalEarned: totalEarned ?? this.totalEarned,
      currentBalance: currentBalance ?? this.currentBalance,
      currentStreak: currentStreak ?? this.currentStreak,
      subscriptionTier: subscriptionTier ?? this.subscriptionTier,
      totalReferrals: totalReferrals ?? this.totalReferrals,
      totalTasksCompleted: totalTasksCompleted ?? this.totalTasksCompleted,
      miningHoursTotal: miningHoursTotal ?? this.miningHoursTotal,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'uid': uid,
      'email': email,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'referralCode': referralCode,
      'referredBy': referredBy,
      'createdAt': createdAt.toIso8601String(),
      'lastActiveAt': lastActiveAt.toIso8601String(),
      'emailVerified': emailVerified,
      'biometricEnabled': biometricEnabled,
      'totalEarned': totalEarned,
      'currentBalance': currentBalance,
      'currentStreak': currentStreak,
      'subscriptionTier': subscriptionTier,
      'totalReferrals': totalReferrals,
      'totalTasksCompleted': totalTasksCompleted,
      'miningHoursTotal': miningHoursTotal,
    };
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      uid: json['uid'] as String,
      email: json['email'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      referralCode: json['referralCode'] as String,
      referredBy: json['referredBy'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastActiveAt: DateTime.parse(json['lastActiveAt'] as String),
      emailVerified: json['emailVerified'] as bool? ?? false,
      biometricEnabled: json['biometricEnabled'] as bool? ?? false,
      totalEarned: (json['totalEarned'] as num?)?.toDouble() ?? 0.0,
      currentBalance: (json['currentBalance'] as num?)?.toDouble() ?? 0.0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      subscriptionTier: json['subscriptionTier'] as String? ?? 'free',
      totalReferrals: json['totalReferrals'] as int? ?? 0,
      totalTasksCompleted: json['totalTasksCompleted'] as int? ?? 0,
      miningHoursTotal: json['miningHoursTotal'] as int? ?? 0,
    );
  }

  /// Generate a referral code from user data
  static String generateReferralCode(String uid) {
    final code = uid.substring(0, uid.length > 6 ? 6 : uid.length).toUpperCase();
    return 'VM$code';
  }
}
