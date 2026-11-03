import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/task_card.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => TasksScreenState();
}

class TasksScreenState extends State<TasksScreen> {
  List<Task> _tasks = [];
  bool _isLoading = true;
  String _searchQuery = '';
  String _filter = 'ALL'; // ALL, PENDING, COMPLETED, TODAY

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
          _tasks = tasks;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Task> get _filteredTasks {
    return _tasks.where((t) {
      if (_searchQuery.isNotEmpty) {
        final matches = t.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            (t.description?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
        if (!matches) return false;
      }

      if (_filter == 'PENDING') return !t.isCompleted;
      if (_filter == 'COMPLETED') return t.isCompleted;
      if (_filter == 'TODAY') {
        if (t.dueAt == null) return false;
        try {
          final dt = DateTime.parse(t.dueAt!);
          final now = DateTime.now();
          return dt.year == now.year && dt.month == now.month && dt.day == now.day;
        } catch (_) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _filteredTasks;

    return Column(
      children: [
        // Search & Filter Header
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Column(
            children: [
              TextField(
                onChanged: (val) => setState(() => _searchQuery = val.trim()),
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search tasks...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textMuted),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  filled: true,
                  fillColor: AppColors.background,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('ALL', 'All Tasks (${_tasks.length})'),
                    const SizedBox(width: 6),
                    _buildFilterChip('PENDING', 'Pending (${_tasks.where((t) => !t.isCompleted).length})'),
                    const SizedBox(width: 6),
                    _buildFilterChip('TODAY', 'Today'),
                    const SizedBox(width: 6),
                    _buildFilterChip('COMPLETED', 'Completed (${_tasks.where((t) => t.isCompleted).length})'),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: AppColors.border),

        // Task List
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              : RefreshIndicator(
                  onRefresh: refresh,
                  color: AppColors.primary,
                  child: list.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.checklist, size: 36, color: AppColors.textMuted.withValues(alpha: 0.4)),
                              const SizedBox(height: 8),
                              const Text('No tasks found matching filter', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(14, 10, 14, 80),
                          itemCount: list.length,
                          itemBuilder: (context, idx) {
                            final task = list[idx];
                            return TaskCard(
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
                                refresh();
                              },
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filter == key;
    return InkWell(
      onTap: () => setState(() => _filter = key),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.background,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
