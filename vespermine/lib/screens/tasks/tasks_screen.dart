import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../services/task_service.dart';
import '../../services/wallet_service.dart';
import '../../services/earnings_service.dart';
import '../../widgets/task_card.dart';
import '../../models/task.dart';

class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _completingTaskId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _completeTask(String taskId, int rewardSatoshi) async {
    setState(() => _completingTaskId = taskId);

    final reward = await ref.read(taskStateProvider.notifier).completeTask(taskId);
    if (reward != null) {
      // Convert satoshi to BTC
      final btcReward = reward / 1e8;
      ref.read(walletStateProvider.notifier).addEarnings(btcReward);
      ref.read(earningsStateProvider.notifier).addTaskEarning(btcReward, 'Task completed');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('+${reward} sats earned! 🎉'),
            backgroundColor: VesperTheme.neonGreen,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }

    setState(() => _completingTaskId = null);
  }

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(taskStateProvider);
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    final dailyTasks = taskState.tasks.where((t) => 
      t.type != TaskType.achieveStreak && t.isActive
    ).toList();
    final streakTasks = taskState.tasks.where((t) => 
      t.type == TaskType.achieveStreak && t.isActive
    ).toList();

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: VesperTheme.miningGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Earn More',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: VesperTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${taskState.totalAvailableSatoshi} sats available today',
                      style: const TextStyle(color: VesperTheme.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Streak Banner
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      VesperTheme.neonOrange.withAlpha(30),
                      VesperTheme.neonGold.withAlpha(20),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                  border: Border.all(color: VesperTheme.neonGold.withAlpha(40)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: VesperTheme.neonGold.withAlpha(26),
                        borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                      ),
                      child: const Icon(Icons.local_fire_department, color: VesperTheme.neonGold, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${user?.currentStreak ?? 0}-Day Streak 🔥',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: VesperTheme.neonGold,
                            ),
                          ),
                          Text(
                            'Keep checking in daily for bonus rewards!',
                            style: const TextStyle(color: VesperTheme.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Tabs
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: VesperTheme.bgCard,
                  borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: VesperTheme.neonCyan.withAlpha(20),
                    borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelColor: VesperTheme.neonCyan,
                  unselectedLabelColor: VesperTheme.textMuted,
                  tabs: const [
                    Tab(text: 'Daily'),
                    Tab(text: 'Streak'),
                    Tab(text: 'All'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Task List
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Daily Tasks
                    _buildTaskList(dailyTasks),
                    // Streak Tasks
                    _buildTaskList(streakTasks),
                    // All Tasks
                    _buildTaskList(taskState.tasks.where((t) => t.isActive).toList()),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTaskList(List<TaskModel> tasks) {
    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.task_alt, size: 64, color: VesperTheme.textMuted),
            const SizedBox(height: 16),
            Text(
              'No tasks available',
              style: TextStyle(color: VesperTheme.textSecondary, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        final task = tasks[index];
        final isCompleted = task.isCompleted || !task.canCompleteToday;
        final isCompleting = _completingTaskId == task.taskId;

        return TaskCard(
          task: task,
          isCompleted: isCompleted,
          onTap: isCompleting
              ? null
              : () => _completeTask(task.taskId, task.rewardSatoshi),
        );
      },
    );
  }
}
