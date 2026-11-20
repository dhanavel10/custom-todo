import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../theme/quadrants.dart';
import '../widgets/quick_add_sheet.dart';
import '../widgets/task_card.dart';
import '../widgets/ui.dart';

/// Mobile Eisenhower matrix: a miniature 2×2 navigator on top, one swipeable quadrant at a time below.
class MatrixScreen extends StatefulWidget {
  const MatrixScreen({super.key});

  @override
  State<MatrixScreen> createState() => MatrixScreenState();
}

class MatrixScreenState extends State<MatrixScreen> {
  final PageController _pages = PageController();
  int _page = 0;
  Map<String, List<Task>> _matrix = {
    'doFirst': [],
    'schedule': [],
    'delegate': [],
    'eliminate': [],
  };
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_matrix.values.every((l) => l.isEmpty)) setState(() => _isLoading = true);
    setState(() => _error = null);

    try {
      final res = await ApiService().fetchMatrix();
      if (mounted) {
        setState(() {
          _matrix = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Check the server URL in Settings, then retry.';
        });
      }
    }
  }

  Future<void> _toggleTask(Task task, bool? done) async {
    await ApiService().toggleTaskComplete(task.id, done == true);
    if (mounted && done == true) showToast(context, 'Completed “${task.title}”');
    refresh();
  }

  Future<void> _moveQuadrant(Task task, String quadrant) async {
    await ApiService().moveTaskQuadrant(task.id, quadrant);
    if (mounted) showToast(context, 'Moved to ${quadrantFor(quadrant)?.name ?? 'quadrant'}', icon: Icons.swap_horiz_rounded, color: quadrantFor(quadrant)?.colorOf(context.palette));
    refresh();
  }

  Future<void> _deleteTask(Task task) async {
    await ApiService().deleteTask(task.id);
    if (mounted) showToast(context, 'Task deleted', icon: Icons.delete_outline_rounded, color: context.palette.text3);
    refresh();
  }

  void _goTo(int i) {
    HapticFeedback.selectionClick();
    _pages.animateToPage(i, duration: Motion.slow, curve: Motion.out);
  }

  void _showQuickAdd(QuadrantMeta q) {
    showQuickAddSheet(
      context,
      title: 'Add to ${q.name}',
      subtitle: q.tagline,
      icon: q.icon,
      color: q.colorOf(context.palette),
      hint: 'Task title…',
      onSubmit: (title) async {
        await ApiService().createTask(title: title, quadrant: q.key);
        refresh();
      },
    );
  }

  int _openCount(String mapKey) => (_matrix[mapKey] ?? []).where((t) => !t.isCompleted).length;

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const SkeletonList();
    if (_error != null) return Center(child: SingleChildScrollView(child: ErrorState(message: _error!, onRetry: refresh)));

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
        child: _MiniMatrix(selected: _page, counts: [for (final q in kQuadrants) _openCount(q.mapKey)], onSelect: _goTo),
      ),
      Expanded(
        child: PageView.builder(
          controller: _pages,
          itemCount: kQuadrants.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (context, i) => _QuadrantPage(
            meta: kQuadrants[i],
            tasks: _matrix[kQuadrants[i].mapKey] ?? const [],
            onRefresh: refresh,
            onAdd: () => _showQuickAdd(kQuadrants[i]),
            onToggle: _toggleTask,
            onMove: _moveQuadrant,
            onDelete: _deleteTask,
          ),
        ),
      ),
    ]);
  }
}

class _MiniMatrix extends StatelessWidget {
  final int selected;
  final List<int> counts;
  final ValueChanged<int> onSelect;
  const _MiniMatrix({required this.selected, required this.counts, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget cell(int i) {
      final q = kQuadrants[i];
      final c = q.colorOf(p);
      final active = i == selected;
      return Expanded(
        child: Semantics(
          selected: active,
          button: true,
          label: '${q.name}, ${counts[i]} open',
          child: Pressable(
            onTap: () => onSelect(i),
            child: AnimatedContainer(
              duration: Motion.base,
              curve: Motion.out,
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: active ? p.surface : Colors.transparent,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: active ? c : Colors.transparent, width: 1.5),
                boxShadow: active ? [BoxShadow(color: c.withValues(alpha: 0.18), blurRadius: 12, offset: const Offset(0, 4))] : null,
              ),
              child: Row(children: [
                Icon(q.icon, size: 18, color: c),
                const SizedBox(width: 8),
                Expanded(child: Text(q.name, overflow: TextOverflow.ellipsis, style: AppType.card(active ? p.text : p.text2).copyWith(fontSize: 13.5))),
                AnimatedSwitcher(duration: Motion.fast, child: Text('${counts[i]}', key: ValueKey(counts[i]), style: AppType.number(c, size: 16))),
              ]),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(Radii.lg + 2)),
      child: Column(children: [
        Row(children: [cell(0), const SizedBox(width: 5), cell(1)]),
        const SizedBox(height: 5),
        Row(children: [cell(2), const SizedBox(width: 5), cell(3)]),
      ]),
    );
  }
}

class _QuadrantPage extends StatelessWidget {
  final QuadrantMeta meta;
  final List<Task> tasks;
  final Future<void> Function() onRefresh;
  final VoidCallback onAdd;
  final Future<void> Function(Task, bool?) onToggle;
  final Future<void> Function(Task, String) onMove;
  final Future<void> Function(Task) onDelete;
  const _QuadrantPage({required this.meta, required this.tasks, required this.onRefresh, required this.onAdd, required this.onToggle, required this.onMove, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final c = meta.colorOf(p);
    final sorted = [...tasks]..sort((a, b) => (a.isCompleted ? 1 : 0) - (b.isCompleted ? 1 : 0));

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: c,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [p.soft(c), p.surface]),
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: c.withValues(alpha: 0.22)),
            ),
            child: Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: c.withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 4))]),
                child: Icon(meta.icon, color: Colors.white, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(meta.name, style: AppType.section(p.text).copyWith(fontSize: 16)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: p.soft(c), borderRadius: BorderRadius.circular(4)),
                      child: Text(meta.code, style: AppType.mono(c, size: 10)),
                    ),
                  ]),
                  Text(meta.tagline, style: AppType.caption(p.text2)),
                ]),
              ),
              IconButton(tooltip: 'Add to ${meta.name}', onPressed: onAdd, icon: Icon(Icons.add_circle_rounded, color: c, size: 28)),
            ]),
          ),
          const SizedBox(height: 6),
          if (sorted.isEmpty)
            EmptyState(
              icon: meta.icon,
              tone: c,
              title: meta.emptyTitle,
              message: meta.description,
              action: OutlinedButton.icon(onPressed: onAdd, icon: Icon(Icons.add_rounded, size: 18, color: c), label: Text('Add to ${meta.name}')),
            )
          else ...[
            for (var i = 0; i < sorted.length; i++)
              TweenAnimationBuilder<double>(
                key: ValueKey(sorted[i].id),
                tween: Tween(begin: 0, end: 1),
                duration: Duration(milliseconds: 240 + 40 * i.clamp(0, 8)),
                curve: Motion.out,
                builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 10 * (1 - v)), child: child)),
                child: TaskCard(
                  task: sorted[i],
                  hideQuadrant: true,
                  onToggle: (done) => onToggle(sorted[i], done),
                  onMoveQuadrant: (q) => onMove(sorted[i], q),
                  onDelete: () => onDelete(sorted[i]),
                ),
              ),
            const SizedBox(height: 6),
            _AddRow(label: 'Add to ${meta.name}', color: c, onTap: onAdd),
          ],
        ],
      ),
    );
  }
}

class _AddRow extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _AddRow({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: 50,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: p.borderStrong, width: 1.2, strokeAlign: BorderSide.strokeAlignInside)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.add_rounded, color: color, size: 20),
          const SizedBox(width: 8),
          Text(label, style: AppType.card(p.text2).copyWith(fontSize: 13.5)),
        ]),
      ),
    );
  }
}
