import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/task.dart';
import '../config/constants.dart';

/// Task service manages available tasks and completion tracking
class TaskService {
  List<TaskModel> _availableTasks = [];
  Map<String, TaskModel> _completedTasks = {};

  List<TaskModel> get availableTasks => _availableTasks;

  /// Initialize tasks
  void initialize() {
    _availableTasks = [
      ...DefaultTasks.dailyTasks,
      ...DefaultTasks.streakTasks,
    ];
  }

  /// Get available tasks filtered by category
  List<TaskModel> getTasksByType(TaskType type) {
    return _availableTasks.where((t) => t.type == type && t.isActive).toList();
  }

  /// Get all completable tasks for today
  List<TaskModel> getTodaysTasks() {
    return _availableTasks.where((t) => t.isActive && t.canCompleteToday).toList();
  }

  /// Complete a task and return reward
  TaskModel? completeTask(String taskId) {
    final index = _availableTasks.indexWhere((t) => t.taskId == taskId);
    if (index == -1) return null;

    final task = _availableTasks[index];
    if (!task.canCompleteToday) return null;

    // Mark task as completed
    final completedTask = task.copyWith(
      isCompleted: true,
      lastCompletedAt: DateTime.now(),
      completionCount: task.completionCount + 1,
    );

    _availableTasks[index] = completedTask;
    _completedTasks[taskId] = completedTask;

    return completedTask;
  }

  /// Check if a streak task can be claimed
  bool canClaimStreakReward(int currentStreak) {
    if (currentStreak >= 3 && !(_completedTasks['streak_3']?.isCompleted ?? false)) {
      return true;
    }
    if (currentStreak >= 7 && !(_completedTasks['streak_7']?.isCompleted ?? false)) {
      return true;
    }
    if (currentStreak >= 30 && !(_completedTasks['streak_30']?.isCompleted ?? false)) {
      return true;
    }
    return false;
  }

  /// Get total available satoshi for today
  int getTotalAvailableSatoshi() {
    return getTodaysTasks().fold(0, (sum, task) {
      final completionsLeft = task.maxCompletionsPerDay != null
          ? task.maxCompletionsPerDay! - task.completionCount
          : 1;
      return sum + (task.rewardSatoshi * completionsLeft);
    });
  }

  /// Reset daily tasks (called at midnight)
  void resetDailyTasks() {
    for (var i = 0; i < _availableTasks.length; i++) {
      final task = _availableTasks[i];
      if (task.isRecurring) {
        _availableTasks[i] = task.copyWith(
          isCompleted: false,
          completionCount: 0,
        );
      }
    }
  }
}

/// Task state
class TaskState {
  final List<TaskModel> tasks;
  final int totalAvailableSatoshi;
  final int completedToday;
  final bool isLoading;

  TaskState({
    this.tasks = const [],
    this.totalAvailableSatoshi = 0,
    this.completedToday = 0,
    this.isLoading = false,
  });

  TaskState copyWith({
    List<TaskModel>? tasks,
    int? totalAvailableSatoshi,
    int? completedToday,
    bool? isLoading,
  }) {
    return TaskState(
      tasks: tasks ?? this.tasks,
      totalAvailableSatoshi: totalAvailableSatoshi ?? this.totalAvailableSatoshi,
      completedToday: completedToday ?? this.completedToday,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

/// Task state notifier
class TaskNotifier extends StateNotifier<TaskState> {
  final TaskService _taskService;

  TaskNotifier(this._taskService) : super(TaskState()) {
    _init();
  }

  void _init() {
    _taskService.initialize();
    _refreshState();
  }

  void _refreshState() {
    state = state.copyWith(
      tasks: _taskService.availableTasks,
      totalAvailableSatoshi: _taskService.getTotalAvailableSatoshi(),
    );
  }

  Future<int?> completeTask(String taskId) async {
    // Simulate task completion delay
    await Future.delayed(const Duration(seconds: 1));

    final task = _taskService.completeTask(taskId);
    if (task != null) {
      _refreshState();
      return task.rewardSatoshi;
    }
    return null;
  }

  void resetDailyTasks() {
    _taskService.resetDailyTasks();
    _refreshState();
  }
}

// Providers
final taskServiceProvider = Provider<TaskService>((ref) => TaskService());
final taskStateProvider = StateNotifierProvider<TaskNotifier, TaskState>((ref) {
  return TaskNotifier(ref.watch(taskServiceProvider));
});
