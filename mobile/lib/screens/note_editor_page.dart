import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/note.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/markdown_view.dart';
import '../widgets/ui.dart';

/// Full-screen note editor for creating and editing notes.
class NoteEditorPage extends StatefulWidget {
  final Note? note;
  const NoteEditorPage({super.key, this.note});

  @override
  State<NoteEditorPage> createState() => _NoteEditorPageState();
}

class _NoteEditorPageState extends State<NoteEditorPage> {
  late final TextEditingController _title = TextEditingController(text: widget.note?.title ?? '');
  late final TextEditingController _body = TextEditingController(text: widget.note?.content ?? '');
  final _bodyFocus = FocusNode();
  bool _preview = false;
  bool _saving = false;
  late String _savedTitle = widget.note?.title ?? '';
  late String _savedBody = widget.note?.content ?? '';

  bool get _dirty => _title.text != _savedTitle || _body.text != _savedBody;
  bool get _isNew => widget.note == null;

  @override
  void initState() {
    super.initState();
    _title.addListener(() => setState(() {}));
    _body.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _bodyFocus.dispose();
    super.dispose();
  }

  Future<bool> _save({bool close = true}) async {
    final content = _body.text.trim();
    if (content.isEmpty) {
      showToast(context, 'Write something before saving', icon: Icons.edit_note_rounded, color: context.palette.amber);
      return false;
    }
    setState(() => _saving = true);
    try {
      final title = _title.text.trim().isEmpty ? null : _title.text.trim();
      if (_isNew) {
        await ApiService().createNote(title: title, content: content);
      } else {
        await ApiService().updateNote(widget.note!.id, title: title, content: content);
      }
      HapticFeedback.lightImpact();
      _savedTitle = _title.text;
      _savedBody = _body.text;
      if (!mounted) return true;
      if (close) Navigator.pop(context, true);
      return true;
    } catch (_) {
      if (mounted) showToast(context, "Couldn't save the note", icon: Icons.error_outline_rounded, color: context.palette.coral);
      return false;
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showConfirm(context, title: 'Delete this note?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true);
    if (!ok) return;
    await ApiService().deleteNote(widget.note!.id);
    if (mounted) Navigator.pop(context, true);
  }

  /// "Save Note" prompt when leaving with unsaved changes.
  Future<void> _handleLeave() async {
    if (!_dirty || _body.text.trim().isEmpty) {
      Navigator.pop(context, false);
      return;
    }
    final p = context.palette;
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(13)),
          child: Icon(Icons.save_outlined, color: p.primaryText, size: 22),
        ),
        title: const Text('Save this note?', textAlign: TextAlign.center),
        content: const Text('You have unsaved changes.', textAlign: TextAlign.center),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FilledButton(onPressed: () => Navigator.pop(ctx, 'save'), child: const Text('Save note')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: () => Navigator.pop(ctx, 'discard'), style: OutlinedButton.styleFrom(foregroundColor: p.coral), child: const Text('Discard changes')),
            TextButton(onPressed: () => Navigator.pop(ctx, 'cancel'), child: const Text('Keep editing')),
          ]),
        ],
      ),
    );
    if (!mounted) return;
    if (choice == 'save') {
      await _save();
    } else if (choice == 'discard') {
      Navigator.pop(context, false);
    }
  }

  void _wrapSelection(String left, String right, String placeholder) {
    final sel = _body.selection;
    final text = _body.text;
    final start = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    final inner = start == end ? placeholder : text.substring(start, end);
    final next = text.replaceRange(start, end, '$left$inner$right');
    _body.value = TextEditingValue(text: next, selection: TextSelection(baseOffset: start + left.length, extentOffset: start + left.length + inner.length));
    _bodyFocus.requestFocus();
  }

  void _prefixLine(String prefix) {
    final sel = _body.selection;
    final text = _body.text;
    final pos = sel.isValid ? sel.start : text.length;
    final lineStart = pos == 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
    final next = text.replaceRange(lineStart, lineStart, prefix);
    _body.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: pos + prefix.length));
    _bodyFocus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final words = _body.text.trim().isEmpty ? 0 : _body.text.trim().split(RegExp(r'\s+')).length;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleLeave();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(tooltip: 'Back', icon: const Icon(Icons.arrow_back_rounded), onPressed: _handleLeave),
          titleSpacing: 0,
          title: AnimatedSwitcher(
            duration: Motion.fast,
            child: Text(
              _saving ? 'Saving…' : (_dirty ? 'Unsaved changes' : (_isNew ? 'New note' : 'Saved')),
              key: ValueKey('$_saving$_dirty'),
              style: AppType.caption(_dirty ? p.amber : p.text3).copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          actions: [
            IconButton(
              tooltip: _preview ? 'Edit' : 'Preview',
              icon: Icon(_preview ? Icons.edit_rounded : Icons.visibility_outlined),
              onPressed: () => setState(() => _preview = !_preview),
            ),
            if (!_isNew) IconButton(tooltip: 'Delete note', icon: Icon(Icons.delete_outline_rounded, color: p.coral), onPressed: _delete),
            Padding(
              padding: const EdgeInsets.only(right: 12, left: 4),
              child: FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 16)),
                onPressed: _saving || _body.text.trim().isEmpty ? null : () => _save(),
                child: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save'),
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Column(children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(22, 8, 22, 24),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  TextField(
                    controller: _title,
                    readOnly: _preview,
                    textCapitalization: TextCapitalization.sentences,
                    style: AppType.serif(p.text, size: 30, weight: FontWeight.w600).copyWith(height: 1.2),
                    decoration: InputDecoration(
                      hintText: 'Untitled',
                      hintStyle: AppType.serif(p.text3, size: 30, weight: FontWeight.w500).copyWith(height: 1.2),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onSubmitted: (_) => _bodyFocus.requestFocus(),
                  ),
                  const SizedBox(height: 6),
                  Text('$words ${words == 1 ? 'word' : 'words'}${widget.note != null ? ' · created ${formatDue(parseDate(widget.note!.createdAt) ?? DateTime.now())}' : ''}', style: AppType.meta(p.text3)),
                  const SizedBox(height: 16),
                  AnimatedSwitcher(
                    duration: Motion.base,
                    child: _preview
                        ? Align(
                            key: const ValueKey('preview'),
                            alignment: Alignment.topLeft,
                            child: _body.text.trim().isEmpty ? Text('Nothing to preview yet.', style: AppType.serif(p.text3)) : MarkdownView(_body.text),
                          )
                        : TextField(
                            key: const ValueKey('write'),
                            controller: _body,
                            focusNode: _bodyFocus,
                            autofocus: _isNew,
                            maxLines: null,
                            minLines: 12,
                            keyboardType: TextInputType.multiline,
                            textCapitalization: TextCapitalization.sentences,
                            style: AppType.serif(p.text, size: 18),
                            decoration: InputDecoration(
                              hintText: 'Start writing…\n\nMarkdown works: # heading, **bold**, - lists, - [ ] checklists.',
                              hintStyle: AppType.serif(p.text3, size: 18),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              filled: false,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                  ),
                ],
              ),
            ),
            if (!_preview)
              Container(
                decoration: BoxDecoration(color: p.surface, border: Border(top: BorderSide(color: p.borderSubtle))),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _tool(Icons.format_bold_rounded, 'Bold', () => _wrapSelection('**', '**', 'bold')),
                    _tool(Icons.format_italic_rounded, 'Italic', () => _wrapSelection('*', '*', 'italic')),
                    _tool(Icons.title_rounded, 'Heading', () => _prefixLine('## ')),
                    _tool(Icons.format_list_bulleted_rounded, 'Bullet list', () => _prefixLine('- ')),
                    _tool(Icons.checklist_rounded, 'Checklist', () => _prefixLine('- [ ] ')),
                    _tool(Icons.format_quote_rounded, 'Quote', () => _prefixLine('> ')),
                    _tool(Icons.code_rounded, 'Code', () => _wrapSelection('`', '`', 'code')),
                  ]),
                ),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _tool(IconData icon, String label, VoidCallback onTap) => IconButton(tooltip: label, icon: Icon(icon, size: 22), onPressed: onTap);
}
