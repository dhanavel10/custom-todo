import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/note.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/markdown_view.dart';
import '../widgets/ui.dart';
import 'note_editor_page.dart';

class NotesScreen extends StatefulWidget {
  const NotesScreen({super.key});

  @override
  State<NotesScreen> createState() => NotesScreenState();
}

class NotesScreenState extends State<NotesScreen> {
  List<Note> _notes = [];
  bool _isLoading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    if (_notes.isEmpty) setState(() => _isLoading = true);
    try {
      final list = await ApiService().fetchNotes();
      if (mounted) {
        setState(() {
          _notes = list;
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

  Future<void> _openEditor([Note? note]) async {
    final changed = await Navigator.of(context).push<bool>(
      PageRouteBuilder(
        transitionDuration: Motion.slow,
        reverseTransitionDuration: Motion.base,
        pageBuilder: (_, _, _) => NoteEditorPage(note: note),
        transitionsBuilder: (_, a, _, child) => FadeTransition(
          opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
          child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Motion.out)), child: child),
        ),
      ),
    );
    if (changed == true) {
      refresh();
      if (mounted) showToast(context, note == null ? 'Note saved' : 'Note updated', icon: Icons.sticky_note_2_rounded, color: context.palette.amber);
    }
  }

  Future<void> _deleteNote(Note note) async {
    final ok = await showConfirm(context, title: 'Delete this note?', message: note.title?.isNotEmpty == true ? '“${note.title}” will be removed.' : 'This cannot be undone.', confirmLabel: 'Delete', danger: true);
    if (!ok) return;
    await ApiService().deleteNote(note.id);
    if (mounted) showToast(context, 'Note deleted', icon: Icons.delete_outline_rounded, color: context.palette.text3);
    refresh();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    if (_isLoading) return const SkeletonList(rows: 4);
    if (_failed && _notes.isEmpty) return Center(child: SingleChildScrollView(child: ErrorState(message: 'Check the server URL in Settings, then retry.', onRetry: refresh)));

    final pinned = _notes.where((n) => n.isPinned).toList();
    final others = _notes.where((n) => !n.isPinned).toList();

    Widget grid(List<Note> notes, {bool withNew = false}) {
      // Two balanced columns (simple masonry by estimated height)
      final cols = [<Widget>[], <Widget>[]];
      final heights = [0.0, 0.0];
      final items = <Widget>[if (withNew) _NewNoteCard(onTap: () => _openEditor())];
      final weights = <double>[if (withNew) 120];
      for (final n in notes) {
        items.add(_NoteCard(note: n, onTap: () => _openEditor(n), onDelete: () => _deleteNote(n)));
        weights.add(90 + (stripMarkdown(n.content).length.clamp(0, 260)) * 0.45 + ((n.title?.isNotEmpty ?? false) ? 28 : 0));
      }
      for (var i = 0; i < items.length; i++) {
        final c = heights[0] <= heights[1] ? 0 : 1;
        cols[c].add(Padding(padding: const EdgeInsets.only(bottom: 10), child: items[i]));
        heights[c] += weights[i];
      }
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(children: cols[0])),
        const SizedBox(width: 10),
        Expanded(child: Column(children: cols[1])),
      ]);
    }

    return RefreshIndicator(
      onRefresh: refresh,
      child: _notes.isEmpty
          ? ListView(children: [
              const SizedBox(height: 32),
              EmptyState(
                icon: Icons.history_edu_rounded,
                tone: p.amber,
                title: 'Your notebook is empty',
                message: 'A quiet place for half-formed ideas, meeting notes and plans. Markdown welcome.',
                action: FilledButton.icon(onPressed: () => _openEditor(), icon: const Icon(Icons.edit_rounded, size: 18), label: const Text('Write your first note')),
              ),
            ])
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 110),
              children: [
                Row(children: [
                  Text('${_notes.length} ${_notes.length == 1 ? 'note' : 'notes'}', style: AppType.caption(p.text3)),
                  const Spacer(),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14)),
                    onPressed: () => _openEditor(),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('New note'),
                  ),
                ]),
                if (pinned.isNotEmpty) ...[
                  SectionLabel('Pinned', icon: Icons.push_pin_rounded, color: p.amber),
                  grid(pinned),
                  if (others.isNotEmpty) const SectionLabel('Everything else'),
                ] else
                  const SizedBox(height: 12),
                grid(others),
              ],
            ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final Note note;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  const _NoteCard({required this.note, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final preview = stripMarkdown(note.content);
    final updated = parseDate(note.updatedAt);
    final hasTitle = note.title != null && note.title!.trim().isNotEmpty;
    final checks = RegExp(r'^\s*[-*+]\s+\[( |x|X)\]', multiLine: true).allMatches(note.content).length;
    final done = RegExp(r'^\s*[-*+]\s+\[(x|X)\]', multiLine: true).allMatches(note.content).length;

    return Pressable(
      onTap: onTap,
      onLongPress: onDelete,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        decoration: BoxDecoration(
          color: note.isPinned ? Color.alphaBlend(p.amber.withValues(alpha: p.isDark ? 0.08 : 0.05), p.surface) : p.surface,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: note.isPinned ? p.amber.withValues(alpha: 0.3) : p.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Text(
                hasTitle ? note.title! : 'Untitled',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppType.serif(hasTitle ? p.text : p.text3, size: 17, weight: FontWeight.w600).copyWith(height: 1.25, fontStyle: hasTitle ? null : FontStyle.italic),
              ),
            ),
            if (note.isPinned) Padding(padding: const EdgeInsets.only(left: 4, top: 2), child: Icon(Icons.push_pin_rounded, size: 14, color: p.amber)),
          ]),
          if (preview.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(preview, maxLines: 7, overflow: TextOverflow.ellipsis, style: AppType.caption(p.text2).copyWith(fontSize: 13, height: 1.5)),
          ],
          if (checks > 0) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(value: done / checks, minHeight: 4, color: p.green, backgroundColor: p.sunken))),
              const SizedBox(width: 8),
              Text('$done/$checks', style: AppType.mono(p.text3, size: 10)),
            ]),
          ],
          const SizedBox(height: 10),
          Text(updated != null ? DateFormat('MMM d').format(updated) : '', style: AppType.meta(p.text3)),
        ]),
      ),
    );
  }
}

class _NewNoteCard extends StatelessWidget {
  final VoidCallback onTap;
  const _NewNoteCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: 110,
        width: double.infinity,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: p.borderStrong)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.add_rounded, color: p.primaryText),
          const SizedBox(height: 4),
          Text('New note', style: AppType.card(p.text2).copyWith(fontSize: 13)),
        ]),
      ),
    );
  }
}
