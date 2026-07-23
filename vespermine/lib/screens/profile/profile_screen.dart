import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../services/auth_service.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: VesperTheme.miningGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const SizedBox(height: 20),
                // Profile Header
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: VesperTheme.bgCard,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusXl),
                    border: Border.all(color: VesperTheme.neonCyan.withAlpha(20)),
                  ),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 48,
                        backgroundColor: VesperTheme.neonCyan.withAlpha(26),
                        child: Text(
                          (user?.displayName ?? 'U').substring(0, 1).toUpperCase(),
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: VesperTheme.neonCyan,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        user?.displayName ?? 'User',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: VesperTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(color: VesperTheme.textMuted, fontSize: 14),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: VesperTheme.neonGold.withAlpha(26),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: VesperTheme.neonGold.withAlpha(60)),
                        ),
                        child: Text(
                          user?.subscriptionTier.toUpperCase() ?? 'FREE',
                          style: const TextStyle(
                            color: VesperTheme.neonGold,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Stats row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _profileStat('Streak', '${user?.currentStreak ?? 0}', VesperTheme.neonOrange),
                          _profileStat('Referrals', '${user?.totalReferrals ?? 0}', VesperTheme.neonPurple),
                          _profileStat('Tasks', '${user?.totalTasksCompleted ?? 0}', VesperTheme.neonGreen),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Referral Code Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        VesperTheme.neonPurple.withAlpha(30),
                        VesperTheme.neonCyan.withAlpha(20),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                    border: Border.all(color: VesperTheme.neonPurple.withAlpha(40)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.card_giftcard, color: VesperTheme.neonPurple, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Your Referral Code',
                                style: TextStyle(color: VesperTheme.textSecondary, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              user?.referralCode ?? 'VM------',
                              style: const TextStyle(
                                color: VesperTheme.neonPurple,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, color: VesperTheme.textPrimary),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Referral code copied!')),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Settings List
                Container(
                  decoration: BoxDecoration(
                    color: VesperTheme.bgCard,
                    borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
                  ),
                  child: Column(
                    children: [
                      _SettingsTile(
                        icon: Icons.diamond_outlined,
                        label: 'Upgrade Plan',
                        color: VesperTheme.neonGold,
                        onTap: () => context.go(RouteNames.subscription),
                      ),
                      _buildDivider(),
                      _SettingsTile(
                        icon: Icons.notifications_outlined,
                        label: 'Notifications',
                        color: VesperTheme.neonCyan,
                        trailing: Switch(
                          value: true,
                          onChanged: (v) {},
                        ),
                      ),
                      _buildDivider(),
                      _SettingsTile(
                        icon: Icons.fingerprint,
                        label: 'Biometric Login',
                        color: VesperTheme.neonGreen,
                        trailing: Switch(
                          value: false,
                          onChanged: (v) {},
                        ),
                      ),
                      _buildDivider(),
                      _SettingsTile(
                        icon: Icons.language,
                        label: 'Language',
                        subtitle: 'English',
                        color: VesperTheme.neonPurple,
                        onTap: () {},
                      ),
                      _buildDivider(),
                      _SettingsTile(
                        icon: Icons.help_outline,
                        label: 'Help & Support',
                        color: VesperTheme.info,
                        onTap: () {},
                      ),
                      _buildDivider(),
                      _SettingsTile(
                        icon: Icons.policy_outlined,
                        label: 'Privacy Policy',
                        color: VesperTheme.textMuted,
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Sign Out
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await ref.read(authStateProvider.notifier).signOut();
                      context.go(RouteNames.login);
                    },
                    icon: const Icon(Icons.logout, color: VesperTheme.error),
                    label: const Text('Sign Out', style: TextStyle(color: VesperTheme.error)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: VesperTheme.error),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _profileStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: VesperTheme.textMuted, fontSize: 12)),
      ],
    );
  }

  Widget _buildDivider() => const Divider(height: 1, indent: 56, endIndent: 16);
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final Color color;
  final VoidCallback? onTap;
  final Widget? trailing;

  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.color,
    this.subtitle,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withAlpha(26),
          borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(label, style: const TextStyle(color: VesperTheme.textPrimary, fontSize: 15)),
      subtitle: subtitle != null ? Text(subtitle!, style: const TextStyle(color: VesperTheme.textMuted, fontSize: 12)) : null,
      trailing: trailing ?? (onTap != null ? const Icon(Icons.arrow_forward_ios, color: VesperTheme.textMuted, size: 14) : null),
      onTap: onTap,
    );
  }
}
