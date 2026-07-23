import 'package:flutter/material.dart';
import '../models/task.dart';
import '../config/theme.dart';
import '../config/constants.dart';

/// Task card widget for displaying available tasks
class TaskCard extends StatelessWidget {
  final TaskModel task;
  final VoidCallback? onTap;
  final bool isCompleted;

  const TaskCard({
    super.key,
    required this.task,
    this.onTap,
    this.isCompleted = false,
  });

  IconData _getTaskIcon() {
    switch (task.type) {
      case TaskType.dailyCheckIn:
        return Icons.calendar_today_rounded;
      case TaskType.watchAd:
        return Icons.play_circle_outline_rounded;
      case TaskType.completeSurvey:
        return Icons.quiz_outlined;
      case TaskType.referral:
        return Icons.person_add_alt_1_rounded;
      case TaskType.socialShare:
        return Icons.share_rounded;
      case TaskType.achieveStreak:
        return Icons.local_fire_department_rounded;
    }
  }

  Color _getTaskColor() {
    switch (task.type) {
      case TaskType.dailyCheckIn:
        return VesperTheme.neonCyan;
      case TaskType.watchAd:
        return VesperTheme.neonPurple;
      case TaskType.completeSurvey:
        return VesperTheme.neonOrange;
      case TaskType.referral:
        return VesperTheme.neonGreen;
      case TaskType.socialShare:
        return Colors.blue;
      case TaskType.achieveStreak:
        return VesperTheme.neonGold;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getTaskColor();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isCompleted ? null : onTap,
          borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: VesperTheme.bgCard,
              borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
              border: Border.all(
                color: isCompleted
                    ? VesperTheme.neonGreen.withAlpha(40)
                    : color.withAlpha(20),
                width: 1,
              ),
            ),
            child: Row(
              children: [
                // Icon
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withAlpha(26),
                    borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                  ),
                  child: Icon(
                    _getTaskIcon(),
                    color: color,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: isCompleted
                              ? VesperTheme.textMuted
                              : VesperTheme.textPrimary,
                          decoration: isCompleted ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        task.description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: VesperTheme.textMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _buildChip(task.durationFormatted, Colors.grey),
                          const SizedBox(width: 8),
                          if (task.maxCompletionsPerDay != null)
                            _buildChip(
                              '${task.completionCount}/${task.maxCompletionsPerDay}',
                              color,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Reward
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? VesperTheme.neonGreen.withAlpha(26)
                            : color.withAlpha(26),
                        borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                      ),
                      child: Text(
                        '+${task.rewardSatoshi}',
                        style: TextStyle(
                          color: isCompleted ? VesperTheme.neonGreen : color,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'sats',
                      style: TextStyle(
                        fontSize: 10,
                        color: isCompleted ? VesperTheme.neonGreen : VesperTheme.textMuted,
                      ),
                    ),
                  ],
                ),

                // Arrow or checkmark
                if (!isCompleted) ...[
                  const SizedBox(width: 8),
                  Icon(Icons.arrow_forward_ios, color: color, size: 14),
                ] else ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.check_circle, color: VesperTheme.neonGreen, size: 20),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(13),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
