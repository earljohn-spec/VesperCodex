import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../widgets/neon_button.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController(text: 'demo@vespermine.app');
  final _passwordController = TextEditingController(text: 'password123');
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final authNotifier = ref.read(authStateProvider.notifier);
    await authNotifier.signIn(
      _emailController.text.trim(),
      _passwordController.text,
    );

    final state = ref.read(authStateProvider);
    if (state.user != null) {
      context.go(RouteNames.dashboard);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: VesperTheme.miningGradient,
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 60),

                  // Logo
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: VesperTheme.primaryGradient,
                        boxShadow: VesperTheme.glowShadow,
                      ),
                      child: const Icon(
                        Icons.currency_bitcoin,
                        size: 48,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Title
                  const Center(
                    child: Text(
                      'Welcome Back',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: VesperTheme.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Sign in to continue earning',
                      style: TextStyle(
                        fontSize: 14,
                        color: VesperTheme.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 48),

                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: VesperTheme.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined, color: VesperTheme.neonCyan),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: VesperTheme.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, color: VesperTheme.neonCyan),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                          color: VesperTheme.textMuted,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 8),

                  // Forgot password
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        // TODO: Implement forgot password
                      },
                      child: const Text(
                        'Forgot Password?',
                        style: TextStyle(color: VesperTheme.neonCyan),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Error message
                  if (authState.error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: VesperTheme.error.withAlpha(26),
                        borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                      ),
                      child: Text(
                        authState.error!,
                        style: const TextStyle(color: VesperTheme.error),
                        textAlign: TextAlign.center,
                      ),
                    ),

                  // Login Button
                  NeonButton(
                    text: 'Sign In',
                    icon: Icons.login_rounded,
                    isLoading: authState.isLoading,
                    onPressed: _handleLogin,
                  ),
                  const SizedBox(height: 16),

                  // Divider
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'OR',
                          style: TextStyle(color: VesperTheme.textMuted),
                        ),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Register button
                  NeonButton(
                    text: 'Create Account',
                    isOutlined: true,
                    onPressed: () {
                      context.go(RouteNames.register);
                    },
                  ),
                  const SizedBox(height: 32),

                  // Demo note
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: VesperTheme.bgCard,
                      borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                      border: Border.all(color: VesperTheme.neonCyan.withAlpha(30)),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: VesperTheme.neonCyan,
                          size: 20,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Demo Mode',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: VesperTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Use the pre-filled credentials or create a new account',
                          style: TextStyle(
                            fontSize: 12,
                            color: VesperTheme.textMuted,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
