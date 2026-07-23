import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// VesperMine Dark Cyber Theme
class VesperTheme {
  // Brand Colors
  static const Color neonCyan = Color(0xFF00F5FF);
  static const Color neonPurple = Color(0xFFBF00FF);
  static const Color neonGreen = Color(0xFF39FF14);
  static const Color neonOrange = Color(0xFFFF6600);
  static const Color neonGold = Color(0xFFFFD700);
  
  // Background Colors
  static const Color bgPrimary = Color(0xFF0A0E1A);
  static const Color bgSecondary = Color(0xFF111827);
  static const Color bgCard = Color(0xFF1A1F2E);
  static const Color bgCardElevated = Color(0xFF222840);

  // Text Colors
  static const Color textPrimary = Color(0xFFE8EAED);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Utility Colors
  static const Color success = Color(0xFF39FF14);
  static const Color warning = Color(0xFFFF9500);
  static const Color error = Color(0xFFFF3B3B);
  static const Color info = Color(0xFF00F5FF);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [neonCyan, neonPurple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [bgCard, bgCardElevated],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient miningGradient = LinearGradient(
    colors: [Color(0xFF0A0E1A), Color(0xFF1A0A2E)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient goldGradient = LinearGradient(
    colors: [neonGold, neonOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Box Shadows
  static List<BoxShadow> cardShadow = [
    BoxShadow(
      color: neonCyan.withAlpha(13),
      blurRadius: 20,
      offset: const Offset(0, 10),
    ),
  ];

  static List<BoxShadow> glowShadow = [
    BoxShadow(
      color: neonCyan.withAlpha(77),
      blurRadius: 20,
      spreadRadius: 2,
    ),
  ];

  // Border Radius
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 24.0;

  // Spacing
  static const double spacingXs = 4.0;
  static const double spacingSm = 8.0;
  static const double spacingMd = 16.0;
  static const double spacingLg = 24.0;
  static const double spacingXl = 32.0;

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgPrimary,
      
      colorScheme: const ColorScheme.dark(
        primary: neonCyan,
        secondary: neonPurple,
        surface: bgSecondary,
        error: error,
        onPrimary: bgPrimary,
        onSecondary: textPrimary,
        onSurface: textPrimary,
      ),

      textTheme: GoogleFonts.interTextTheme(
        const TextTheme(
          headlineLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: textPrimary,
            letterSpacing: -0.5,
          ),
          headlineMedium: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: textPrimary,
          ),
          headlineSmall: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: textPrimary,
          ),
          titleLarge: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: textPrimary,
          ),
          titleMedium: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: textPrimary,
          ),
          bodyLarge: TextStyle(
            fontSize: 16,
            color: textPrimary,
          ),
          bodyMedium: TextStyle(
            fontSize: 14,
            color: textSecondary,
          ),
          bodySmall: TextStyle(
            fontSize: 12,
            color: textMuted,
          ),
          labelLarge: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: textPrimary,
          ),
        ),
      ),

      appBarTheme: const AppBarTheme(
        backgroundColor: bgPrimary,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        iconTheme: IconThemeData(color: textPrimary),
      ),

      cardTheme: CardThemeData(
        color: bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: neonCyan,
          foregroundColor: bgPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: neonCyan,
          side: const BorderSide(color: neonCyan, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgCard,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: Color(0xFF2D3748), width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: neonCyan, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: error, width: 1),
        ),
        hintStyle: const TextStyle(color: textMuted),
      ),

      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: bgSecondary,
        selectedItemColor: neonCyan,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 12),
      ),

      dividerTheme: const DividerThemeData(
        color: Color(0xFF2D3748),
        thickness: 1,
      ),

      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return neonCyan;
          return textMuted;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return neonCyan.withAlpha(77);
          return bgCard;
        }),
      ),
    );
  }

  // Utility: Neon glow border
  static BoxDecoration neonBorder({
    Color color = neonCyan,
    double blurRadius = 15,
    double spreadRadius = 0,
  }) {
    return BoxDecoration(
      border: Border.all(color: color.withAlpha(128), width: 1.5),
      borderRadius: BorderRadius.circular(radiusLg),
      boxShadow: [
        BoxShadow(
          color: color.withAlpha(38),
          blurRadius: blurRadius,
          spreadRadius: spreadRadius,
        ),
      ],
    );
  }
}
