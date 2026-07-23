import 'package:flutter/foundation.dart';
import '../config/constants.dart';

/// Represents a reward task the user can complete
class TaskModel {
  final String taskId;
  final String title;
  final String description;
  final TaskType type;
  final int rewardSatoshi;
  final bool isRecurring;
  final int? maxCompletionsPerDay;
  final int? estimatedDurationSeconds;
  final String? iconName;
  final bool isActive;
  final bool isCompleted;
  final DateTime? lastCompletedAt;
  final DateTime? expiresAt;
  final int completionCount;
  final double? progress; // 0.0 to 1.0 for multi-step tasks

  TaskModel({
    required this.taskId,
    required this.title,
    required this.description,
    required this.type,
    required this.rewardSatoshi,
    this.isRecurring = true,
    this.maxCompletionsPerDay,
    this.estimatedDurationSeconds,
    this.iconName,
    this.isActive = true,
    this.isCompleted = false,
    this.lastCompletedAt,
    this.expiresAt,
    this.completionCount = 0,
    this.progress,
  });

  /// Check if task can be completed today
  bool get canCompleteToday {
    if (!isActive) return false;
    if (maxCompletionsPerDay == null) return true;
    if (lastCompletedAt == null) return true;
    
    final today = DateTime.now();
    final isSameDay = lastCompletedAt!.year == today.year &&
        lastCompletedAt!.month == today.month &&
        lastCompletedAt!.day == today.day;
    
    return !isSameDay || completionCount < maxCompletionsPerDay!;
  }

  /// Get formatted reward string
  String get rewardFormatted {
    return '$rewardSatoshi sats';
  }

  /// Get formatted duration
  String get durationFormatted {
    if (estimatedDurationSeconds == null) return 'Quick';
    if (estimatedDurationSeconds! < 60) return '~${estimatedDurationSeconds}s';
    if (estimatedDurationSeconds! < 3600) return '~${estimatedDurationSeconds! ~/ 60}min';
    return '~${estimatedDurationSeconds! ~/ 3600}h';
  }

  /// Get task category label
  String get categoryLabel {
    switch (type) {
      case TaskType.dailyCheckIn:
        return 'Daily';
      case TaskType.watchAd:
        return 'Ads';
      case TaskType.completeSurvey:
        return 'Surveys';
      case TaskType.referral:
        return 'Referral';
      case TaskType.socialShare:
        return 'Social';
      case TaskType.achieveStreak:
        return 'Streak';
    }
  }

  /// Get icon data for task type
  String get taskIcon {
    switch (type) {
      case TaskType.dailyCheckIn:
        return 'calendar_check';
      case TaskType.watchAd:
        return 'play_circle';
      case TaskType.completeSurvey:
        return 'quiz';
      case TaskType.referral:
        return 'person_add';
      case TaskType.socialShare:
        return 'share';
      case TaskType.achieveStreak:
        return 'local_fire_department';
    }
  }

  TaskModel copyWith({
    String? taskId,
    String? title,
    String? description,
    TaskType? type,
    int? rewardSatoshi,
    bool? isRecurring,
    int? maxCompletionsPerDay,
    int? estimatedDurationSeconds,
    String? iconName,
    bool? isActive,
    bool? isCompleted,
    DateTime? lastCompletedAt,
    DateTime? expiresAt,
    int? completionCount,
    double? progress,
  }) {
    return TaskModel(
      taskId: taskId ?? this.taskId,
      title: title ?? this.title,
      description: description ?? this.description,
      type: type ?? this.type,
      rewardSatoshi: rewardSatoshi ?? this.rewardSatoshi,
      isRecurring: isRecurring ?? this.isRecurring,
      maxCompletionsPerDay: maxCompletionsPerDay ?? this.maxCompletionsPerDay,
      estimatedDurationSeconds: estimatedDurationSeconds ?? this.estimatedDurationSeconds,
      iconName: iconName ?? this.iconName,
      isActive: isActive ?? this.isActive,
      isCompleted: isCompleted ?? this.isCompleted,
      lastCompletedAt: lastCompletedAt ?? this.lastCompletedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      completionCount: completionCount ?? this.completionCount,
      progress: progress ?? this.progress,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'taskId': taskId,
      'title': title,
      'description': description,
      'type': type.name,
      'rewardSatoshi': rewardSatoshi,
      'isRecurring': isRecurring,
      'maxCompletionsPerDay': maxCompletionsPerDay,
      'estimatedDurationSeconds': estimatedDurationSeconds,
      'iconName': iconName,
      'isActive': isActive,
      'isCompleted': isCompleted,
      'lastCompletedAt': lastCompletedAt?.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'completionCount': completionCount,
      'progress': progress,
    };
  }

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      taskId: json['taskId'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      type: TaskType.values.firstWhere((e) => e.name == json['type']),
      rewardSatoshi: json['rewardSatoshi'] as int,
      isRecurring: json['isRecurring'] as bool? ?? true,
      maxCompletionsPerDay: json['maxCompletionsPerDay'] as int?,
      estimatedDurationSeconds: json['estimatedDurationSeconds'] as int?,
      iconName: json['iconName'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      isCompleted: json['isCompleted'] as bool? ?? false,
      lastCompletedAt: json['lastCompletedAt'] != null ? DateTime.parse(json['lastCompletedAt'] as String) : null,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      completionCount: json['completionCount'] as int? ?? 0,
      progress: (json['progress'] as num?)?.toDouble(),
    );
  }
}

/// Default tasks available in the app
class DefaultTasks {
  static List<TaskModel> get dailyTasks => [
    TaskModel(
      taskId: 'daily_checkin',
      title: 'Daily Check-in',
      description: 'Claim your daily reward by checking in!',
      type: TaskType.dailyCheckIn,
      rewardSatoshi: AppConstants.dailyCheckInReward,
      isRecurring: true,
      maxCompletionsPerDay: 1,
      estimatedDurationSeconds: 5,
    ),
    TaskModel(
      taskId: 'watch_ad',
      title: 'Watch Ad',
      description: 'Watch a short video ad to earn sats',
      type: TaskType.watchAd,
      rewardSatoshi: AppConstants.adWatchReward,
      isRecurring: true,
      maxCompletionsPerDay: AppConstants.maxDailyAds,
      estimatedDurationSeconds: 30,
    ),
    TaskModel(
      taskId: 'survey_basic',
      title: 'Quick Survey',
      description: 'Answer a short survey about your preferences',
      type: TaskType.completeSurvey,
      rewardSatoshi: AppConstants.surveyReward,
      isRecurring: true,
      maxCompletionsPerDay: 3,
      estimatedDurationSeconds: 120,
    ),
    TaskModel(
      taskId: 'refer_friend',
      title: 'Invite a Friend',
      description: 'Share your referral code and earn bonus sats',
      type: TaskType.referral,
      rewardSatoshi: AppConstants.referralBonus,
      isRecurring: true,
      estimatedDurationSeconds: 30,
    ),
    TaskModel(
      taskId: 'social_share',
      title: 'Share on Social',
      description: 'Share VesperMine on your social media',
      type: TaskType.socialShare,
      rewardSatoshi: 150,
      isRecurring: true,
      maxCompletionsPerDay: 1,
      estimatedDurationSeconds: 30,
    ),
  ];

  static List<TaskModel> get streakTasks => [
    TaskModel(
      taskId: 'streak_3',
      title: '3-Day Streak',
      description: 'Check in for 3 consecutive days',
      type: TaskType.achieveStreak,
      rewardSatoshi: 300,
      isRecurring: false,
      estimatedDurationSeconds: 0,
    ),
    TaskModel(
      taskId: 'streak_7',
      title: '7-Day Streak',
      description: 'Check in for 7 consecutive days for bonus!',
      type: TaskType.achieveStreak,
      rewardSatoshi: 1000,
      isRecurring: false,
      estimatedDurationSeconds: 0,
    ),
    TaskModel(
      taskId: 'streak_30',
      title: '30-Day Champion',
      description: 'Check in every day for a month!',
      type: TaskType.achieveStreak,
      rewardSatoshi: 5000,
      isRecurring: false,
      estimatedDurationSeconds: 0,
    ),
  ];
}
