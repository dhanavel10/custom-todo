import 'package:flutter_test/flutter_test.dart';
import 'package:intelligent_todo/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const IntelligentTodoApp());
    expect(find.byType(IntelligentTodoApp), findsOneWidget);
  });
}
