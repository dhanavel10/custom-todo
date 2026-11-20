import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../models/ai_status.dart';
import '../models/user.dart';
import '../theme/app_theme.dart';
import '../widgets/ui.dart';
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

class _TabSpec {
  final String title;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  const _TabSpec(this.title, this.label, this.icon, this.activeIcon);
}

const _tabs = [
  _TabSpec('Eisenhower Matrix', 'Matrix', Icons.grid_view_outlined, Icons.grid_view_rounded),
  _TabSpec('Day Planner', 'Planner', Icons.calendar_today_outlined, Icons.calendar_month_rounded),
  _TabSpec('Inbox & Tasks', 'Tasks', Icons.check_circle_outline_rounded, Icons.check_circle_rounded),
  _TabSpec('Notes', 'Notes', Icons.sticky_note_2_outlined, Icons.sticky_note_2_rounded),
];

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
    HapticFeedback.lightImpact();
    showAppSheet(context, (ctx) => QuickCaptureBottomSheet(onCaptured: _refreshCurrentScreen));
  }

  void _openNotifications() {
    showAppSheet(context, (ctx) => const NotificationsSheet(), expand: true).then((_) => _fetchAppMeta());
  }

  void _openSettings() {
    showAppSheet(context, (ctx) => SettingsDialog(onSaved: _refreshCurrentScreen), expand: true).then((_) => _fetchAppMeta());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final connected = _aiStatus?.connected == true;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        titleSpacing: 20,
        title: AnimatedSwitcher(
          duration: Motion.base,
          switchInCurve: Motion.out,
          transitionBuilder: (child, a) => FadeTransition(
            opacity: a,
            child: SlideTransition(position: Tween(begin: const Offset(0, 0.25), end: Offset.zero).animate(a), child: child),
          ),
          child: Column(
            key: ValueKey(_currentIndex),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_tabs[_currentIndex].title, style: AppType.page(p.text).copyWith(fontSize: 20)),
              const SizedBox(height: 2),
              GestureDetector(
                onTap: _openSettings,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: _aiStatus == null ? p.text3 : (connected ? p.green : p.amber))),
                  const SizedBox(width: 6),
                  Text(
                    _aiStatus == null ? 'Connecting…' : (connected ? 'AI · ${_aiStatus!.model}' : 'Offline NLP mode'),
                    style: AppType.meta(p.text3),
                    overflow: TextOverflow.ellipsis,
                  ),
                ]),
              ),
            ],
          ),
        ),
        actions: [
          Stack(alignment: Alignment.center, children: [
            IconButton(tooltip: 'Notifications', icon: const Icon(Icons.notifications_none_rounded), onPressed: _openNotifications),
            if (_unreadNotifications > 0)
              Positioned(
                right: 8,
                top: 10,
                child: IgnorePointer(
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(color: p.coral, borderRadius: BorderRadius.circular(9), border: Border.all(color: p.bg, width: 2)),
                    alignment: Alignment.center,
                    child: Text(_unreadNotifications > 9 ? '9+' : '$_unreadNotifications', style: AppType.meta(Colors.white).copyWith(fontSize: 9, fontWeight: FontWeight.w800)),
                  ),
                ),
              ),
          ]),
          IconButton(tooltip: 'Settings', icon: const Icon(Icons.tune_rounded), onPressed: _openSettings),
          ValueListenableBuilder<User?>(
            valueListenable: ApiService().currentUserNotifier,
            builder: (context, user, _) {
              if (user == null) return const SizedBox.shrink();
              final name = user.displayName ?? user.username ?? user.email;
              final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
              return Padding(
                padding: const EdgeInsets.only(left: 4, right: 8),
                child: GestureDetector(
                  onTap: _openSettings,
                  child: Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: p.primarySoft,
                      shape: BoxShape.circle,
                      border: Border.all(color: p.border),
                    ),
                    child: Text(
                      initial,
                      style: AppType.card(p.primaryText).copyWith(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _FadeIndexedStack(
        index: _currentIndex,
        children: [
          MatrixScreen(key: _matrixKey),
          DayPlannerScreen(key: _plannerKey),
          TasksScreen(key: _tasksKey),
          NotesScreen(key: _notesKey),
        ],
      ),
      floatingActionButton: _CaptureFab(onPressed: _openQuickCapture),
      bottomNavigationBar: _BottomNav(
        index: _currentIndex,
        onTap: (idx) {
          if (idx == _currentIndex) return;
          HapticFeedback.selectionClick();
          setState(() => _currentIndex = idx);
          _refreshCurrentScreen();
        },
      ),
    );
  }
}

/// Keeps every tab alive (like IndexedStack) but cross-fades between them.
class _FadeIndexedStack extends StatelessWidget {
  final int index;
  final List<Widget> children;
  const _FadeIndexedStack({required this.index, required this.children});

  @override
  Widget build(BuildContext context) {
    return Stack(fit: StackFit.expand, children: [
      for (var i = 0; i < children.length; i++)
        IgnorePointer(
          ignoring: i != index,
          // The fade itself must keep ticking; only the hidden tab's own animations are paused.
          child: AnimatedOpacity(
            opacity: i == index ? 1 : 0,
            duration: Motion.base,
            curve: Curves.easeOut,
            child: AnimatedSlide(
              offset: i == index ? Offset.zero : const Offset(0, 0.015),
              duration: Motion.slow,
              curve: Motion.out,
              child: TickerMode(
                enabled: i == index,
                child: ExcludeSemantics(excluding: i != index, child: children[i]),
              ),
            ),
          ),
        ),
    ]);
  }
}

class _BottomNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const _BottomNav({required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      decoration: BoxDecoration(color: p.surface, border: Border(top: BorderSide(color: p.borderSubtle))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(children: [
            for (var i = 0; i < _tabs.length; i++)
              Expanded(
                child: Semantics(
                  selected: i == index,
                  button: true,
                  label: _tabs[i].label,
                  child: InkResponse(
                    onTap: () => onTap(i),
                    radius: 40,
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      AnimatedContainer(
                        duration: Motion.slow,
                        curve: Motion.spring,
                        width: i == index ? 56 : 36,
                        height: 30,
                        decoration: BoxDecoration(color: i == index ? p.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(Radii.full)),
                        child: AnimatedSwitcher(
                          duration: Motion.fast,
                          child: Icon(i == index ? _tabs[i].activeIcon : _tabs[i].icon, key: ValueKey(i == index), size: 21, color: i == index ? p.primaryText : p.text3),
                        ),
                      ),
                      const SizedBox(height: 3),
                      AnimatedDefaultTextStyle(
                        duration: Motion.fast,
                        style: AppType.meta(i == index ? p.text : p.text3).copyWith(fontWeight: i == index ? FontWeight.w700 : FontWeight.w500, fontSize: 11),
                        child: Text(_tabs[i].label),
                      ),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

class _CaptureFab extends StatelessWidget {
  final VoidCallback onPressed;
  const _CaptureFab({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Pressable(
      onTap: onPressed,
      scale: 0.92,
      child: Semantics(
        button: true,
        label: 'Quick capture',
        child: Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: p.primary,
            borderRadius: BorderRadius.circular(19),
            boxShadow: [
              BoxShadow(color: p.primary.withValues(alpha: 0.45), blurRadius: 18, offset: const Offset(0, 8)),
              BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 4, offset: const Offset(0, 2)),
            ],
          ),
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 24),
        ),
      ),
    );
  }
}
