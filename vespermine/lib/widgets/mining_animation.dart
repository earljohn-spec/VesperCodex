import 'dart:math';
import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Animated mining visualization widget
class MiningAnimation extends StatefulWidget {
  final bool isActive;
  final double hashRate;
  final double size;

  const MiningAnimation({
    super.key,
    this.isActive = false,
    this.hashRate = 10.0,
    this.size = 200,
  });

  @override
  State<MiningAnimation> createState() => _MiningAnimationState();
}

class _MiningAnimationState extends State<MiningAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Particle> _particles = [];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    for (int i = 0; i < 20; i++) {
      _particles.add(_Particle(
        angle: Random().nextDouble() * 2 * pi,
        radius: 30 + Random().nextDouble() * 60,
        speed: 0.5 + Random().nextDouble() * 1.5,
        size: 2 + Random().nextDouble() * 4,
        opacity: 0.3 + Random().nextDouble() * 0.7,
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return CustomPaint(
            size: Size(widget.size, widget.size),
            painter: _MiningPainter(
              progress: _controller.value,
              isActive: widget.isActive,
              particles: _particles,
              hashRate: widget.hashRate,
            ),
          );
        },
      ),
    );
  }
}

class _MiningPainter extends CustomPainter {
  final double progress;
  final bool isActive;
  final List<_Particle> particles;
  final double hashRate;

  _MiningPainter({
    required this.progress,
    required this.isActive,
    required this.particles,
    required this.hashRate,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;

    // Outer glow
    if (isActive) {
      final glowPaint = Paint()
        ..color = VesperTheme.neonCyan.withAlpha(20)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center, maxRadius * 0.9, glowPaint);
    }

    // Rotating rings
    final colors = [VesperTheme.neonCyan, VesperTheme.neonPurple, VesperTheme.neonGreen];
    for (int i = 0; i < 3; i++) {
      final ringPaint = Paint()
        ..color = colors[i].withAlpha(isActive ? 100 : 30)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;

      final radius = maxRadius * (0.4 + i * 0.15);
      final startAngle = progress * 2 * pi * (i % 2 == 0 ? 1 : -1) + i * 0.5;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        pi * 1.5,
        true,
        ringPaint,
      );
    }

    // Center circle
    final chipPaint = Paint()
      ..color = isActive ? VesperTheme.neonCyan : VesperTheme.textMuted
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, 30, chipPaint);

    final fillPaint = Paint()
      ..color = isActive ? VesperTheme.neonCyan.withAlpha(30) : VesperTheme.bgCard
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, 28, fillPaint);

    // Bitcoin symbol
    final textPainter = TextPainter(
      text: TextSpan(
        text: '₿',
        style: TextStyle(
          color: isActive ? VesperTheme.neonCyan : VesperTheme.textMuted,
          fontSize: 24,
          fontWeight: FontWeight.bold,
        ),
      ),
      textAlign: TextAlign.center,
    )..layout(maxWidth: 40);

    textPainter.paint(
      canvas,
      Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2),
    );

    // Orbiting particles
    if (isActive) {
      for (final particle in particles) {
        final angle = particle.angle + progress * 2 * pi * particle.speed;
        final px = center.dx + cos(angle) * particle.radius;
        final py = center.dy + sin(angle) * particle.radius;

        final particlePaint = Paint()
          ..color = VesperTheme.neonCyan.withAlpha((particle.opacity * 255).round())
          ..style = PaintingStyle.fill;

        canvas.drawCircle(Offset(px, py), particle.size, particlePaint);
      }

      // Hash rate indicators
      for (int i = 0; i < 8; i++) {
        final angle = (i / 8) * 2 * pi + progress * pi;
        final innerR = maxRadius * 0.75;
        final outerR = maxRadius * (0.78 + (hashRate / 500) * 0.1);

        final barPaint = Paint()
          ..color = VesperTheme.neonCyan.withAlpha(150)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round;

        canvas.drawLine(
          Offset(center.dx + cos(angle) * innerR, center.dy + sin(angle) * innerR),
          Offset(center.dx + cos(angle) * outerR, center.dy + sin(angle) * outerR),
          barPaint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _Particle {
  final double angle;
  final double radius;
  final double speed;
  final double size;
  final double opacity;

  _Particle({
    required this.angle,
    required this.radius,
    required this.speed,
    required this.size,
    required this.opacity,
  });
}
