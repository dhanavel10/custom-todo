import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Lightweight Markdown preview (headings, lists, checklists, quotes, code, bold/italic/inline code).
/// Mirrors client/src/lib/markdown.tsx so notes look the same on both platforms.
class MarkdownView extends StatelessWidget {
  final String source;
  const MarkdownView(this.source, {super.key});

  static final _inline = RegExp(r'(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)');

  List<InlineSpan> _spans(String text, TextStyle base, Palette p) {
    final out = <InlineSpan>[];
    var last = 0;
    for (final m in _inline.allMatches(text)) {
      if (m.start > last) out.add(TextSpan(text: text.substring(last, m.start)));
      final tok = m.group(0)!;
      if (tok.startsWith('`')) {
        out.add(TextSpan(text: tok.substring(1, tok.length - 1), style: AppType.mono(p.text, size: base.fontSize! * 0.8).copyWith(backgroundColor: p.sunken)));
      } else if (tok.startsWith('**') || tok.startsWith('__')) {
        out.add(TextSpan(text: tok.substring(2, tok.length - 2), style: const TextStyle(fontWeight: FontWeight.w700)));
      } else {
        out.add(TextSpan(text: tok.substring(1, tok.length - 1), style: const TextStyle(fontStyle: FontStyle.italic)));
      }
      last = m.end;
    }
    if (last < text.length) out.add(TextSpan(text: text.substring(last)));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final body = AppType.serif(p.text, size: 18);
    final lines = source.replaceAll('\r\n', '\n').split('\n');
    final blocks = <Widget>[];
    var inCode = false;
    final code = <String>[];

    for (final line in lines) {
      if (line.trimLeft().startsWith('```')) {
        if (inCode) {
          blocks.add(Container(
            width: double.infinity,
            margin: const EdgeInsets.symmetric(vertical: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(Radii.md)),
            child: Text(code.join('\n'), style: AppType.mono(p.text, size: 13)),
          ));
          code.clear();
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code.add(line);
        continue;
      }
      final h = RegExp(r'^(#{1,3})\s+(.*)$').firstMatch(line);
      final task = RegExp(r'^\s*[-*+]\s+\[( |x|X)\]\s*(.*)$').firstMatch(line);
      final bullet = RegExp(r'^\s*([-*+]|\d+[.)])\s+(.*)$').firstMatch(line);
      if (h != null) {
        final level = h.group(1)!.length;
        blocks.add(Padding(
          padding: EdgeInsets.only(top: level == 1 ? 14 : 10, bottom: 4),
          child: Text.rich(TextSpan(children: _spans(h.group(2)!, body, p)), style: AppType.page(p.text).copyWith(fontSize: level == 1 ? 24 : (level == 2 ? 20 : 17))),
        ));
      } else if (task != null) {
        final done = task.group(1)!.toLowerCase() == 'x';
        blocks.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              margin: const EdgeInsets.only(top: 5, right: 10),
              width: 18,
              height: 18,
              decoration: BoxDecoration(color: done ? p.green : Colors.transparent, borderRadius: BorderRadius.circular(5), border: Border.all(color: done ? p.green : p.borderStrong, width: 1.6)),
              child: done ? const Icon(Icons.check_rounded, size: 13, color: Colors.white) : null,
            ),
            Expanded(child: Text.rich(TextSpan(children: _spans(task.group(2)!, body, p)), style: body.copyWith(color: done ? p.text3 : p.text, decoration: done ? TextDecoration.lineThrough : null))),
          ]),
        ));
      } else if (bullet != null) {
        final marker = bullet.group(1)!;
        final numbered = RegExp(r'\d').hasMatch(marker);
        blocks.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 24, child: Text(numbered ? marker : '•', style: body.copyWith(color: p.text3))),
            Expanded(child: Text.rich(TextSpan(children: _spans(bullet.group(2)!, body, p)), style: body)),
          ]),
        ));
      } else if (line.startsWith('>')) {
        blocks.add(Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.only(left: 14),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: p.primary, width: 3))),
          child: Text.rich(TextSpan(children: _spans(line.replaceFirst(RegExp(r'^>\s?'), ''), body, p)), style: body.copyWith(color: p.text2, fontStyle: FontStyle.italic)),
        ));
      } else if (line.trim().isEmpty) {
        blocks.add(const SizedBox(height: 10));
      } else {
        blocks.add(Text.rich(TextSpan(children: _spans(line, body, p)), style: body));
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: blocks);
  }
}

/// Plain text preview for cards.
String stripMarkdown(String src) => src
    .replaceAll(RegExp(r'```[\s\S]*?```'), ' ')
    .replaceAll(RegExp(r'^#{1,6}\s+', multiLine: true), '')
    .replaceAll(RegExp(r'^\s*>\s?', multiLine: true), '')
    .replaceAllMapped(RegExp(r'^\s*([-*+]|\d+[.)])\s+(\[( |x|X)\]\s*)?', multiLine: true), (_) => '• ')
    .replaceAll(RegExp(r'\*\*|__|`'), '')
    .trim();
