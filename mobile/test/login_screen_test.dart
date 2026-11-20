import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intelligent_todo/screens/login_screen.dart';
import 'package:intelligent_todo/theme/app_theme.dart';

Widget _host(Widget child) => MaterialApp(
      theme: AppTheme.lightTheme,
      home: child,
    );

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('LoginScreen renders brand header, tabs and Google button', (tester) async {
    await tester.pumpWidget(_host(const LoginScreen()));
    await tester.pumpAndSettle();

    // Verify brand title and 7-day session badge
    expect(find.text('Productivity Inbox'), findsOneWidget);
    expect(find.textContaining('7 days'), findsWidgets);

    // Verify Sign In and Create Account tabs
    expect(find.text('Sign In'), findsWidgets);
    expect(find.text('Create Account'), findsOneWidget);

    // Verify Sign In inputs and Google Auth
    expect(find.text('Username or Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('Switching to Create Account tab shows password strength rules', (tester) async {
    await tester.pumpWidget(_host(const LoginScreen()));
    await tester.pumpAndSettle();

    // Tap 'Create Account' tab
    await tester.tap(find.text('Create Account'));
    await tester.pumpAndSettle();

    // Check that strong password checklist rules appear
    expect(find.text('8+ characters'), findsOneWidget);
    expect(find.text('Uppercase letter (A-Z)'), findsOneWidget);
    expect(find.text('Lowercase letter (a-z)'), findsOneWidget);
    expect(find.text('Number (0-9)'), findsOneWidget);
    expect(find.text('Special symbol (!@#\$%^&*)'), findsOneWidget);
  });
}
