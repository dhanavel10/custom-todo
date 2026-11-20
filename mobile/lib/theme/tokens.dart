import 'package:flutter/material.dart';

/// Design tokens shared with the web app (client/src/styles/tokens.css).
/// "Graphite & Violet": warm paper in light, deep graphite in dark, electric violet accent.
class Space {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

class Radii {
  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double full = 999;
}

class Motion {
  static const Duration fast = Duration(milliseconds: 140);
  static const Duration base = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);
  static const Curve out = Cubic(0.16, 1, 0.3, 1);
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);
}

/// Semantic color palette, available anywhere via `context.palette`.
@immutable
class Palette extends ThemeExtension<Palette> {
  final Color bg;
  final Color bgSubtle;
  final Color surface;
  final Color surface2;
  final Color sunken;
  final Color border;
  final Color borderSubtle;
  final Color borderStrong;
  final Color text;
  final Color text2;
  final Color text3;
  final Color primary;
  final Color primarySoft;
  final Color primaryText;
  final Color teal;
  final Color amber;
  final Color coral;
  final Color green;
  final Color slate;
  final Color overlay;

  const Palette({
    required this.bg,
    required this.bgSubtle,
    required this.surface,
    required this.surface2,
    required this.sunken,
    required this.border,
    required this.borderSubtle,
    required this.borderStrong,
    required this.text,
    required this.text2,
    required this.text3,
    required this.primary,
    required this.primarySoft,
    required this.primaryText,
    required this.teal,
    required this.amber,
    required this.coral,
    required this.green,
    required this.slate,
    required this.overlay,
  });

  static const light = Palette(
    bg: Color(0xFFF7F6F3),
    bgSubtle: Color(0xFFF1EFEA),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFFBFAF8),
    sunken: Color(0xFFEEECE6),
    border: Color(0xFFE7E4DD),
    borderSubtle: Color(0xFFEFEDE7),
    borderStrong: Color(0xFFD5D1C7),
    text: Color(0xFF18171D),
    text2: Color(0xFF57565F),
    text3: Color(0xFF8D8B93),
    primary: Color(0xFF5B4CF0),
    primarySoft: Color(0x175B4CF0),
    primaryText: Color(0xFF4A3BD6),
    teal: Color(0xFF0C9A8F),
    amber: Color(0xFFC97A06),
    coral: Color(0xFFE04B3F),
    green: Color(0xFF1C9152),
    slate: Color(0xFF6B6F80),
    overlay: Color(0x6118161E),
  );

  static const dark = Palette(
    bg: Color(0xFF0E0F13),
    bgSubtle: Color(0xFF121318),
    surface: Color(0xFF16171D),
    surface2: Color(0xFF1B1C23),
    sunken: Color(0xFF0B0C0F),
    border: Color(0xFF26272F),
    borderSubtle: Color(0xFF1F2028),
    borderStrong: Color(0xFF363743),
    text: Color(0xFFECECF1),
    text2: Color(0xFFA4A4AF),
    text3: Color(0xFF6D6D79),
    primary: Color(0xFF7C6CFF),
    primarySoft: Color(0x217C6CFF),
    primaryText: Color(0xFFA99FFF),
    teal: Color(0xFF2EC4B6),
    amber: Color(0xFFF0B23E),
    coral: Color(0xFFFF6B5F),
    green: Color(0xFF3DD68C),
    slate: Color(0xFF8F93A6),
    overlay: Color(0x9E040408),
  );

  bool get isDark => bg.computeLuminance() < 0.2;

  /// A tinted background for a semantic color ("soft" variant).
  Color soft(Color c) => c.withValues(alpha: isDark ? 0.15 : 0.11);

  Color get ai => teal;

  @override
  Palette copyWith() => this;

  @override
  Palette lerp(ThemeExtension<Palette>? other, double t) {
    if (other is! Palette) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return Palette(
      bg: l(bg, other.bg),
      bgSubtle: l(bgSubtle, other.bgSubtle),
      surface: l(surface, other.surface),
      surface2: l(surface2, other.surface2),
      sunken: l(sunken, other.sunken),
      border: l(border, other.border),
      borderSubtle: l(borderSubtle, other.borderSubtle),
      borderStrong: l(borderStrong, other.borderStrong),
      text: l(text, other.text),
      text2: l(text2, other.text2),
      text3: l(text3, other.text3),
      primary: l(primary, other.primary),
      primarySoft: l(primarySoft, other.primarySoft),
      primaryText: l(primaryText, other.primaryText),
      teal: l(teal, other.teal),
      amber: l(amber, other.amber),
      coral: l(coral, other.coral),
      green: l(green, other.green),
      slate: l(slate, other.slate),
      overlay: l(overlay, other.overlay),
    );
  }
}

extension PaletteContext on BuildContext {
  Palette get palette => Theme.of(this).extension<Palette>()!;
}
