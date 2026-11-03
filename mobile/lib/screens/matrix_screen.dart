import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/task_card.dart';

class MatrixScreen extends StatefulWidget {
  const MatrixScreen({super.key});

  @override
  State<MatrixScreen> createState() => MatrixScreenState();
}

class MatrixScreenState extends State<MatrixScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
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
    _tabController = TabController(length: 4, vsync: this);
    refresh();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

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
          _error = 'Unable to connect to server. Check Settings.';
        });
      }
    }
  }

  Future<void> _toggleTask(Task task, bool? done) async {
    await ApiService().toggleTaskComplete(task.id, done == true);
    refresh();
  }

  Future<void> _moveQuadrant(Task task, String quadrant) async {
    await ApiService().moveTaskQuadrant(task.id, quadrant);
    refresh();
  }

  Future<void> _deleteTask(Task task) async {
    await ApiService().deleteTask(task.id);
    refresh();
  }

  void _showQuickAddDialog(String quadrantKey) {
    final titleCtrl = TextEditingController();
    String quadrantValue = 'DO_FIRST';
    if (quadrantKey == 'schedule') quadrantValue = 'SCHEDULE';
    if (quadrantKey == 'delegate') quadrantValue = 'DELEGATE';
    if (quadrantKey == 'eliminate') quadrantValue = 'ELIMINATE';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        title: Text(
          'Add to ${_getQuadrantTitle(quadrantKey)}',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.heading),
        ),
        content: TextField(
          controller: titleCtrl,
          autofocus: true,
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          decoration: const InputDecoration(
            hintText: 'Task title...',
            hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          onSubmitted: (val) async {
            if (val.trim().isNotEmpty) {
              Navigator.pop(ctx);
              await ApiService().createTask(title: val.trim(), quadrant: quadrantValue);
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
                await ApiService().createTask(title: val, quadrant: quadrantValue);
                refresh();
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Add Task', style: TextStyle(color: Colors.white, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  String _getQuadrantTitle(String key) {
    switch (key) {
      case 'doFirst':
        return 'Do First (Urgent & Important)';
      case 'schedule':
        return 'Schedule (Important, Not Urgent)';
      case 'delegate':
        return 'Delegate (Urgent, Not Important)';
      case 'eliminate':
        return 'Eliminate (Neither)';
      default:
        return 'Quadrant';
    }
  }

  Widget _buildQuadrantTab(String key, String label, Color color) {
    final count = (_matrix[key] ?? []).where((t) => !t.isCompleted).length;
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          if (count > 0) ...[
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$count',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQuadrantList(String key, String emptyMsg) {
    final list = _matrix[key] ?? [];

    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.inbox_outlined, size: 40, color: AppColors.textMuted.withValues(alpha: 0.4)),
              const SizedBox(height: 8),
              Text(
                emptyMsg,
                style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () => _showQuickAddDialog(key),
                icon: const Icon(Icons.add, size: 14, color: AppColors.primary),
                label: const Text('Add Task', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: refresh,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 80),
        itemCount: list.length + 1,
        itemBuilder: (context, idx) {
          if (idx == list.length) {
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: () => _showQuickAddDialog(key),
                icon: const Icon(Icons.add, size: 14, color: AppColors.primary),
                label: const Text('Add Task to this Quadrant', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  backgroundColor: AppColors.surface,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            );
          }
          final task = list[idx];
          return TaskCard(
            task: task,
            onToggle: (done) => _toggleTask(task, done),
            onMoveQuadrant: (q) => _moveQuadrant(task, q),
            onDelete: () => _deleteTask(task),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Tab Header
        Container(
          color: AppColors.surface,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.primary,
            indicatorWeight: 2.5,
            labelColor: AppColors.heading,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              _buildQuadrantTab('doFirst', 'Do First', AppColors.danger),
              _buildQuadrantTab('schedule', 'Schedule', AppColors.primary),
              _buildQuadrantTab('delegate', 'Delegate', AppColors.accent),
              _buildQuadrantTab('eliminate', 'Eliminate', AppColors.eliminate),
            ],
          ),
        ),
        // Content
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              : _error != null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.cloud_off, size: 36, color: AppColors.warning),
                          const SizedBox(height: 8),
                          Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: refresh,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text('Retry Connection', style: TextStyle(color: Colors.white, fontSize: 13)),
                          ),
                        ],
                      ),
                    )
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildQuadrantList('doFirst', 'No urgent & important tasks.\nGreat job staying ahead!'),
                        _buildQuadrantList('schedule', 'No scheduled strategic tasks.\nPlan ahead for long-term goals.'),
                        _buildQuadrantList('delegate', 'No tasks to delegate.\nUrgent items that others can handle.'),
                        _buildQuadrantList('eliminate', 'No low-value tasks to eliminate.'),
                      ],
                    ),
        ),
      ],
    );
  }
}
