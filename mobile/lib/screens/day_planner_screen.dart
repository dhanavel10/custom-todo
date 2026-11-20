import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../theme/quadrants.dart';
import '../widgets/quick_add_sheet.dart';
import '../widgets/task_card.dart';
import '../widgets/ui.dart';

class DayPlannerScreen extends StatefulWidget {
  const DayPlannerScreen({super.key});

  @override
  State<DayPlannerScreen> createState() => DayPlannerScreenState();
}

class DayPlannerScreenState extends State<DayPlannerScreen> {
  DateTime _selectedDate = DateTime.now();
  List<Task> _allTasks = [];
  bool _isLoading = true;
  bool _dragging = false;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    if (_allTasks.isEmpty) setState(() => _isLoading = true);
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

  bool _isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  List<Task> _getTasksForDate(DateTime date) {
    return _allTasks.where((t) {
      if (t.status == 'ARCHIVED') return false;
      if (t.dueAt == null) {
        // Undated tasks surface on today (as "Anytime"), matching the previous behaviour
        return _isSameDay(date, DateTime.now());
      }
      final d = parseDate(t.dueAt);
      return d != null && _isSameDay(d, date);
    }).toList();
  }

  void _showAddForDay() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final isToday = _isSameDay(_selectedDate, DateTime.now());
    showQuickAddSheet(
      context,
      title: isToday ? 'Add to today' : 'Add to ${DateFormat('EEE, MMM d').format(_selectedDate)}',
      subtitle: 'Scheduled for this day',
      icon: Icons.event_available_rounded,
      color: context.palette.primary,
      hint: 'What needs to get done?',
      onSubmit: (title) async {
        await ApiService().createTask(title: title, dueAt: '${dateStr}T12:00:00Z');
        refresh();
      },
    );
  }

  Future<void> _moveToDay(Task task, DateTime day) async {
    final cur = parseDate(task.dueAt);
    final target = DateTime(day.year, day.month, day.day, cur?.hour ?? 12, cur?.minute ?? 0);
    HapticFeedback.mediumImpact();
    await ApiService().updateTaskDueAt(task.id, target);
    if (mounted) showToast(context, 'Moved to ${DateFormat('EEE, MMM d').format(target)}', icon: Icons.event_repeat_rounded, color: context.palette.primary);
    refresh();
  }

  Future<void> _reschedule(Task task, DateTime? to) async {
    await ApiService().updateTaskDueAt(task.id, to);
    if (mounted) showToast(context, to == null ? 'Date removed' : 'Rescheduled to ${formatDue(to)}', icon: Icons.event_repeat_rounded, color: context.palette.primary);
    refresh();
  }

  Widget _card(Task t, String? time) {
    final card = TaskCard(
      task: t,
      timeLabel: time,
      longPressOpensDetails: false,
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
      onReschedule: (d) => _reschedule(t, d),
    );
    if (t.isCompleted) return card;
    return LongPressDraggable<Task>(
      data: t,
      hapticFeedbackOnStart: true,
      onDragStarted: () => setState(() => _dragging = true),
      onDragEnd: (_) => setState(() => _dragging = false),
      feedback: _DragFeedback(task: t),
      childWhenDragging: Opacity(opacity: 0.35, child: card),
      child: card,
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final now = DateTime.now();
    final days = List.generate(7, (i) => DateTime(now.year, now.month, now.day).add(Duration(days: i)));
    final dayTasks = _getTasksForDate(_selectedDate);
    final completedCount = dayTasks.where((t) => t.isCompleted).length;
    final totalCount = dayTasks.length;
    final progress = totalCount > 0 ? completedCount / totalCount : 0.0;

    final groups = <String, List<Task>>{'Morning': [], 'Afternoon': [], 'Evening': [], 'Anytime': []};
    for (final t in dayTasks) {
      final d = parseDate(t.dueAt);
      if (d == null) {
        groups['Anytime']!.add(t);
      } else if (d.hour < 12) {
        groups['Morning']!.add(t);
      } else if (d.hour < 17) {
        groups['Afternoon']!.add(t);
      } else {
        groups['Evening']!.add(t);
      }
    }
    for (final g in groups.values) {
      g.sort((a, b) => (parseDate(a.dueAt) ?? DateTime(2100)).compareTo(parseDate(b.dueAt) ?? DateTime(2100)));
    }
    const groupIcons = {'Morning': Icons.wb_sunny_outlined, 'Afternoon': Icons.wb_twilight_rounded, 'Evening': Icons.nights_stay_outlined, 'Anytime': Icons.all_inclusive_rounded};

    return Column(children: [
      // 7-day ribbon — also a drop target for rescheduling
      SizedBox(
        height: 84,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          itemCount: days.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (context, idx) {
            final day = days[idx];
            final count = _getTasksForDate(day).where((t) => !t.isCompleted).length;
            return DragTarget<Task>(
              onWillAcceptWithDetails: (d) => !_isSameDay(parseDate(d.data.dueAt) ?? DateTime(1900), day),
              onAcceptWithDetails: (d) => _moveToDay(d.data, day),
              builder: (context, cand, _) => _DayPill(
                day: day,
                isToday: _isSameDay(day, now),
                selected: _isSameDay(day, _selectedDate),
                count: count,
                hovering: cand.isNotEmpty,
                dragging: _dragging,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedDate = day);
                },
              ),
            );
          },
        ),
      ),

      // Selected day summary
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
        child: Row(children: [
          Expanded(
            child: AnimatedSwitcher(
              duration: Motion.base,
              child: Column(key: ValueKey(_selectedDate.day), crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_isSameDay(_selectedDate, now) ? 'Today' : DateFormat('EEEE').format(_selectedDate), style: AppType.display(p.text).copyWith(fontSize: 26)),
                Text(
                  '${DateFormat('MMMM d').format(_selectedDate)} · ${totalCount == 0 ? 'nothing planned' : '$completedCount of $totalCount done'}',
                  style: AppType.caption(p.text2),
                ),
              ]),
            ),
          ),
          ProgressRing(
            value: progress,
            size: 54,
            stroke: 5.5,
            color: progress == 1 ? p.green : p.primary,
            center: Text('${(progress * 100).round()}%', style: AppType.number(p.text, size: 13)),
          ),
        ]),
      ),

      AnimatedSize(
        duration: Motion.base,
        child: _dragging
            ? Container(
                margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(Radii.md)),
                child: Row(children: [
                  Icon(Icons.pan_tool_alt_rounded, size: 16, color: p.primaryText),
                  const SizedBox(width: 8),
                  Text('Drop on a day above to reschedule', style: AppType.caption(p.primaryText).copyWith(fontWeight: FontWeight.w600)),
                ]),
              )
            : const SizedBox(width: double.infinity),
      ),

      Expanded(
        child: _isLoading
            ? const SkeletonList(rows: 4)
            : RefreshIndicator(
                onRefresh: refresh,
                child: dayTasks.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 24),
                        EmptyState(
                          icon: Icons.event_available_rounded,
                          title: 'A clear day',
                          message: 'Nothing is scheduled. Add something, or long-press a task on another day and drop it here.',
                          action: FilledButton.icon(onPressed: _showAddForDay, icon: const Icon(Icons.add_rounded, size: 18), label: const Text('Add task for this day')),
                        ),
                      ])
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                        children: [
                          for (final e in groups.entries)
                            if (e.value.isNotEmpty) ...[
                              SectionLabel(e.key, icon: groupIcons[e.key], count: e.value.length),
                              for (final t in e.value) _card(t, parseDate(t.dueAt) == null ? null : DateFormat('h:mm a').format(parseDate(t.dueAt)!)),
                            ],
                          const SizedBox(height: 10),
                          Pressable(
                            onTap: _showAddForDay,
                            child: Container(
                              height: 50,
                              decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: p.borderStrong)),
                              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(Icons.add_rounded, color: p.primaryText, size: 20),
                                const SizedBox(width: 8),
                                Text('Add task for this day', style: AppType.card(p.text2).copyWith(fontSize: 13.5)),
                              ]),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Center(child: Text('Tip: long-press a task and drop it on a day to move it', style: AppType.meta(p.text3))),
                        ],
                      ),
              ),
      ),
    ]);
  }
}

class _DayPill extends StatelessWidget {
  final DateTime day;
  final bool isToday;
  final bool selected;
  final int count;
  final bool hovering;
  final bool dragging;
  final VoidCallback onTap;
  const _DayPill({required this.day, required this.isToday, required this.selected, required this.count, required this.hovering, required this.dragging, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fg = selected ? p.bg : p.text;
    return Semantics(
      selected: selected,
      button: true,
      label: '${DateFormat('EEEE d').format(day)}, $count open',
      child: Pressable(
        onTap: onTap,
        child: AnimatedScale(
          scale: hovering ? 1.08 : 1,
          duration: Motion.base,
          curve: Motion.spring,
          child: AnimatedContainer(
            duration: Motion.base,
            curve: Motion.out,
            width: 54,
            decoration: BoxDecoration(
              color: hovering ? p.primarySoft : (selected ? p.text : p.surface),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: hovering ? p.primary : (dragging ? p.primary.withValues(alpha: 0.4) : (isToday && !selected ? p.primary : p.borderSubtle)), width: hovering || (isToday && !selected) ? 1.5 : 1),
              boxShadow: selected ? [BoxShadow(color: Colors.black.withValues(alpha: p.isDark ? 0.4 : 0.15), blurRadius: 10, offset: const Offset(0, 4))] : null,
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(isToday ? 'TODAY' : DateFormat('E').format(day).toUpperCase(), style: AppType.eyebrow(selected ? p.bg.withValues(alpha: 0.75) : (isToday ? p.primaryText : p.text3)).copyWith(fontSize: 9.5, letterSpacing: 0.6)),
              const SizedBox(height: 2),
              Text('${day.day}', style: AppType.number(fg, size: 19)),
              const SizedBox(height: 3),
              SizedBox(
                height: 5,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  for (var i = 0; i < count.clamp(0, 3); i++)
                    Container(margin: const EdgeInsets.symmetric(horizontal: 1), width: 4.5, height: 4.5, decoration: BoxDecoration(shape: BoxShape.circle, color: selected ? p.bg.withValues(alpha: 0.8) : p.primary)),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DragFeedback extends StatelessWidget {
  final Task task;
  const _DragFeedback({required this.task});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final q = quadrantFor(task.eisenhowerQuadrant);
    return Material(
      color: Colors.transparent,
      child: Transform.rotate(
        angle: -0.03,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.72,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: p.surface,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: p.primary, width: 1.5),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.22), blurRadius: 24, offset: const Offset(0, 10))],
          ),
          child: Row(children: [
            Container(width: 4, height: 28, decoration: BoxDecoration(color: q?.colorOf(p) ?? p.primary, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 10),
            Expanded(child: Text(task.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.card(p.text))),
            Icon(Icons.open_with_rounded, size: 18, color: p.primaryText),
          ]),
        ),
      ),
    );
  }
}
