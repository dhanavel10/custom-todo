import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intelligent_todo/models/task.dart';
import 'package:intelligent_todo/theme/app_theme.dart';
import 'package:intelligent_todo/widgets/task_card.dart';

Task _task({String status = 'TODO'}) => Task(
      id: 't1',
      userId: 'u1',
      title: 'Call the bank about the card',
      status: status,
      eisenhowerQuadrant: 'DO_FIRST',
      createdAt: DateTime.now().toIso8601String(),
      updatedAt: DateTime.now().toIso8601String(),
    );

Widget _host(Widget child) => MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: ListView(padding: const EdgeInsets.all(16), children: [child])));

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('tapping the card body opens the details sheet', (tester) async {
    await tester.pumpWidget(_host(TaskCard(task: _task(), onToggle: (_) {}, onMoveQuadrant: (_) {}, onDelete: () {})));
    await tester.tap(find.text('Call the bank about the card'));
    await tester.pumpAndSettle();
    expect(find.byType(TaskDetailSheet), findsOneWidget);
    expect(find.text('MOVE TO'), findsOneWidget);
  });

  testWidgets('completing via the check reports done after the animation', (tester) async {
    bool? reported;
    await tester.pumpWidget(_host(TaskCard(task: _task(), onToggle: (v) => reported = v)));
    await tester.tap(find.bySemanticsLabel('Mark as done'));
    await tester.pumpAndSettle();
    expect(reported, isTrue);
  });

  testWidgets('moving to another quadrant from the sheet', (tester) async {
    String? moved;
    await tester.pumpWidget(_host(TaskCard(task: _task(), onToggle: (_) {}, onMoveQuadrant: (q) => moved = q)));
    await tester.tap(find.byTooltip('Task actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Schedule'));
    await tester.pumpAndSettle();
    expect(moved, 'SCHEDULE');
  });

  testWidgets('swipe right completes, swipe left asks before deleting', (tester) async {
    bool? toggled;
    var deleted = false;
    await tester.pumpWidget(_host(TaskCard(task: _task(), onToggle: (v) => toggled = v, onDelete: () => deleted = true)));
    await tester.drag(find.text('Call the bank about the card'), const Offset(300, 0));
    await tester.pumpAndSettle();
    expect(toggled, isTrue);

    await tester.drag(find.text('Call the bank about the card'), const Offset(-420, 0));
    await tester.pumpAndSettle();
    expect(find.text('Delete this task?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(deleted, isTrue);
  });
}
