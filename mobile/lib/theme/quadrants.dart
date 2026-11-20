import 'package:flutter/material.dart';
import 'tokens.dart';

/// Eisenhower quadrant identities — same hues and copy as the web app (client/src/lib/quadrants.ts).
class QuadrantMeta {
  final String key; // API value, e.g. DO_FIRST
  final String mapKey; // matrix response key, e.g. doFirst
  final String code;
  final String name;
  final String tagline;
  final String description;
  final String emptyTitle;
  final IconData icon;
  final Color Function(Palette p) colorOf;

  const QuadrantMeta({
    required this.key,
    required this.mapKey,
    required this.code,
    required this.name,
    required this.tagline,
    required this.description,
    required this.emptyTitle,
    required this.icon,
    required this.colorOf,
  });
}

Color _q1(Palette p) => p.coral;
Color _q2(Palette p) => p.primary;
Color _q3(Palette p) => p.amber;
Color _q4(Palette p) => p.slate;

const List<QuadrantMeta> kQuadrants = [
  QuadrantMeta(
    key: 'DO_FIRST',
    mapKey: 'doFirst',
    code: 'Q1',
    name: 'Do First',
    tagline: 'Urgent and important',
    description: 'Imminent deadlines and high-impact work. Clear these before anything else.',
    emptyTitle: 'Nothing on fire',
    icon: Icons.bolt_rounded,
    colorOf: _q1,
  ),
  QuadrantMeta(
    key: 'SCHEDULE',
    mapKey: 'schedule',
    code: 'Q2',
    name: 'Schedule',
    tagline: 'Important, not urgent',
    description: 'Deep work, learning and long-term goals. Block time so they actually happen.',
    emptyTitle: 'Room to plan ahead',
    icon: Icons.event_note_rounded,
    colorOf: _q2,
  ),
  QuadrantMeta(
    key: 'DELEGATE',
    mapKey: 'delegate',
    code: 'Q3',
    name: 'Delegate',
    tagline: 'Urgent, not important',
    description: 'Time-sensitive chores and interruptions someone else could handle.',
    emptyTitle: 'Nothing to hand off',
    icon: Icons.forward_rounded,
    colorOf: _q3,
  ),
  QuadrantMeta(
    key: 'ELIMINATE',
    mapKey: 'eliminate',
    code: 'Q4',
    name: 'Eliminate',
    tagline: 'Neither urgent nor important',
    description: 'Busywork and distractions. Decline, batch, or drop them entirely.',
    emptyTitle: 'Nothing to prune',
    icon: Icons.air_rounded,
    colorOf: _q4,
  ),
];

QuadrantMeta? quadrantFor(String? key) {
  for (final q in kQuadrants) {
    if (q.key == key) return q;
  }
  return null;
}
