import 'package:flutter/material.dart';

/// Paleta "recetario de mercado": papel verdoso, verde cilantro, amarillo choclo, rojo ají.
@immutable
class SazonColors extends ThemeExtension<SazonColors> {
  final Color bg, surface, sunk, line, ink, muted, accent, accentInk, accentSoft, chile, chileSoft, maize, maizeSoft;
  const SazonColors({
    required this.bg,
    required this.surface,
    required this.sunk,
    required this.line,
    required this.ink,
    required this.muted,
    required this.accent,
    required this.accentInk,
    required this.accentSoft,
    required this.chile,
    required this.chileSoft,
    required this.maize,
    required this.maizeSoft,
  });

  static const light = SazonColors(
    bg: Color(0xFFF4F6EE),
    surface: Color(0xFFFFFFFF),
    sunk: Color(0xFFE8ECDF),
    line: Color(0xFFD5DBC9),
    ink: Color(0xFF1F2A1F),
    muted: Color(0xFF5E6B5C),
    accent: Color(0xFF2F6B3F),
    accentInk: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFDCEBD9),
    chile: Color(0xFFC8442B),
    chileSoft: Color(0xFFF7E1DA),
    maize: Color(0xFFE9B949),
    maizeSoft: Color(0xFFF8ECC8),
  );

  static const dark = SazonColors(
    bg: Color(0xFF121612),
    surface: Color(0xFF1B211B),
    sunk: Color(0xFF232A22),
    line: Color(0xFF313A30),
    ink: Color(0xFFE8EDE4),
    muted: Color(0xFFA3AE9F),
    accent: Color(0xFF7FC28F),
    accentInk: Color(0xFF0F1A12),
    accentSoft: Color(0xFF23352A),
    chile: Color(0xFFEE8166),
    chileSoft: Color(0xFF3A231D),
    maize: Color(0xFFE9C46A),
    maizeSoft: Color(0xFF3A3220),
  );

  @override
  SazonColors copyWith() => this;

  @override
  SazonColors lerp(ThemeExtension<SazonColors>? other, double t) => t < 0.5 ? this : (other as SazonColors? ?? this);
}

extension SazonContext on BuildContext {
  SazonColors get c => Theme.of(this).extension<SazonColors>()!;
}

const display = 'Bricolage';
const body = 'Figtree';

TextStyle displayStyle(double size, Color color, {FontWeight weight = FontWeight.w800}) => TextStyle(
      fontFamily: display,
      fontSize: size,
      height: 1.08,
      letterSpacing: -0.4,
      color: color,
      fontWeight: weight,
      fontVariations: [FontVariation.weight(weight.value.toDouble())],
    );

ThemeData buildTheme(SazonColors c, Brightness b) {
  final scheme = ColorScheme.fromSeed(seedColor: c.accent, brightness: b).copyWith(
    primary: c.accent,
    onPrimary: c.accentInk,
    surface: c.bg,
    onSurface: c.ink,
    error: c.chile,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    fontFamily: body,
    extensions: [c],
    appBarTheme: AppBarTheme(
      backgroundColor: c.bg,
      foregroundColor: c.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: Border(bottom: BorderSide(color: c.line)),
    ),
    dividerColor: c.line,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.accent,
        foregroundColor: c.accentInk,
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontFamily: body, fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        backgroundColor: c.surface,
        side: BorderSide(color: c.line, width: 1.5),
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontFamily: body, fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: c.accent,
        textStyle: const TextStyle(fontFamily: body, fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.line, width: 1.5)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.line, width: 1.5)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.accent, width: 2)),
      hintStyle: TextStyle(color: c.muted),
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      side: BorderSide(color: c.line, width: 2),
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.accent : c.surface),
      checkColor: WidgetStatePropertyAll(c.accentInk),
    ),
  );
}
