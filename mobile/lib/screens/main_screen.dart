import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/ai_status.dart';
import '../theme/app_theme.dart';
import '../widgets/quick_capture_bottom_sheet.dart';
import '../widgets/notifications_sheet.dart';
import '../widgets/settings_dialog.dart';
import 'matrix_screen.dart';
import 'day_planner_screen.dart';
import 'tasks_screen.dart';
import 'notes_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  AIStatus? _aiStatus;
  int _unreadNotifications = 0;

  final GlobalKey<MatrixScreenState> _matrixKey = GlobalKey<MatrixScreenState>();
  final GlobalKey<DayPlannerScreenState> _plannerKey = GlobalKey<DayPlannerScreenState>();
  final GlobalKey<TasksScreenState> _tasksKey = GlobalKey<TasksScreenState>();
  final GlobalKey<NotesScreenState> _notesKey = GlobalKey<NotesScreenState>();

  @override
  void initState() {
    super.initState();
    _fetchAppMeta();
  }

  Future<void> _fetchAppMeta() async {
    final status = await ApiService().getAIStatus();
    final notifs = await ApiService().fetchNotifications();
    if (mounted) {
      setState(() {
        _aiStatus = status;
        _unreadNotifications = notifs.where((n) => !n.isRead).length;
      });
    }
  }

  void _refreshCurrentScreen() {
    _fetchAppMeta();
    switch (_currentIndex) {
      case 0:
        _matrixKey.currentState?.refresh();
        break;
      case 1:
        _plannerKey.currentState?.refresh();
        break;
      case 2:
        _tasksKey.currentState?.refresh();
        break;
      case 3:
        _notesKey.currentState?.refresh();
        break;
    }
  }

  void _openQuickCapture() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => QuickCaptureBottomSheet(
        onCaptured: _refreshCurrentScreen,
      ),
    );
  }

  void _openNotifications() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const NotificationsSheet(),
    ).then((_) => _fetchAppMeta());
  }

  void _openSettings() {
    showDialog(
      context: context,
      builder: (ctx) => SettingsDialog(
        onSaved: _refreshCurrentScreen,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Eisenhower Matrix', 'Day Planner', 'Inbox & Tasks', 'Notes'];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(Icons.check, size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 8),
            Text(
              titles[_currentIndex],
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: AppColors.heading,
              ),
            ),
          ],
        ),
        actions: [
          // AI Status Pill
          InkWell(
            onTap: _openSettings,
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _aiStatus?.connected == true ? AppColors.success : AppColors.warning,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    _aiStatus?.connected == true ? 'AI Active' : 'AI Offline',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          // Notifications Bell
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none, size: 20, color: AppColors.textPrimary),
                onPressed: _openNotifications,
              ),
              if (_unreadNotifications > 0) ...[
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.danger),
                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                    child: Text(
                      '$_unreadNotifications',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ],
            ],
          ),
          // Settings
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 20, color: AppColors.textPrimary),
            onPressed: _openSettings,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          MatrixScreen(key: _matrixKey),
          DayPlannerScreen(key: _plannerKey),
          TasksScreen(key: _tasksKey),
          NotesScreen(key: _notesKey),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) {
            setState(() => _currentIndex = idx);
            _refreshCurrentScreen();
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_rounded, size: 20),
              activeIcon: Icon(Icons.grid_view_rounded, size: 20, color: AppColors.primary),
              label: 'Matrix',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined, size: 20),
              activeIcon: Icon(Icons.calendar_today, size: 20, color: AppColors.primary),
              label: 'Planner',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.check_circle_outline, size: 20),
              activeIcon: Icon(Icons.check_circle, size: 20, color: AppColors.primary),
              label: 'Tasks',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.description_outlined, size: 20),
              activeIcon: Icon(Icons.description, size: 20, color: AppColors.primary),
              label: 'Notes',
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openQuickCapture,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.add, size: 24),
      ),
    );
  }
}
