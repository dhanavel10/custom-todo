import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/task.dart';
import '../theme/app_theme.dart';
import '../theme/quadrants.dart';
import 'ui.dart';

/// Canonical task card: tap for details, long-press for actions, swipe to complete / delete.
class TaskCard extends StatelessWidget {
  final Task task;
  final ValueChanged<bool?> onToggle;
  final ValueChanged<String>? onMoveQuadrant;
  final VoidCallback? onDelete;
  final ValueChanged<DateTime?>? onReschedule;
  final bool hideQuadrant;
  final String? timeLabel;
  /// Set false when an ancestor uses long-press (e.g. drag to reschedule).
  final bool longPressOpensDetails;

  const TaskCard({
    super.key,
    required this.task,
    required this.onToggle,
    this.onMoveQuadrant,
    this.onDelete,
    this.onReschedule,
    this.hideQuadrant = false,
    this.timeLabel,
    this.longPressOpensDetails = true,
  });

  void _openDetails(BuildContext context) {
    showAppSheet(
      context,
      (ctx) => TaskDetailSheet(task: task, onToggle: onToggle, onMoveQuadrant: onMoveQuadrant, onDelete: onDelete, onReschedule: onReschedule),
    );
  }

  Future<bool> _confirmDelete(BuildContext context) =>
      showConfirm(context, title: 'Delete this task?', message: '“${task.title}” will be permanently removed.', confirmLabel: 'Delete', danger: true);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final done = task.isCompleted;
    final q = quadrantFor(task.eisenhowerQuadrant);
    final qColor = q?.colorOf(p) ?? p.borderStrong;

    final card = Pressable(
      scale: 0.985,
      onTap: () => _openDetails(context),
      onLongPress: longPressOpensDetails ? () => _openDetails(context) : null,
      child: AnimatedContainer(
        duration: Motion.base,
        curve: Motion.out,
        decoration: BoxDecoration(
          color: done ? p.surface2 : p.surface,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: done ? p.borderSubtle : p.border),
          boxShadow: done ? null : [BoxShadow(color: Colors.black.withValues(alpha: p.isDark ? 0.25 : 0.035), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(Radii.lg),
          child: Stack(children: [
            // Quadrant stripe — positioned so the card sizes from its content (no IntrinsicHeight)
            Positioned(left: 0, top: 0, bottom: 0, width: 3, child: AnimatedContainer(duration: Motion.base, color: done ? Colors.transparent : qColor)),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SizedBox(width: 3),
              Padding(
                padding: const EdgeInsets.only(left: 2, top: 2),
                child: TaskCheck(checked: done, ring: qColor.withValues(alpha: 0.7), onChanged: (v) => onToggle(v)),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(0, 12, 4, 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (timeLabel != null) Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(timeLabel!, style: AppType.mono(p.text3, size: 10.5))),
                    AnimatedDefaultTextStyle(
                      duration: Motion.base,
                      style: AppType.card(done ? p.text3 : p.text).copyWith(decoration: done ? TextDecoration.lineThrough : null, decorationColor: p.text3),
                      child: Text(task.title, maxLines: 3, overflow: TextOverflow.ellipsis),
                    ),
                    if (task.description != null && task.description!.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(task.description!, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.caption(p.text3)),
                    ],
                    const SizedBox(height: 8),
                    Opacity(
                      opacity: done ? 0.6 : 1,
                      child: Wrap(spacing: 5, runSpacing: 5, children: [
                        if (!hideQuadrant) QuadrantTag(task.eisenhowerQuadrant),
                        if (task.dueAt != null) DueTag(task),
                        if (task.category != null && task.category!.isNotEmpty) Tag(task.category!, icon: Icons.tag_rounded, outline: true),
                        if (task.aiAnalysis != null) Tag(task.aiAnalysis!.source == 'ollama' ? 'AI' : 'NLP', icon: Icons.auto_awesome_rounded, color: p.ai),
                      ]),
                    ),
                  ]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: IconButton(
                  tooltip: 'Task actions',
                  icon: Icon(Icons.more_horiz_rounded, color: p.text3, size: 20),
                  onPressed: () => _openDetails(context),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Dismissible(
        key: ValueKey('task-${task.id}-${task.status}'),
        background: _SwipeBg(color: p.green, icon: done ? Icons.undo_rounded : Icons.check_rounded, label: done ? 'Reopen' : 'Complete', alignLeft: true),
        secondaryBackground: onDelete == null ? null : _SwipeBg(color: p.coral, icon: Icons.delete_outline_rounded, label: 'Delete', alignLeft: false),
        direction: onDelete == null ? DismissDirection.startToEnd : DismissDirection.horizontal,
        dismissThresholds: const {DismissDirection.startToEnd: 0.32, DismissDirection.endToStart: 0.4},
        confirmDismiss: (dir) async {
          HapticFeedback.mediumImpact();
          if (dir == DismissDirection.startToEnd) {
            onToggle(!done);
            return false; // list refresh moves the card
          }
          final ok = await _confirmDelete(context);
          if (ok) onDelete?.call();
          return ok;
        },
        child: card,
      ),
    );
  }
}

class _SwipeBg extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String label;
  final bool alignLeft;
  const _SwipeBg({required this.color, required this.icon, required this.label, required this.alignLeft});

  @override
  Widget build(BuildContext context) {
    final content = [Icon(icon, color: Colors.white, size: 20), const SizedBox(width: 8), Text(label, style: AppType.card(Colors.white).copyWith(fontSize: 13.5))];
    return Container(
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(Radii.lg)),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      alignment: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
      child: Row(mainAxisSize: MainAxisSize.min, children: alignLeft ? content : content.reversed.toList()),
    );
  }
}

/// Bottom sheet with task details, AI reasoning and every action.
class TaskDetailSheet extends StatelessWidget {
  final Task task;
  final ValueChanged<bool?> onToggle;
  final ValueChanged<String>? onMoveQuadrant;
  final VoidCallback? onDelete;
  final ValueChanged<DateTime?>? onReschedule;
  const TaskDetailSheet({super.key, required this.task, required this.onToggle, this.onMoveQuadrant, this.onDelete, this.onReschedule});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final ai = task.aiAnalysis;
    final due = parseDate(task.dueAt);
    final current = task.eisenhowerQuadrant ?? 'DO_FIRST';

    return SheetScaffold(
      scrollable: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 4),
        Wrap(spacing: 6, runSpacing: 6, children: [
          QuadrantTag(task.eisenhowerQuadrant),
          if (task.category != null && task.category!.isNotEmpty) Tag(task.category!, icon: Icons.tag_rounded, outline: true),
          if (task.isCompleted) Tag('Completed', icon: Icons.check_rounded, color: p.green),
        ]),
        const SizedBox(height: 12),
        Text(task.title, style: AppType.page(p.text).copyWith(fontSize: 21, decoration: task.isCompleted ? TextDecoration.lineThrough : null)),
        if (task.description != null && task.description!.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(task.description!, style: AppType.body(p.text2)),
        ],
        if (due != null) ...[
          const SizedBox(height: 14),
          Row(children: [
            Icon(Icons.schedule_rounded, size: 16, color: p.text3),
            const SizedBox(width: 8),
            Text(DateFormat('EEEE, MMM d · h:mm a').format(due), style: AppType.body(p.text)),
            if (task.isDeadline) ...[const SizedBox(width: 8), Tag('Deadline', color: p.coral)],
          ]),
        ],
        if (ai != null) ...[
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: p.soft(p.ai), borderRadius: BorderRadius.circular(Radii.md), border: Border.all(color: p.ai.withValues(alpha: 0.25))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.auto_awesome_rounded, size: 15, color: p.ai),
                const SizedBox(width: 6),
                Expanded(child: Text(ai.source == 'ollama' ? 'AI classification' : 'NLP classification', style: AppType.card(p.ai).copyWith(fontSize: 13))),
                Text(ai.model, style: AppType.mono(p.text3, size: 10.5), overflow: TextOverflow.ellipsis),
              ]),
              const SizedBox(height: 10),
              _ScoreBar(label: 'Urgency', value: ai.urgencyScore.toDouble(), color: p.ai),
              const SizedBox(height: 6),
              _ScoreBar(label: 'Importance', value: ai.importanceScore.toDouble(), color: p.ai),
              const SizedBox(height: 10),
              Text(ai.reasoning, style: AppType.caption(p.text2).copyWith(fontSize: 13, height: 1.5)),
            ]),
          ),
        ],
        if (onMoveQuadrant != null) ...[
          const SizedBox(height: 18),
          Text('MOVE TO', style: AppType.eyebrow(p.text3)),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 3.0,
            children: [
              for (final q in kQuadrants)
                _QuadrantChoice(
                  meta: q,
                  selected: q.key == current,
                  onTap: () {
                    Navigator.pop(context);
                    if (q.key != current) onMoveQuadrant!(q.key);
                  },
                ),
            ],
          ),
        ],
        if (onReschedule != null && !task.isCompleted) ...[
          const SizedBox(height: 18),
          Text('RESCHEDULE', style: AppType.eyebrow(p.text3)),
          const SizedBox(height: 8),
          RescheduleChips(
            current: due,
            onPick: (d) {
              Navigator.pop(context);
              onReschedule!(d);
            },
          ),
        ],
        const SizedBox(height: 20),
        Row(children: [
          if (onDelete != null)
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: p.coral, side: BorderSide(color: p.coral.withValues(alpha: 0.35))),
              onPressed: () async {
                final ok = await showConfirm(context, title: 'Delete this task?', message: '“${task.title}” will be permanently removed.', confirmLabel: 'Delete', danger: true);
                if (ok && context.mounted) {
                  Navigator.pop(context);
                  onDelete!();
                }
              },
              icon: const Icon(Icons.delete_outline_rounded, size: 18),
              label: const Text('Delete'),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              style: task.isCompleted ? null : FilledButton.styleFrom(backgroundColor: p.green),
              onPressed: () {
                Navigator.pop(context);
                onToggle(!task.isCompleted);
              },
              icon: Icon(task.isCompleted ? Icons.undo_rounded : Icons.check_rounded, size: 18),
              label: Text(task.isCompleted ? 'Mark as not done' : 'Complete'),
            ),
          ),
        ]),
      ]),
    );
  }
}

class _ScoreBar extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _ScoreBar({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(children: [
      SizedBox(width: 78, child: Text(label, style: AppType.meta(p.text3))),
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: (value / 10).clamp(0, 1)),
            duration: const Duration(milliseconds: 700),
            curve: Motion.out,
            builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 5, color: color, backgroundColor: color.withValues(alpha: 0.15)),
          ),
        ),
      ),
      const SizedBox(width: 10),
      Text('${value.round()}/10', style: AppType.mono(p.text2, size: 10.5)),
    ]);
  }
}

class _QuadrantChoice extends StatelessWidget {
  final QuadrantMeta meta;
  final bool selected;
  final VoidCallback onTap;
  const _QuadrantChoice({required this.meta, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final c = meta.colorOf(p);
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.base,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: selected ? p.soft(c) : p.surface2,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: selected ? c : p.border, width: selected ? 1.5 : 1),
        ),
        child: Row(children: [
          Icon(meta.icon, size: 18, color: c),
          const SizedBox(width: 8),
          Expanded(child: Text(meta.name, style: AppType.card(p.text).copyWith(fontSize: 13.5), overflow: TextOverflow.ellipsis)),
          if (selected) Icon(Icons.check_rounded, size: 16, color: c),
        ]),
      ),
    );
  }
}

/// Quick reschedule options — shared by the task sheet and planner.
class RescheduleChips extends StatelessWidget {
  final DateTime? current;
  final ValueChanged<DateTime?> onPick;
  const RescheduleChips({super.key, this.current, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    DateTime at(DateTime d, int h) => DateTime(d.year, d.month, d.day, h);
    final daysToMon = (8 - now.weekday) % 7 == 0 ? 7 : (8 - now.weekday) % 7;
    final opts = <(String, IconData, DateTime)>[
      if (now.hour < 18) ('This evening', Icons.nights_stay_rounded, at(today, 19)),
      ('Tomorrow', Icons.wb_twilight_rounded, at(today.add(const Duration(days: 1)), 9)),
      ('Next week', Icons.date_range_rounded, at(today.add(Duration(days: daysToMon)), 9)),
    ];
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final o in opts)
        ActionChip(
          avatar: Icon(o.$2, size: 16, color: p.primaryText),
          label: Text(o.$1),
          labelStyle: AppType.caption(p.text).copyWith(fontWeight: FontWeight.w600),
          backgroundColor: p.surface2,
          side: BorderSide(color: p.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.full)),
          onPressed: () => onPick(o.$3),
        ),
      ActionChip(
        avatar: Icon(Icons.edit_calendar_rounded, size: 16, color: p.primaryText),
        label: const Text('Pick date…'),
        labelStyle: AppType.caption(p.text).copyWith(fontWeight: FontWeight.w600),
        backgroundColor: p.surface2,
        side: BorderSide(color: p.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.full)),
        onPressed: () async {
          final base = current ?? now;
          final d = await showDatePicker(context: context, initialDate: base.isBefore(today) ? today : base, firstDate: today.subtract(const Duration(days: 365)), lastDate: today.add(const Duration(days: 365 * 3)));
          if (d == null || !context.mounted) return;
          final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(current ?? at(today, 9)));
          if (t == null) return;
          onPick(DateTime(d.year, d.month, d.day, t.hour, t.minute));
        },
      ),
      if (current != null)
        ActionChip(
          avatar: Icon(Icons.event_busy_rounded, size: 16, color: p.text3),
          label: const Text('Remove date'),
          labelStyle: AppType.caption(p.text2).copyWith(fontWeight: FontWeight.w600),
          backgroundColor: Colors.transparent,
          side: BorderSide(color: p.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.full)),
          onPressed: () => onPick(null),
        ),
    ]);
  }
}
