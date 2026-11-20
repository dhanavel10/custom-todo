import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/task.dart';
import '../theme/app_theme.dart';
import '../theme/quadrants.dart';

/* ============================================================
   Shared UI building blocks — one implementation per pattern.
   ============================================================ */

/// Subtle scale-down on press for any tappable surface.
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = 0.97});

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;
  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (_) => _set(true) : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      onTap: widget.onTap,
      onLongPress: widget.onLongPress == null
          ? null
          : () {
              HapticFeedback.mediumImpact();
              _set(false);
              widget.onLongPress!();
            },
      child: AnimatedScale(scale: _down ? widget.scale : 1, duration: Motion.fast, curve: Motion.out, child: widget.child),
    );
  }
}

/// Compact pill used for metadata.
class Tag extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color? color;
  final bool dot;
  final bool outline;
  final VoidCallback? onTap;
  const Tag(this.label, {super.key, this.icon, this.color, this.dot = false, this.outline = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final c = color ?? p.text2;
    final child = Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: BoxDecoration(
        color: outline ? Colors.transparent : (color == null ? p.sunken : p.soft(c)),
        borderRadius: BorderRadius.circular(Radii.xs),
        border: outline ? Border.all(color: p.border) : null,
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (dot) ...[Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle)), const SizedBox(width: 5)],
        if (icon != null) ...[Icon(icon, size: 12, color: c), const SizedBox(width: 4)],
        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(c).copyWith(fontSize: 11, fontWeight: FontWeight.w600))),
      ]),
    );
    return onTap == null ? child : GestureDetector(onTap: onTap, child: child);
  }
}

class QuadrantTag extends StatelessWidget {
  final String? quadrant;
  const QuadrantTag(this.quadrant, {super.key});
  @override
  Widget build(BuildContext context) {
    final q = quadrantFor(quadrant);
    if (q == null) return Tag('Inbox', color: context.palette.slate, dot: true);
    return Tag(q.name, color: q.colorOf(context.palette), dot: true);
  }
}

/// "Today 6:00 PM", "Tomorrow 9:00 AM", "Fri 10:00 AM", "Mar 4".
String formatDue(DateTime d, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final days = DateTime(d.year, d.month, d.day).difference(DateTime(n.year, n.month, n.day)).inDays;
  final t = DateFormat('h:mm a').format(d);
  if (days == 0) return 'Today $t';
  if (days == 1) return 'Tomorrow $t';
  if (days == -1) return 'Yesterday $t';
  if (days > 1 && days < 7) return '${DateFormat('EEE').format(d)} $t';
  return DateFormat(d.year == n.year ? 'MMM d' : 'MMM d, y').format(d);
}

DateTime? parseDate(String? iso) {
  if (iso == null) return null;
  try {
    return DateTime.parse(iso).toLocal();
  } catch (_) {
    return null;
  }
}

class DueTag extends StatelessWidget {
  final Task task;
  const DueTag(this.task, {super.key});
  @override
  Widget build(BuildContext context) {
    final d = parseDate(task.dueAt);
    if (d == null) return const SizedBox.shrink();
    final p = context.palette;
    final now = DateTime.now();
    final overdue = !task.isCompleted && d.isBefore(now);
    final today = DateUtils.isSameDay(d, now);
    final c = overdue ? p.coral : (today && !task.isCompleted ? p.amber : null);
    return Tag('${formatDue(d)}${task.isDeadline ? ' · deadline' : ''}', icon: Icons.schedule_rounded, color: c);
  }
}

/// Animated circular completion check. Plays a pop + check draw before reporting completion.
class TaskCheck extends StatefulWidget {
  final bool checked;
  final ValueChanged<bool> onChanged;
  final Color? ring;
  final double size;
  const TaskCheck({super.key, required this.checked, required this.onChanged, this.ring, this.size = 22});

  @override
  State<TaskCheck> createState() => _TaskCheckState();
}

class _TaskCheckState extends State<TaskCheck> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 380), value: widget.checked ? 1 : 0);
  bool _busy = false;

  @override
  void didUpdateWidget(covariant TaskCheck old) {
    super.didUpdateWidget(old);
    if (!_busy) _c.value = widget.checked ? 1 : 0;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<void> _tap() async {
    if (_busy) return;
    HapticFeedback.lightImpact();
    if (widget.checked) {
      _c.value = 0;
      widget.onChanged(false);
      return;
    }
    _busy = true;
    await _c.forward(from: 0);
    _busy = false;
    widget.onChanged(true);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = widget.size;
    return Semantics(
      checked: widget.checked,
      button: true,
      label: widget.checked ? 'Mark as not done' : 'Mark as done',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _tap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final v = Curves.easeOut.transform(_c.value);
                final pop = 1 + 0.18 * math.sin(math.pi * _c.value);
                return Transform.scale(
                  scale: pop,
                  child: Container(
                    width: s,
                    height: s,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color.lerp(Colors.transparent, p.green, v),
                      border: Border.all(color: Color.lerp(widget.ring ?? p.borderStrong, p.green, v)!, width: 1.8),
                    ),
                    child: CustomPaint(painter: _CheckPainter(progress: v, color: Colors.white)),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _CheckPainter extends CustomPainter {
  final double progress;
  final Color color;
  _CheckPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final path = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.44, size.height * 0.67)
      ..lineTo(size.width * 0.73, size.height * 0.36);
    final metric = path.computeMetrics().first;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(metric.extractPath(0, metric.length * progress), paint);
  }

  @override
  bool shouldRepaint(covariant _CheckPainter old) => old.progress != progress || old.color != color;
}

/// Animated progress ring.
class ProgressRing extends StatelessWidget {
  final double value; // 0..1
  final double size;
  final double stroke;
  final Color? color;
  final Widget? center;
  const ProgressRing({super.key, required this.value, this.size = 56, this.stroke = 6, this.color, this.center});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0, 1)),
      duration: const Duration(milliseconds: 800),
      curve: Motion.out,
      builder: (context, v, _) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _RingPainter(v, stroke, color ?? p.primary, p.sunken),
          child: Center(child: center),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double v;
  final double stroke;
  final Color fg;
  final Color bg;
  _RingPainter(this.v, this.stroke, this.fg, this.bg);

  @override
  void paint(Canvas canvas, Size size) {
    final r = (size.shortestSide - stroke) / 2;
    final c = size.center(Offset.zero);
    final track = Paint()
      ..color = bg
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawCircle(c, r, track);
    if (v <= 0) return;
    final arc = Paint()
      ..color = fg
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2, 2 * math.pi * v, false, arc);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.v != v || old.fg != fg || old.bg != bg;
}

/// Gently floating icon used by empty states.
class _FloatingIcon extends StatefulWidget {
  final IconData icon;
  final Color color;
  const _FloatingIcon(this.icon, this.color);
  @override
  State<_FloatingIcon> createState() => _FloatingIconState();
}

class _FloatingIconState extends State<_FloatingIcon> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Transform.translate(offset: Offset(0, -4 * Curves.easeInOut.transform(_c.value)), child: child),
      child: SizedBox(
        width: 68,
        height: 68,
        child: Stack(alignment: Alignment.center, children: [
          Transform.rotate(
            angle: -0.14,
            child: Container(width: 64, height: 64, decoration: BoxDecoration(color: p.soft(widget.color), borderRadius: BorderRadius.circular(20))),
          ),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: p.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: p.isDark ? 0.4 : 0.07), blurRadius: 14, offset: const Offset(0, 4))],
            ),
            child: Icon(widget.icon, color: widget.color, size: 24),
          ),
        ]),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Color? tone;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.tone, this.action});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.slow,
      curve: Motion.out,
      builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _FloatingIcon(icon, tone ?? p.primaryText),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: AppType.section(p.text)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: AppType.caption(p.text2).copyWith(fontSize: 13.5, height: 1.5)),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ]),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const ErrorState({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return EmptyState(
      icon: Icons.cloud_off_rounded,
      tone: p.amber,
      title: "Can't reach the server",
      message: message,
      action: FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded, size: 18), label: const Text('Retry connection')),
    );
  }
}

/// Shimmering placeholder rows shown while loading.
class SkeletonList extends StatefulWidget {
  final int rows;
  const SkeletonList({super.key, this.rows = 6});
  @override
  State<SkeletonList> createState() => _SkeletonListState();
}

class _SkeletonListState extends State<SkeletonList> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget bar(double w, double h) => AnimatedBuilder(
          animation: _c,
          builder: (context, _) => Container(
            width: w,
            height: h,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              gradient: LinearGradient(
                begin: Alignment(-1.5 + 3 * _c.value, 0),
                end: Alignment(-0.5 + 3 * _c.value, 0),
                colors: [p.sunken, p.surface2, p.sunken],
              ),
            ),
          ),
        );
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      itemCount: widget.rows,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: p.borderSubtle)),
        child: Row(children: [
          Container(width: 22, height: 22, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: p.sunken, width: 2))),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              bar(160.0 + (i * 37) % 90, 12),
              const SizedBox(height: 8),
              bar(70.0 + (i * 23) % 50, 10),
            ]),
          ),
        ]),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  final String text;
  final IconData? icon;
  final int? count;
  final Color? color;
  final Widget? trailing;
  const SectionLabel(this.text, {super.key, this.icon, this.count, this.color, this.trailing});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final c = color ?? p.text3;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
      child: Row(children: [
        if (icon != null) ...[Icon(icon, size: 14, color: c), const SizedBox(width: 6)],
        Text(text.toUpperCase(), style: AppType.eyebrow(c)),
        if (count != null) ...[const SizedBox(width: 8), CountPill(count!)],
        const SizedBox(width: 10),
        Expanded(child: Container(height: 1, color: p.borderSubtle)),
        if (trailing != null) ...[const SizedBox(width: 8), trailing!],
      ]),
    );
  }
}

class CountPill extends StatelessWidget {
  final int count;
  final Color? color;
  const CountPill(this.count, {super.key, this.color});
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color == null ? p.sunken : p.soft(color!), borderRadius: BorderRadius.circular(Radii.full)),
      child: Text('$count', style: AppType.meta(color ?? p.text2).copyWith(fontSize: 10.5, fontWeight: FontWeight.w700)),
    );
  }
}

/// Standard bottom-sheet body: drag handle, header, keyboard-aware padding.
class SheetScaffold extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;
  final Widget child;
  final Widget? trailing;
  final bool scrollable;
  /// Fill the available height (parent must be bounded) — for lists.
  final bool expand;
  const SheetScaffold({super.key, this.title, this.subtitle, this.icon, this.iconColor, required this.child, this.trailing, this.scrollable = false, this.expand = false});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final inset = MediaQuery.of(context).viewInsets.bottom;
    final safe = MediaQuery.of(context).padding.bottom;
    final body = Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + (inset > 0 ? inset : safe)),
      child: child,
    );
    return Column(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Center(
        child: Container(margin: const EdgeInsets.only(top: 10, bottom: 6), width: 38, height: 4, decoration: BoxDecoration(color: p.borderStrong, borderRadius: BorderRadius.circular(4))),
      ),
      if (title != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 12, 12),
          child: Row(children: [
            if (icon != null) ...[
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: p.soft(iconColor ?? p.primary), borderRadius: BorderRadius.circular(11)),
                child: Icon(icon, size: 19, color: iconColor ?? p.primaryText),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title!, style: AppType.section(p.text).copyWith(fontSize: 17)),
                if (subtitle != null) Text(subtitle!, style: AppType.caption(p.text3), maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            ?trailing,
          ]),
        ),
      if (scrollable)
        Flexible(child: SingleChildScrollView(child: body))
      else if (expand)
        Expanded(child: body)
      else
        body,
    ]);
  }
}

/// Opens a modal bottom sheet with the app's standard styling.
Future<T?> showAppSheet<T>(BuildContext context, WidgetBuilder builder, {bool expand = false}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    sheetAnimationStyle: AnimationStyle(duration: const Duration(milliseconds: 320), reverseDuration: const Duration(milliseconds: 220), curve: Motion.out),
    constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * (expand ? 0.92 : 0.88)),
    builder: builder,
  );
}

/// Confirmation dialog. Returns true when confirmed.
Future<bool> showConfirm(BuildContext context, {required String title, String? message, String confirmLabel = 'Confirm', bool danger = false}) async {
  final p = context.palette;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(color: p.soft(danger ? p.coral : p.amber), borderRadius: BorderRadius.circular(13)),
        child: Icon(danger ? Icons.delete_outline_rounded : Icons.help_outline_rounded, color: danger ? p.coral : p.amber, size: 22),
      ),
      title: Text(title, textAlign: TextAlign.center),
      content: message == null ? null : Text(message, textAlign: TextAlign.center),
      actionsAlignment: MainAxisAlignment.center,
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      actions: [
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel'))),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton(
              style: danger ? FilledButton.styleFrom(backgroundColor: p.coral) : null,
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(confirmLabel),
            ),
          ),
        ]),
      ],
    ),
  );
  return ok ?? false;
}

/// Floating toast with an icon.
void showToast(BuildContext context, String message, {IconData icon = Icons.check_circle_rounded, Color? color, SnackBarAction? action}) {
  final p = context.palette;
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    duration: const Duration(seconds: 3),
    action: action,
    content: Row(children: [
      Icon(icon, size: 18, color: color ?? p.green),
      const SizedBox(width: 10),
      Expanded(child: Text(message)),
    ]),
  ));
}
