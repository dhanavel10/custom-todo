import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/task_card.dart';

class DayPlannerScreen extends StatefulWidget {
  const DayPlannerScreen({super.key});

  @override
  State<DayPlannerScreen> createState() => DayPlannerScreenState();
}

class DayPlannerScreenState extends State<DayPlannerScreen> {
  DateTime _selectedDate = DateTime.now();
  List<Task> _allTasks = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() => _isLoading = true);
    try {
      final tasks = await ApiService().fetchTasks();
      if (mounted) {
        setState(() {
          _allTasks = tasks;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  List<Task> _getTasksForDate(DateTime date) {
    return _allTasks.where((t) {
      if (t.dueAt == null) {
        // If no dueAt, and selected date is today, show inbox/todo items
        if (_isSameDay(date, DateTime.now())) {
          return true;
        }
        return false;
      }
      try {
        final d = DateTime.parse(t.dueAt!);
        return _isSameDay(d, date);
      } catch (_) {
        return false;
      }
    }).toList();
  }

  void _showAddForDay() {
    final titleCtrl = TextEditingController();
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        title: Text(
          'Add Task for ${DateFormat('EEE, MMM d').format(_selectedDate)}',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.heading),
        ),
        content: TextField(
          controller: titleCtrl,
          autofocus: true,
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          decoration: const InputDecoration(
            hintText: 'What needs to get done?',
            hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          onSubmitted: (val) async {
            if (val.trim().isNotEmpty) {
              Navigator.pop(ctx);
              await ApiService().createTask(
                title: val.trim(),
                dueAt: '${dateStr}T12:00:00Z',
              );
              refresh();
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
          ElevatedButton(
            onPressed: () async {
              final val = titleCtrl.text.trim();
              if (val.isNotEmpty) {
                Navigator.pop(ctx);
                await ApiService().createTask(
                  title: val,
                  dueAt: '${dateStr}T12:00:00Z',
                );
                refresh();
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Schedule', style: TextStyle(color: Colors.white, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    // 7-day ribbon starting from today
    final days = List.generate(7, (i) => now.add(Duration(days: i)));
    final dayTasks = _getTasksForDate(_selectedDate);
    final completedCount = dayTasks.where((t) => t.isCompleted).length;
    final totalCount = dayTasks.length;
    final progress = totalCount > 0 ? (completedCount / totalCount) : 0.0;

    // Filter into time blocks
    final morningTasks = <Task>[];
    final afternoonTasks = <Task>[];
    final eveningOrAnytimeTasks = <Task>[];

    for (final t in dayTasks) {
      if (t.dueAt != null) {
        try {
          final dt = DateTime.parse(t.dueAt!);
          if (dt.hour < 12) {
            morningTasks.add(t);
            continue;
          } else if (dt.hour < 17) {
            afternoonTasks.add(t);
            continue;
          }
        } catch (_) {}
      }
      eveningOrAnytimeTasks.add(t);
    }

    return Column(
      children: [
        // 7-Day Ribbon
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: SizedBox(
            height: 66,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              itemCount: days.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, idx) {
                final day = days[idx];
                final isSelected = _isSameDay(day, _selectedDate);
                final isToday = _isSameDay(day, now);
                final count = _getTasksForDate(day).where((t) => !t.isCompleted).length;

                return InkWell(
                  onTap: () => setState(() => _selectedDate = day),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 52,
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : (isToday ? AppColors.accent : AppColors.border),
                        width: isSelected || isToday ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          isToday ? 'Today' : DateFormat('E').format(day),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? Colors.white70 : AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('d').format(day),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: isSelected ? Colors.white : AppColors.heading,
                          ),
                        ),
                        if (count > 0) ...[
                          const SizedBox(height: 2),
                          Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected ? Colors.white : AppColors.accent,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),

        const Divider(height: 1, color: AppColors.border),

        // Selected Day Progress Banner
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    DateFormat('EEEE, MMMM d').format(_selectedDate),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.heading,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    totalCount == 0 ? 'No tasks' : '$completedCount of $totalCount done',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
              if (totalCount > 0) ...[
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 5,
                    backgroundColor: AppColors.backgroundTertiary,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                ),
              ],
            ],
          ),
        ),

        // Day Task List
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              : RefreshIndicator(
                  onRefresh: refresh,
                  color: AppColors.primary,
                  child: dayTasks.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.calendar_today_outlined, size: 36, color: AppColors.textMuted.withValues(alpha: 0.4)),
                              const SizedBox(height: 8),
                              const Text('No tasks planned for this day', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: _showAddForDay,
                                icon: const Icon(Icons.add, size: 14, color: AppColors.primary),
                                label: const Text('Add Task', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: AppColors.border),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 80),
                          children: [
                            if (morningTasks.isNotEmpty) ...[
                              _buildSectionHeader('Morning', Icons.wb_sunny_outlined, morningTasks.length),
                              ...morningTasks.map((t) => TaskCard(
                                    task: t,
                                    onToggle: (done) async {
                                      await ApiService().toggleTaskComplete(t.id, done == true);
                                      refresh();
                                    },
                                    onMoveQuadrant: (q) async {
                                      await ApiService().moveTaskQuadrant(t.id, q);
                                      refresh();
                                    },
                                    onDelete: () async {
                                      await ApiService().deleteTask(t.id);
                                      refresh();
                                    },
                                  )),
                              const SizedBox(height: 12),
                            ],
                            if (afternoonTasks.isNotEmpty) ...[
                              _buildSectionHeader('Afternoon', Icons.wb_twilight, afternoonTasks.length),
                              ...afternoonTasks.map((t) => TaskCard(
                                    task: t,
                                    onToggle: (done) async {
                                      await ApiService().toggleTaskComplete(t.id, done == true);
                                      refresh();
                                    },
                                    onMoveQuadrant: (q) async {
                                      await ApiService().moveTaskQuadrant(t.id, q);
                                      refresh();
                                    },
                                    onDelete: () async {
                                      await ApiService().deleteTask(t.id);
                                      refresh();
                                    },
                                  )),
                              const SizedBox(height: 12),
                            ],
                            if (eveningOrAnytimeTasks.isNotEmpty) ...[
                              _buildSectionHeader(
                                morningTasks.isEmpty && afternoonTasks.isEmpty ? 'Scheduled Tasks' : 'Evening & Any Time',
                                Icons.nightlight_round,
                                eveningOrAnytimeTasks.length,
                              ),
                              ...eveningOrAnytimeTasks.map((t) => TaskCard(
                                    task: t,
                                    onToggle: (done) async {
                                      await ApiService().toggleTaskComplete(t.id, done == true);
                                      refresh();
                                    },
                                    onMoveQuadrant: (q) async {
                                      await ApiService().moveTaskQuadrant(t.id, q);
                                      refresh();
                                    },
                                    onDelete: () async {
                                      await ApiService().deleteTask(t.id);
                                      refresh();
                                    },
                                  )),
                            ],
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: _showAddForDay,
                              icon: const Icon(Icons.add, size: 14, color: AppColors.primary),
                              label: const Text('Add Task for this Day', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: AppColors.surface,
                                side: const BorderSide(color: AppColors.border),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                            ),
                          ],
                        ),
                ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, int count) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.heading,
              letterSpacing: -0.1,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: AppColors.backgroundTertiary,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$count',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
