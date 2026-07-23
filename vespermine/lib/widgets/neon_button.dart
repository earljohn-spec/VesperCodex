import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Neon-styled button with glow effect
/// Uses GestureDetector + Container for consistent behavior across all platforms
class NeonButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color? color;
  final bool isLoading;
  final bool isOutlined;
  final double? width;
  final double height;

  const NeonButton({
    super.key,
    required this.text,
    this.onPressed,
    this.icon,
    this.color,
    this.isLoading = false,
    this.isOutlined = false,
    this.width,
    this.height = 56,
  });

  @override
  Widget build(BuildContext context) {
    final buttonColor = color ?? VesperTheme.neonCyan;
    final isEnabled = onPressed != null && !isLoading;

    Widget content = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isLoading)
          SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(
                isOutlined ? buttonColor : VesperTheme.bgPrimary,
              ),
            ),
          )
        else ...[
          if (icon != null) ...[
            Icon(
              icon,
              size: 20,
              color: isOutlined ? buttonColor : VesperTheme.bgPrimary,
            ),
            const SizedBox(width: 8),
          ],
          Text(
            text,
            style: TextStyle(
              color: isOutlined ? buttonColor : VesperTheme.bgPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );

    if (isOutlined) {
      return SizedBox(
        width: width ?? double.infinity,
        height: height,
        child: GestureDetector(
          onTap: isEnabled ? onPressed : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: isEnabled ? buttonColor.withAlpha(13) : Colors.transparent,
              border: Border.all(
                color: isEnabled ? buttonColor : buttonColor.withAlpha(77),
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
            ),
            alignment: Alignment.center,
            child: Opacity(opacity: isEnabled ? 1.0 : 0.5, child: content),
          ),
        ),
      );
    }

    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: GestureDetector(
        onTap: isEnabled ? onPressed : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
            gradient: isEnabled
                ? LinearGradient(
                    colors: [buttonColor, buttonColor.withAlpha(200)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: isEnabled ? null : buttonColor.withAlpha(77),
            boxShadow: isEnabled
                ? [
                    BoxShadow(
                      color: buttonColor.withAlpha(77),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }
}
