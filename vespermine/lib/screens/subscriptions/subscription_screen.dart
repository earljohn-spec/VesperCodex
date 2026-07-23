import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../config/routes.dart';
import '../../services/auth_service.dart';
import '../../services/payment_service.dart';
import '../../widgets/neon_button.dart';

class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen> {
  @override
  void initState() {
    super.initState();
    // Initialize payment service
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = ref.read(authStateProvider).user;
      if (user != null) {
        ref.read(paymentServiceProvider).initialize(user.uid);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final paymentService = ref.watch(paymentServiceProvider);
    final currentTier = paymentService.activeTier ?? 
                        authState.user?.subscriptionTier ?? 'free';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Upgrade Plan'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => context.go(RouteNames.dashboard),
        ),
        actions: [
          if (paymentService.isSubscribed)
            TextButton(
              onPressed: () => _showManageSubscription(context),
              child: const Text(
                'Manage',
                style: TextStyle(color: VesperTheme.neonCyan),
              ),
            ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: VesperTheme.miningGradient),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Choose Your Plan',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: VesperTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Unlock higher hash rates and earn more Bitcoin',
                style: TextStyle(color: VesperTheme.textSecondary),
              ),
              const SizedBox(height: 12),

              // Current tier badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _getTierColor(currentTier).withAlpha(26),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _getTierColor(currentTier).withAlpha(60)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle, color: _getTierColor(currentTier), size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Current: ${currentTier.toUpperCase()}',
                      style: TextStyle(
                        color: _getTierColor(currentTier),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Free Tier
              _PlanCard(
                name: 'Free',
                price: 0,
                hashRate: AppConstants.freeTierHashRate,
                features: const [
                  '10 MH/s hash rate',
                  'Daily check-in rewards',
                  'Basic tasks',
                  '5 ad watches/day',
                ],
                isCurrent: currentTier == 'free',
                isPopular: false,
                color: VesperTheme.textMuted,
                onTap: null, // Can't downgrade to free via this screen
              ),
              const SizedBox(height: 16),

              // Starter Tier
              _PlanCard(
                name: 'Starter',
                price: AppConstants.starterMonthlyPrice,
                hashRate: AppConstants.starterTierHashRate,
                features: const [
                  '50 MH/s hash rate (5x)',
                  'Priority task access',
                  '10 ad watches/day',
                  'Reduced withdrawal fee (1.5%)',
                  'Email support',
                ],
                isCurrent: currentTier == 'starter',
                isPopular: false,
                color: VesperTheme.neonCyan,
                onTap: currentTier != 'starter'
                    ? () => _purchase(context, paymentService, 'starter_monthly')
                    : null,
                isLoading: paymentService.isLoading,
              ),
              const SizedBox(height: 16),

              // Pro Tier
              _PlanCard(
                name: 'Pro',
                price: AppConstants.proMonthlyPrice,
                hashRate: AppConstants.proTierHashRate,
                features: const [
                  '200 MH/s hash rate (20x)',
                  'All premium tasks',
                  'Unlimited ad watches',
                  'Reduced withdrawal fee (1%)',
                  'Priority support',
                  'Early feature access',
                ],
                isCurrent: currentTier == 'pro',
                isPopular: true,
                color: VesperTheme.neonPurple,
                onTap: currentTier != 'pro'
                    ? () => _purchase(context, paymentService, 'pro_monthly')
                    : null,
                isLoading: paymentService.isLoading,
              ),
              const SizedBox(height: 16),

              // Elite Tier
              _PlanCard(
                name: 'Elite',
                price: AppConstants.eliteMonthlyPrice,
                hashRate: AppConstants.eliteTierHashRate,
                features: const [
                  '500 MH/s hash rate (50x)',
                  'VIP exclusive tasks',
                  'Unlimited everything',
                  'No withdrawal fee (0%)',
                  'Dedicated support',
                  'Custom referral rewards',
                  'API access',
                ],
                isCurrent: currentTier == 'elite',
                isPopular: false,
                color: VesperTheme.neonGold,
                onTap: currentTier != 'elite'
                    ? () => _purchase(context, paymentService, 'elite_monthly')
                    : null,
                isLoading: paymentService.isLoading,
              ),
              const SizedBox(height: 24),

              // Restore purchases button
              Center(
                child: TextButton(
                  onPressed: paymentService.isLoading
                      ? null
                      : () => _restorePurchases(context, paymentService),
                  child: const Text(
                    'Restore Purchases',
                    style: TextStyle(color: VesperTheme.neonCyan),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Info card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: VesperTheme.bgCard,
                  borderRadius: BorderRadius.circular(VesperTheme.radiusMd),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '💡 How it works',
                      style: TextStyle(
                        color: VesperTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Higher-tier plans give you access to more powerful cloud mining hash rates. '
                      'Your hash rate directly determines how much Bitcoin you mine passively. '
                      'Subscriptions are billed monthly and can be cancelled anytime through the App Store or Google Play.',
                      style: TextStyle(color: VesperTheme.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _purchase(BuildContext context, PaymentService service, String packageId) async {
    final result = await service.purchasePackage(packageId);

    if (mounted) {
      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Welcome to ${result.tier?.toUpperCase()}! 🎉'),
            backgroundColor: VesperTheme.neonGreen,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Purchase failed'),
            backgroundColor: VesperTheme.error,
          ),
        );
      }
    }
  }

  Future<void> _restorePurchases(BuildContext context, PaymentService service) async {
    final result = await service.restorePurchases();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? (result.success ? 'Purchases restored!' : 'No purchases found')),
          backgroundColor: result.success ? VesperTheme.neonGreen : VesperTheme.neonCyan,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showManageSubscription(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: VesperTheme.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(VesperTheme.radiusXl)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Manage Subscription',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: VesperTheme.textPrimary),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.cancel_outlined, color: VesperTheme.error),
              title: const Text('Cancel Subscription'),
              subtitle: const Text('You can resubscribe anytime'),
              onTap: () {
                ref.read(paymentServiceProvider).manageSubscription();
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.restore, color: VesperTheme.neonCyan),
              title: const Text('Restore Purchases'),
              onTap: () {
                _restorePurchases(context, ref.read(paymentServiceProvider));
                Navigator.pop(ctx);
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Color _getTierColor(String tier) {
    switch (tier) {
      case 'starter': return VesperTheme.neonCyan;
      case 'pro': return VesperTheme.neonPurple;
      case 'elite': return VesperTheme.neonGold;
      default: return VesperTheme.textMuted;
    }
  }
}

class _PlanCard extends StatelessWidget {
  final String name;
  final double price;
  final double hashRate;
  final List<String> features;
  final bool isCurrent;
  final bool isPopular;
  final Color color;
  final VoidCallback? onTap;
  final bool isLoading;

  const _PlanCard({
    required this.name,
    required this.price,
    required this.hashRate,
    required this.features,
    required this.isCurrent,
    required this.isPopular,
    required this.color,
    this.onTap,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isCurrent ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: VesperTheme.bgCard,
          borderRadius: BorderRadius.circular(VesperTheme.radiusLg),
          border: Border.all(
            color: isCurrent ? color.withAlpha(100) : color.withAlpha(30),
            width: isCurrent ? 2 : 1,
          ),
          boxShadow: isPopular
              ? [BoxShadow(color: color.withAlpha(30), blurRadius: 20)]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(name, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
                const Spacer(),
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [color, color.withAlpha(150)]),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('POPULAR', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                if (isCurrent)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withAlpha(26),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('CURRENT', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  price == 0 ? 'Free' : '\$${price.toStringAsFixed(2)}/mo',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: VesperTheme.textPrimary),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withAlpha(13),
                    borderRadius: BorderRadius.circular(VesperTheme.radiusSm),
                  ),
                  child: Text('${hashRate.toStringAsFixed(0)} MH/s', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...features.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: color, size: 16),
                  const SizedBox(width: 8),
                  Text(f, style: const TextStyle(color: VesperTheme.textSecondary, fontSize: 13)),
                ],
              ),
            )),
            if (!isCurrent && onTap != null) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: isLoading ? null : onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: color,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VesperTheme.radiusMd)),
                  ),
                  child: isLoading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Upgrade to $name', style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
