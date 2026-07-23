/// Form validation utilities
class Validators {
  static String? validateEmail(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';
    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(value)) return 'Enter a valid email address';
    return null;
  }

  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  static String? validateName(String? value) {
    if (value == null || value.isEmpty) return 'Name is required';
    if (value.length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  static String? validateBitcoinAddress(String? value) {
    if (value == null || value.isEmpty) return 'Bitcoin address is required';
    // Basic validation for BTC address formats
    final btcRegex = RegExp(r'^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$');
    if (!btcRegex.hasMatch(value)) return 'Invalid Bitcoin address';
    return null;
  }

  static String? validateAmount(String? value, {double? min, double? max}) {
    if (value == null || value.isEmpty) return 'Amount is required';
    final amount = double.tryParse(value);
    if (amount == null) return 'Enter a valid number';
    if (amount <= 0) return 'Amount must be greater than 0';
    if (min != null && amount < min) return 'Minimum amount is $min';
    if (max != null && amount > max) return 'Maximum amount is $max';
    return null;
  }
}
