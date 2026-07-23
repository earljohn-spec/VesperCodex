import 'package:intl/intl.dart';

/// Formatting utilities for VesperMine
class Formatters {
  /// Format BTC amount
  static String btc(double amount, {int decimals = 8}) {
    return amount.toStringAsFixed(decimals);
  }

  /// Format satoshi amount
  static String satoshi(double btcAmount) {
    return (btcAmount * 1e8).toStringAsFixed(0);
  }

  /// Format USD amount
  static String usd(double amount) {
    return NumberFormat.currency(symbol: '\$').format(amount);
  }

  /// Format hash rate
  static String hashRate(double mhPerSecond) {
    if (mhPerSecond >= 1000) {
      return '${(mhPerSecond / 1000).toStringAsFixed(2)} GH/s';
    }
    return '${mhPerSecond.toStringAsFixed(1)} MH/s';
  }

  /// Format duration
  static String duration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    if (seconds < 3600) return '${seconds ~/ 60}m ${seconds % 60}s';
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    return '${hours}h ${minutes}m';
  }

  /// Format relative time
  static String relativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(dateTime);
  }

  /// Format date
  static String date(DateTime dateTime) {
    return DateFormat('MMM d, yyyy').format(dateTime);
  }

  /// Format date time
  static String dateTime(DateTime dateTime) {
    return DateFormat('MMM d, yyyy HH:mm').format(dateTime);
  }

  /// Truncate Bitcoin address
  static String truncateAddress(String address, {int prefixLen = 8, int suffixLen = 6}) {
    if (address.length <= prefixLen + suffixLen + 3) return address;
    return '${address.substring(0, prefixLen)}...${address.substring(address.length - suffixLen)}';
  }
}
