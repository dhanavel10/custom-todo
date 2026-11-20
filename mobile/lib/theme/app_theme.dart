import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'tokens.dart';

export 'tokens.dart';

/// Typography — same families as the web app.
class AppType {
  static TextStyle display(Color c) => GoogleFonts.manrope(fontSize: 28, height: 1.15, fontWeight: FontWeight.w800, letterSpacing: -0.9, color: c);
  static TextStyle page(Color c) => GoogleFonts.manrope(fontSize: 22, height: 1.2, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: c);
  static TextStyle section(Color c) => GoogleFonts.manrope(fontSize: 15, height: 1.3, fontWeight: FontWeight.w700, letterSpacing: -0.2, color: c);
  static TextStyle card(Color c) => GoogleFonts.inter(fontSize: 14.5, height: 1.35, fontWeight: FontWeight.w600, letterSpacing: -0.15, color: c);
  static TextStyle body(Color c) => GoogleFonts.inter(fontSize: 14, height: 1.5, fontWeight: FontWeight.w400, color: c);
  static TextStyle caption(Color c) => GoogleFonts.inter(fontSize: 12.5, height: 1.4, fontWeight: FontWeight.w400, color: c);
  static TextStyle meta(Color c) => GoogleFonts.inter(fontSize: 11.5, height: 1.3, fontWeight: FontWeight.w500, color: c);
  static TextStyle eyebrow(Color c) => GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.9, color: c);
  static TextStyle mono(Color c, {double size = 11}) => GoogleFonts.jetBrainsMono(fontSize: size, fontWeight: FontWeight.w500, color: c);
  static TextStyle number(Color c, {double size = 22}) => GoogleFonts.manrope(fontSize: size, fontWeight: FontWeight.w800, letterSpacing: -0.8, color: c, fontFeatures: const [FontFeature.tabularFigures()]);
  static TextStyle serif(Color c, {double size = 18, FontWeight weight = FontWeight.w400}) => GoogleFonts.newsreader(fontSize: size, height: 1.65, fontWeight: weight, color: c);
}

class AppTheme {
  static ThemeData get lightTheme => _build(Palette.light, Brightness.light);
  static ThemeData get darkTheme => _build(Palette.dark, Brightness.dark);

  static ThemeData _build(Palette p, Brightness b) {
    final base = ThemeData(useMaterial3: true, brightness: b, fontFamily: GoogleFonts.inter().fontFamily);
    final text = base.textTheme.apply(bodyColor: p.text, displayColor: p.text);
    final radius = BorderRadius.circular(Radii.md);

    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));

    return base.copyWith(
      scaffoldBackgroundColor: p.bg,
      canvasColor: p.bg,
      extensions: [p],
      colorScheme: ColorScheme(
        brightness: b,
        primary: p.primary,
        onPrimary: Colors.white,
        primaryContainer: p.primarySoft,
        onPrimaryContainer: p.primaryText,
        secondary: p.teal,
        onSecondary: Colors.white,
        error: p.coral,
        onError: Colors.white,
        surface: p.surface,
        onSurface: p.text,
        onSurfaceVariant: p.text2,
        surfaceContainerLowest: p.surface,
        surfaceContainerLow: p.surface2,
        surfaceContainer: p.surface2,
        surfaceContainerHigh: p.surface2,
        surfaceContainerHighest: p.sunken,
        outline: p.border,
        outlineVariant: p.borderSubtle,
        shadow: Colors.black,
      ),
      textTheme: text.copyWith(
        headlineMedium: AppType.page(p.text),
        titleLarge: AppType.page(p.text).copyWith(fontSize: 19),
        titleMedium: AppType.section(p.text),
        titleSmall: AppType.card(p.text),
        bodyLarge: AppType.body(p.text),
        bodyMedium: AppType.body(p.text2),
        bodySmall: AppType.caption(p.text3),
        labelLarge: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: p.text),
      ),
      dividerColor: p.borderSubtle,
      dividerTheme: DividerThemeData(color: p.borderSubtle, thickness: 1, space: 1),
      splashFactory: InkSparkle.splashFactory,
      highlightColor: Colors.transparent,
      appBarTheme: AppBarTheme(
        backgroundColor: p.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: (b == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark).copyWith(statusBarColor: Colors.transparent),
        titleTextStyle: AppType.page(p.text).copyWith(fontSize: 19),
        iconTheme: IconThemeData(color: p.text2, size: 22),
      ),
      iconTheme: IconThemeData(color: p.text2, size: 20),
      cardTheme: CardThemeData(
        color: p.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg), side: BorderSide(color: p.border)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface2,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        hintStyle: AppType.body(p.text3),
        labelStyle: AppType.caption(p.text2),
        prefixIconColor: p.text3,
        suffixIconColor: p.text3,
        border: border(p.border),
        enabledBorder: border(p.border),
        focusedBorder: border(p.primary, 1.6),
        errorBorder: border(p.coral),
        focusedErrorBorder: border(p.coral, 1.6),
      ),
      textSelectionTheme: TextSelectionThemeData(cursorColor: p.primary, selectionColor: p.primarySoft, selectionHandleColor: p.primary),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: p.primary.withValues(alpha: 0.4),
          disabledForegroundColor: Colors.white70,
          minimumSize: const Size(48, 46),
          padding: const EdgeInsets.symmetric(horizontal: 18),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(48, 46),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.text,
          side: BorderSide(color: p.border),
          minimumSize: const Size(48, 46),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.primaryText,
          minimumSize: const Size(44, 44),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: p.text2, minimumSize: const Size(44, 44))),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: p.overlay,
        showDragHandle: false,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl + 4))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        barrierColor: p.overlay,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.xl)),
        titleTextStyle: AppType.section(p.text).copyWith(fontSize: 17),
        contentTextStyle: AppType.body(p.text2),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: b == Brightness.dark ? const Color(0xFF272832) : const Color(0xFF1B1A21),
        contentTextStyle: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w500, color: Colors.white),
        actionTextColor: const Color(0xFFB9B0FF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md)),
        elevation: 0,
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: p.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md), side: BorderSide(color: p.border)),
        textStyle: AppType.body(p.text),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: p.primary, linearTrackColor: p.sunken, circularTrackColor: p.sunken),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => Colors.white),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? p.primary : p.borderStrong),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.linux: FadeForwardsPageTransitionsBuilder(),
      }),
    );
  }
}

/// Persists the light / dark / system preference.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController._() : super(ThemeMode.system);
  static final ThemeController instance = ThemeController._();
  static const _key = 'theme_mode';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_key);
    value = ThemeMode.values.firstWhere((m) => m.name == v, orElse: () => ThemeMode.system);
  }

  Future<void> set(ThemeMode mode) async {
    value = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, mode.name);
  }
}
