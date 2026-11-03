import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/note.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class NotesScreen extends StatefulWidget {
  const NotesScreen({super.key});

  @override
  State<NotesScreen> createState() => NotesScreenState();
}

class NotesScreenState extends State<NotesScreen> {
  List<Note> _notes = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() => _isLoading = true);
    try {
      final list = await ApiService().fetchNotes();
      if (mounted) {
        setState(() {
          _notes = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddNoteDialog() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Text(
          'Create Note',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.heading),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: const InputDecoration(
                hintText: 'Title (optional)',
                hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: contentCtrl,
              maxLines: 4,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: const InputDecoration(
                hintText: 'Write your thoughts or scratchpad notes...',
                hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
          ElevatedButton(
            onPressed: () async {
              final content = contentCtrl.text.trim();
              if (content.isNotEmpty) {
                Navigator.pop(ctx);
                await ApiService().createNote(
                  title: titleCtrl.text.trim().isEmpty ? null : titleCtrl.text.trim(),
                  content: content,
                );
                refresh();
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Save Note', style: TextStyle(color: Colors.white, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteNote(String id) async {
    await ApiService().deleteNote(id);
    refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Notes Action Header
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            children: [
              Text(
                'Scratchpad & Notes (${_notes.length})',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.heading),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: _showAddNoteDialog,
                icon: const Icon(Icons.add, size: 14),
                label: const Text('New Note', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: AppColors.border),

        // Notes List
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              : RefreshIndicator(
                  onRefresh: refresh,
                  color: AppColors.primary,
                  child: _notes.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.description_outlined, size: 36, color: AppColors.textMuted.withValues(alpha: 0.4)),
                              const SizedBox(height: 8),
                              const Text('No notes yet', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: _showAddNoteDialog,
                                icon: const Icon(Icons.add, size: 14, color: AppColors.primary),
                                label: const Text('Create First Note', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: AppColors.border),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 80),
                          itemCount: _notes.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final note = _notes[idx];
                            DateTime? dt;
                            try {
                              dt = DateTime.parse(note.createdAt);
                            } catch (_) {}
                            final dateText = dt != null ? DateFormat('MMM d, yyyy').format(dt) : '';

                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      if (note.title != null && note.title!.isNotEmpty)
                                        Expanded(
                                          child: Text(
                                            note.title!,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                              color: AppColors.heading,
                                            ),
                                          ),
                                        ),
                                      const Spacer(),
                                      Text(dateText, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                      const SizedBox(width: 4),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.textMuted),
                                        onPressed: () => _deleteNote(note.id),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    note.content,
                                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }
}
