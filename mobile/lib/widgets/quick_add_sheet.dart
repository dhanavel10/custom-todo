import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'ui.dart';

/// Minimal "type a title, press enter" sheet. Stays open after adding so several tasks can be entered.
Future<void> showQuickAddSheet(
  BuildContext context, {
  required String title,
  String? subtitle,
  required IconData icon,
  required Color color,
  required String hint,
  required Future<void> Function(String title) onSubmit,
}) {
  return showAppSheet(context, (ctx) => _QuickAddSheet(title: title, subtitle: subtitle, icon: icon, color: color, hint: hint, onSubmit: onSubmit));
}

class _QuickAddSheet extends StatefulWidget {
  final String title;
  final String? subtitle;
  final IconData icon;
  final Color color;
  final String hint;
  final Future<void> Function(String) onSubmit;
  const _QuickAddSheet({required this.title, this.subtitle, required this.icon, required this.color, required this.hint, required this.onSubmit});

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  bool _saving = false;
  final List<String> _added = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final v = _ctrl.text.trim();
    if (v.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSubmit(v);
      if (!mounted) return;
      setState(() {
        _added.insert(0, v);
        _ctrl.clear();
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not add the task. Check your connection.');
    } finally {
      if (mounted) setState(() => _saving = false);
      _focus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return SheetScaffold(
      title: widget.title,
      subtitle: widget.subtitle,
      icon: widget.icon,
      iconColor: widget.color,
      trailing: _added.isNotEmpty ? TextButton(onPressed: () => Navigator.pop(context), child: const Text('Done')) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        TextField(
          controller: _ctrl,
          focusNode: _focus,
          autofocus: true,
          enabled: !_saving,
          textInputAction: TextInputAction.done,
          textCapitalization: TextCapitalization.sentences,
          style: AppType.body(p.text).copyWith(fontSize: 16),
          decoration: InputDecoration(
            hintText: widget.hint,
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.md), borderSide: BorderSide(color: widget.color, width: 1.6)),
          ),
          onSubmitted: (_) => _submit(),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: AppType.caption(p.coral))),
        const SizedBox(height: 12),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: widget.color),
          onPressed: _ctrl.text.trim().isEmpty || _saving ? null : _submit,
          icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.add_rounded, size: 20),
          label: const Text('Add task'),
        ),
        if (_added.isNotEmpty) ...[
          const SizedBox(height: 14),
          for (final t in _added.take(4))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Icon(Icons.check_circle_rounded, size: 16, color: p.green),
                const SizedBox(width: 8),
                Expanded(child: Text(t, style: AppType.caption(p.text2), overflow: TextOverflow.ellipsis)),
              ]),
            ),
        ],
      ]),
    );
  }
}
