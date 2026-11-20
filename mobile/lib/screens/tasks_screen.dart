import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/task_card.dart';
import '../widgets/ui.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => TasksScreenState();
}

class TasksScreenState extends State<TasksScreen> {
  List<Task> _tasks = [];
  bool _isLoading = true;
  bool _failed = false;
  String _searchQuery = '';
  String _filter = 'ALL'; // ALL, PENDING, TODAY, COMPLETED
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_tasks.isEmpty) setState(() => _isLoading = true);
    try {
      final tasks = await ApiService().fetchTasks();
      if (mounted) {
        setState(() {
          _tasks = tasks;
          _isLoading = false;
          _failed = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _failed = true;
        });
      }
    }
  }

  bool _isToday(Task t) {
    final d = parseDate(t.dueAt);
    return d != null && DateUtils.isSameDay(d, DateTime.now());
  }

  List<Task> get _filteredTasks {
    final q = _searchQuery.toLowerCase();
    return _tasks.where((t) {
      if (q.isNotEmpty) {
        final matches = t.title.toLowerCase().contains(q) || (t.description?.toLowerCase().contains(q) ?? false) || (t.category?.toLowerCase().contains(q) ?? false);
        if (!matches) return false;
      }
      if (_filter == 'PENDING') return !t.isCompleted;
      if (_filter == 'COMPLETED') return t.isCompleted;
      if (_filter == 'TODAY') return _isToday(t);
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final list = _filteredTasks;
    final filters = <(String, String, int, IconData)>[
      ('ALL', 'All', _tasks.length, Icons.list_rounded),
      ('PENDING', 'Pending', _tasks.where((t) => !t.isCompleted).length, Icons.radio_button_unchecked_rounded),
      ('TODAY', 'Today', _tasks.where(_isToday).length, Icons.today_rounded),
      ('COMPLETED', 'Completed', _tasks.where((t) => t.isCompleted).length, Icons.check_circle_outline_rounded),
    ];

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
        child: TextField(
          controller: _searchCtrl,
          onChanged: (val) => setState(() => _searchQuery = val.trim()),
          textInputAction: TextInputAction.search,
          style: AppType.body(p.text),
          decoration: InputDecoration(
            hintText: 'Search tasks, notes, categories',
            prefixIcon: const Icon(Icons.search_rounded, size: 20),
            fillColor: p.surface,
            suffixIcon: _searchQuery.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () {
                      _searchCtrl.clear();
                      setState(() => _searchQuery = '');
                    },
                  ),
          ),
        ),
      ),
      SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: filters.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (context, i) {
            final f = filters[i];
            final selected = _filter == f.$1;
            return Pressable(
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _filter = f.$1);
              },
              child: AnimatedContainer(
                duration: Motion.base,
                curve: Motion.out,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: selected ? p.text : p.surface,
                  borderRadius: BorderRadius.circular(Radii.full),
                  border: Border.all(color: selected ? p.text : p.border),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(f.$4, size: 16, color: selected ? p.bg : p.text3),
                  const SizedBox(width: 6),
                  Text(f.$2, style: AppType.caption(selected ? p.bg : p.text).copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  AnimatedSwitcher(
                    duration: Motion.fast,
                    child: Text('${f.$3}', key: ValueKey(f.$3), style: AppType.meta(selected ? p.bg.withValues(alpha: 0.7) : p.text3).copyWith(fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 4),
      Expanded(
        child: _isLoading
            ? const SkeletonList()
            : _failed && _tasks.isEmpty
                ? Center(child: SingleChildScrollView(child: ErrorState(message: 'Check the server URL in Settings, then retry.', onRetry: refresh)))
                : RefreshIndicator(
                    onRefresh: refresh,
                    child: list.isEmpty
                        ? ListView(children: [
                            const SizedBox(height: 24),
                            _searchQuery.isNotEmpty
                                ? EmptyState(icon: Icons.search_off_rounded, title: 'No matches', message: 'Nothing matches “$_searchQuery”.')
                                : switch (_filter) {
                                    'COMPLETED' => const EmptyState(icon: Icons.emoji_events_outlined, title: 'Nothing completed yet', message: 'Finished tasks collect here. Swipe right on a task to complete it.'),
                                    'TODAY' => const EmptyState(icon: Icons.wb_sunny_outlined, title: 'Nothing due today', message: 'Enjoy the breathing room — or plan something in the Day Planner.'),
                                    'PENDING' => EmptyState(icon: Icons.celebration_outlined, tone: p.green, title: 'All done', message: 'Every task is complete.'),
                                    _ => const EmptyState(icon: Icons.inbox_outlined, title: 'No tasks yet', message: 'Tap the capture button to add your first task.'),
                                  },
                          ])
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 6, 16, 110),
                            itemCount: list.length,
                            itemBuilder: (context, idx) {
                              final task = list[idx];
                              return TweenAnimationBuilder<double>(
                                key: ValueKey(task.id),
                                tween: Tween(begin: 0, end: 1),
                                duration: Duration(milliseconds: 220 + 30 * idx.clamp(0, 8)),
                                curve: Motion.out,
                                builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child)),
                                child: TaskCard(
                                  task: task,
                                  onToggle: (done) async {
                                    await ApiService().toggleTaskComplete(task.id, done == true);
                                    refresh();
                                  },
                                  onMoveQuadrant: (q) async {
                                    await ApiService().moveTaskQuadrant(task.id, q);
                                    refresh();
                                  },
                                  onDelete: () async {
                                    await ApiService().deleteTask(task.id);
                                    if (context.mounted) showToast(context, 'Task deleted', icon: Icons.delete_outline_rounded, color: p.text3);
                                    refresh();
                                  },
                                  onReschedule: (d) async {
                                    await ApiService().updateTaskDueAt(task.id, d);
                                    refresh();
                                  },
                                ),
                              );
                            },
                          ),
                  ),
      ),
    ]);
  }
}
