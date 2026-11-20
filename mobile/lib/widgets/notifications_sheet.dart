import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/notification_item.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'ui.dart';

class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({super.key});

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  List<NotificationItem> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    final items = await ApiService().fetchNotifications();
    if (mounted) {
      setState(() {
        _notifications = items;
        _isLoading = false;
      });
    }
  }

  Future<void> _markRead(NotificationItem item) async {
    await ApiService().markNotificationRead(item.id);
    _loadNotifications();
  }

  Future<void> _markAll() async {
    await ApiService().markAllNotificationsRead();
    _loadNotifications();
  }

  String _relative(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final unread = _notifications.where((n) => !n.isRead).length;
    final now = DateTime.now();
    final today = <NotificationItem>[];
    final earlier = <NotificationItem>[];
    for (final n in _notifications) {
      final d = parseDate(n.createdAt);
      (d != null && DateUtils.isSameDay(d, now) ? today : earlier).add(n);
    }

    Widget tile(NotificationItem item, int i) {
      final d = parseDate(item.createdAt);
      final (IconData icon, Color c) = switch (item.kind) {
        'study' => (Icons.school_rounded, p.teal),
        'review' => (Icons.wb_twilight_rounded, p.amber),
        _ => (Icons.notifications_active_rounded, p.primary),
      };
      return TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Duration(milliseconds: 260 + 30 * i.clamp(0, 10)),
        curve: Motion.out,
        builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child)),
        child: Pressable(
          onTap: item.isRead ? null : () => _markRead(item),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: item.isRead ? Colors.transparent : p.surface2,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: item.isRead ? p.borderSubtle : p.border),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: item.isRead ? p.sunken : p.soft(c), borderRadius: BorderRadius.circular(11)),
                child: Icon(icon, size: 18, color: item.isRead ? p.text3 : c),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(item.title, style: AppType.card(p.text).copyWith(fontSize: 13.5, fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700))),
                    if (d != null) Text(_relative(d), style: AppType.meta(p.text3)),
                  ]),
                  if (item.message.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(item.message, style: AppType.caption(p.text2).copyWith(height: 1.45)),
                  ],
                ]),
              ),
              if (!item.isRead) ...[
                const SizedBox(width: 6),
                Padding(padding: const EdgeInsets.only(top: 6), child: Container(width: 8, height: 8, decoration: BoxDecoration(color: p.primary, shape: BoxShape.circle))),
              ],
            ]),
          ),
        ),
      );
    }

    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.75,
      child: SheetScaffold(
        expand: true,
        title: 'Notifications',
        subtitle: unread > 0 ? '$unread unread · tap one to mark it read' : 'Reminders, reviews and study nudges',
        icon: Icons.notifications_rounded,
        trailing: unread > 0 ? TextButton.icon(onPressed: _markAll, icon: const Icon(Icons.done_all_rounded, size: 18), label: const Text('Read all')) : null,
        child: SizedBox(
          child: _isLoading
              ? const SkeletonList(rows: 4)
              : _notifications.isEmpty
                  ? Center(child: EmptyState(icon: Icons.notifications_off_outlined, title: 'All caught up', message: 'Reminders and daily reviews will show up here.'))
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      child: ListView(padding: EdgeInsets.zero, children: [
                        if (today.isNotEmpty) ...[SectionLabel('Today', count: today.length), ...today.asMap().entries.map((e) => tile(e.value, e.key))],
                        if (earlier.isNotEmpty) ...[SectionLabel('Earlier'), ...earlier.asMap().entries.map((e) => tile(e.value, e.key + today.length))],
                      ]),
                    ),
        ),
      ),
    );
  }
}
