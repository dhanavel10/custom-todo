import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/api_service.dart';
import 'theme/app_theme.dart';
import 'screens/main_screen.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Edge-to-edge; status/navigation bar icon colours follow the active theme (see AppBarTheme).
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarContrastEnforced: false,
  ));

  await ThemeController.instance.load();

  // Initialize API service and verify existing session
  await ApiService().init();

  runApp(const IntelligentTodoApp());
}

class IntelligentTodoApp extends StatelessWidget {
  const IntelligentTodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.instance,
      builder: (context, mode, _) => MaterialApp(
        title: 'Productivity Inbox',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: mode,
        themeAnimationDuration: const Duration(milliseconds: 320),
        themeAnimationCurve: Curves.easeOut,
        home: ValueListenableBuilder<bool>(
          valueListenable: ApiService().authStateNotifier,
          builder: (context, isAuthenticated, _) {
            return AnimatedSwitcher(
              duration: Motion.slow,
              switchInCurve: Motion.out,
              switchOutCurve: Curves.easeIn,
              child: isAuthenticated
                  ? const MainScreen(key: ValueKey('main_screen'))
                  : const LoginScreen(key: ValueKey('login_screen')),
            );
          },
        ),
      ),
    );
  }
}
