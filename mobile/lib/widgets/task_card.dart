import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/task.dart';
import '../theme/app_theme.dart';

class TaskCard extends StatelessWidget {
  final Task task;
  final ValueChanged<bool?> onToggle;
  final ValueChanged<String>? onMoveQuadrant;
  final VoidCallback? onDelete;

  const TaskCard({
    super.key,
    required this.task,
    required this.onToggle,
    this.onMoveQuadrant,
    this.onDelete,
  });

  Color _getQuadrantColor(String? q) {
    switch (q) {
      case 'DO_FIRST':
        return AppColors.danger;
      case 'SCHEDULE':
        return AppColors.schedule;
      case 'DELEGATE':
        return AppColors.delegate;
      case 'ELIMINATE':
        return AppColors.eliminate;
      default:
        return AppColors.textMuted;
    }
  }

  String _getQuadrantLabel(String? q) {
    switch (q) {
      case 'DO_FIRST':
        return 'Do First';
      case 'SCHEDULE':
        return 'Schedule';
      case 'DELEGATE':
        return 'Delegate';
      case 'ELIMINATE':
        return 'Eliminate';
      default:
        return 'Inbox';
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isDone = task.isCompleted;
    final quadrantColor = _getQuadrantColor(task.eisenhowerQuadrant);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: isDone ? AppColors.backgroundSecondary : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDone ? AppColors.border.withValues(alpha: 0.5) : AppColors.border,
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Minimalist Custom Checkbox
                InkWell(
                  onTap: () => onToggle(!isDone),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    width: 20,
                    height: 20,
                    margin: const EdgeInsets.only(top: 2, right: 10),
                    decoration: BoxDecoration(
                      color: isDone ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(
                        color: isDone ? AppColors.primary : AppColors.textMuted,
                        width: 1.5,
                      ),
                    ),
                    child: isDone
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : null,
                  ),
                ),
                // Title & Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          color: isDone ? AppColors.textMuted : AppColors.heading,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          decoration: isDone ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      if (task.description != null && task.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          task.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: isDone ? AppColors.textMuted : AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // Overflow Menu
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_horiz, size: 18, color: AppColors.textMuted),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'DO_FIRST',
                      child: Text('Move to: Do First (Q1)', style: TextStyle(fontSize: 13)),
                    ),
                    const PopupMenuItem(
                      value: 'SCHEDULE',
                      child: Text('Move to: Schedule (Q2)', style: TextStyle(fontSize: 13)),
                    ),
                    const PopupMenuItem(
                      value: 'DELEGATE',
                      child: Text('Move to: Delegate (Q3)', style: TextStyle(fontSize: 13)),
                    ),
                    const PopupMenuItem(
                      value: 'ELIMINATE',
                      child: Text('Move to: Eliminate (Q4)', style: TextStyle(fontSize: 13)),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'DELETE',
                      child: Text('Delete Task', style: TextStyle(color: AppColors.danger, fontSize: 13)),
                    ),
                  ],
                  onSelected: (val) {
                    if (val == 'DELETE') {
                      onDelete?.call();
                    } else if (onMoveQuadrant != null) {
                      onMoveQuadrant!(val);
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Badges row
            Wrap(
              spacing: 6,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Quadrant Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: quadrantColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: quadrantColor.withValues(alpha: 0.3), width: 0.8),
                  ),
                  child: Text(
                    _getQuadrantLabel(task.eisenhowerQuadrant),
                    style: TextStyle(
                      color: quadrantColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                // Due Date Badge
                if (task.dueAt != null) ...[
                  Builder(builder: (context) {
                    DateTime? dt;
                    try {
                      dt = DateTime.parse(task.dueAt!);
                    } catch (_) {}
                    final formatted = dt != null ? DateFormat('MMM d, h:mm a').format(dt) : task.dueAt!;
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primarySubtle,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.schedule, size: 10, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            formatted,
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
                // AI Badge
                if (task.aiAnalysis != null) ...[
                  InkWell(
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          backgroundColor: AppColors.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.border),
                          ),
                          title: const Row(
                            children: [
                              Icon(Icons.auto_awesome, size: 18, color: AppColors.accent),
                              SizedBox(width: 8),
                              Text('AI Matrix Classification', style: TextStyle(fontSize: 16, color: AppColors.heading)),
                            ],
                          ),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Model: ${task.aiAnalysis!.model}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                              const SizedBox(height: 8),
                              Text(task.aiAnalysis!.reasoning, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ],
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx),
                              child: const Text('Close', style: TextStyle(color: AppColors.primary)),
                            ),
                          ],
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.accentLight,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.accent.withValues(alpha: 0.3), width: 0.8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.auto_awesome, size: 10, color: AppColors.accent),
                          SizedBox(width: 3),
                          Text(
                            'AI Analyzed',
                            style: TextStyle(
                              color: AppColors.accent,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
