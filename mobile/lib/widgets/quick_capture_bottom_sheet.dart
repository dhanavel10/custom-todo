import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../theme/quadrants.dart';
import 'ui.dart';

const _suggestions = [
  'Submit the quarterly report by Friday 5pm',
  'Call the dentist tomorrow morning',
  'Renew passport before next month',
  'Pay electricity bill today',
  'Prepare slides for Monday standup',
];

class QuickCaptureBottomSheet extends StatefulWidget {
  final VoidCallback onCaptured;

  const QuickCaptureBottomSheet({super.key, required this.onCaptured});

  @override
  State<QuickCaptureBottomSheet> createState() => _QuickCaptureBottomSheetState();
}

class _QuickCaptureBottomSheetState extends State<QuickCaptureBottomSheet> {
  final TextEditingController _controller = TextEditingController();
  bool _isLoading = false;
  String? _error;
  Task? _result;
  bool _savedToInbox = false;
  int _hint = 0;
  Timer? _hintTimer;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
    _hintTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (_controller.text.isEmpty && mounted) setState(() => _hint = (_hint + 1) % _suggestions.length);
    });
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _isLoading) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _result = null;
      _savedToInbox = false;
    });

    try {
      final task = await ApiService().createCapture(text);
      HapticFeedback.mediumImpact();
      widget.onCaptured();
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _result = task;
        _savedToInbox = task == null;
        _controller.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = "Couldn't capture that. Check the server connection in Settings.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final hasText = _controller.text.trim().isNotEmpty;

    return SheetScaffold(
      title: 'Quick capture',
      subtitle: 'Write it naturally — dates and priority are detected.',
      icon: Icons.auto_awesome_rounded,
      trailing: IconButton(tooltip: 'Close', icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        AnimatedContainer(
          duration: Motion.base,
          decoration: BoxDecoration(
            color: p.surface2,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: hasText ? p.primary : p.border, width: hasText ? 1.6 : 1),
            boxShadow: hasText ? [BoxShadow(color: p.primary.withValues(alpha: 0.12), blurRadius: 0, spreadRadius: 4)] : null,
          ),
          padding: const EdgeInsets.fromLTRB(16, 6, 8, 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Stack(children: [
                if (!hasText)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: AnimatedSwitcher(
                          duration: Motion.slow,
                          transitionBuilder: (c, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, 0.4), end: Offset.zero).animate(a), child: c)),
                          child: Text(_suggestions[_hint], key: ValueKey(_hint), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(p.text3).copyWith(fontSize: 16)),
                        ),
                      ),
                    ),
                  ),
                TextField(
                  controller: _controller,
                  autofocus: true,
                  maxLines: 4,
                  minLines: 1,
                  enabled: !_isLoading,
                  textInputAction: TextInputAction.send,
                  textCapitalization: TextCapitalization.sentences,
                  style: AppType.body(p.text).copyWith(fontSize: 16),
                  decoration: const InputDecoration(border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none, filled: false, contentPadding: EdgeInsets.symmetric(vertical: 12)),
                  onSubmitted: (_) => _submit(),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: AnimatedContainer(
                duration: Motion.base,
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: hasText ? p.primary : p.sunken, borderRadius: BorderRadius.circular(13)),
                child: IconButton(
                  tooltip: 'Capture',
                  onPressed: hasText && !_isLoading ? _submit : null,
                  icon: _isLoading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                      : Icon(Icons.arrow_upward_rounded, color: hasText ? Colors.white : p.text3, size: 20),
                ),
              ),
            ),
          ]),
        ),
        if (_isLoading) ...[
          const SizedBox(height: 10),
          ClipRRect(borderRadius: BorderRadius.circular(2), child: LinearProgressIndicator(minHeight: 2, color: p.primary, backgroundColor: p.primarySoft)),
        ],
        AnimatedSize(
          duration: Motion.base,
          curve: Motion.out,
          child: _error != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: _Banner(color: p.coral, icon: Icons.error_outline_rounded, title: 'Capture failed', body: _error!),
                )
              : _result != null
                  ? Padding(padding: const EdgeInsets.only(top: 12), child: _ResultCard(task: _result!))
                  : _savedToInbox
                      ? Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: _Banner(color: p.primary, icon: Icons.inbox_rounded, title: 'Saved to Inbox', body: 'It looked like a note, so it was kept as a raw capture.'),
                        )
                      : const SizedBox(width: double.infinity),
        ),
        const SizedBox(height: 14),
        Text('TRY', style: AppType.eyebrow(p.text3)),
        const SizedBox(height: 8),
        SizedBox(
          height: 34,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _suggestions.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) => ActionChip(
              label: Text(_suggestions[i]),
              labelStyle: AppType.caption(p.text2).copyWith(fontWeight: FontWeight.w500),
              backgroundColor: p.surface2,
              side: BorderSide(color: p.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.full)),
              onPressed: () {
                _controller.text = _suggestions[i];
                _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
              },
            ),
          ),
        ),
      ]),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final Task task;
  const _ResultCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final q = quadrantFor(task.eisenhowerQuadrant);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.9, end: 1),
      duration: Motion.slow,
      curve: Motion.spring,
      builder: (context, s, child) => Transform.scale(scale: s, child: child),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: p.soft(p.green), borderRadius: BorderRadius.circular(Radii.md)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 28, height: 28, decoration: BoxDecoration(color: p.green, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, color: Colors.white, size: 17)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(task.title, style: AppType.card(p.text), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Wrap(spacing: 5, runSpacing: 5, children: [
                QuadrantTag(task.eisenhowerQuadrant),
                if (task.dueAt != null) DueTag(task),
                if (task.category != null) Tag(task.category!, icon: Icons.tag_rounded, outline: true),
              ]),
              const SizedBox(height: 6),
              Text(q == null ? 'Added to your tasks.' : 'Filed under ${q.name} — ${q.tagline.toLowerCase()}.', style: AppType.meta(p.text2)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String title;
  final String body;
  const _Banner({required this.color, required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: p.soft(color), borderRadius: BorderRadius.circular(Radii.md)),
      child: Row(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: AppType.card(p.text).copyWith(fontSize: 13.5)),
            Text(body, style: AppType.caption(p.text2)),
          ]),
        ),
      ]),
    );
  }
}
