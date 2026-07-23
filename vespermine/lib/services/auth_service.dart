import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import '../config/constants.dart';
import 'dart:math';

/// Authentication service (simulated for now, swap with Firebase Auth later)
class AuthService {
  UserModel? _currentUser;
  bool _isAuthenticated = false;

  UserModel? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;

  /// Sign in with email and password
  Future<UserModel> signIn(String email, String password) async {
    // Simulate network delay
    await Future.delayed(const Duration(seconds: 1));

    // Simulate successful auth
    final uid = 'user_${Random().nextInt(999999).toString().padLeft(6, '0')}';
    
    _currentUser = UserModel(
      uid: uid,
      email: email,
      displayName: email.split('@').first,
      referralCode: UserModel.generateReferralCode(uid),
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      lastActiveAt: DateTime.now(),
      emailVerified: true,
      totalEarned: 0.0015,
      currentBalance: 0.0008,
      currentStreak: 3,
      subscriptionTier: 'free',
    );
    _isAuthenticated = true;

    return _currentUser!;
  }

  /// Register new account
  Future<UserModel> register(String email, String password, String displayName) async {
    await Future.delayed(const Duration(seconds: 1));

    final uid = 'user_${Random().nextInt(999999).toString().padLeft(6, '0')}';
    
    _currentUser = UserModel(
      uid: uid,
      email: email,
      displayName: displayName,
      referralCode: UserModel.generateReferralCode(uid),
      createdAt: DateTime.now(),
      lastActiveAt: DateTime.now(),
      emailVerified: false,
    );
    _isAuthenticated = true;

    return _currentUser!;
  }

  /// Sign out
  Future<void> signOut() async {
    await Future.delayed(const Duration(milliseconds: 500));
    _currentUser = null;
    _isAuthenticated = false;
  }

  /// Update user profile
  Future<UserModel> updateProfile({String? displayName, String? avatarUrl}) async {
    if (_currentUser == null) throw Exception('Not authenticated');
    
    _currentUser = _currentUser!.copyWith(
      displayName: displayName,
      avatarUrl: avatarUrl,
      lastActiveAt: DateTime.now(),
    );

    return _currentUser!;
  }

  /// Update streak
  Future<UserModel> updateStreak() async {
    if (_currentUser == null) throw Exception('Not authenticated');
    
    _currentUser = _currentUser!.copyWith(
      currentStreak: _currentUser!.currentStreak + 1,
      lastActiveAt: DateTime.now(),
    );

    return _currentUser!;
  }

  /// Update subscription tier
  Future<UserModel> updateSubscription(String tier) async {
    if (_currentUser == null) throw Exception('Not authenticated');
    
    _currentUser = _currentUser!.copyWith(
      subscriptionTier: tier,
    );

    return _currentUser!;
  }
}

/// Auth state provider
class AuthState {
  final bool isLoading;
  final UserModel? user;
  final String? error;

  AuthState({
    this.isLoading = false,
    this.user,
    this.error,
  });

  AuthState copyWith({
    bool? isLoading,
    UserModel? user,
    String? error,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      error: error,
    );
  }
}

/// Auth state notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await _authService.signIn(email, password);
      state = AuthState(user: user);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> register(String email, String password, String displayName) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await _authService.register(email, password, displayName);
      state = AuthState(user: user);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> signOut() async {
    state = state.copyWith(isLoading: true);
    await _authService.signOut();
    state = AuthState();
  }
}

// Providers
final authServiceProvider = Provider<AuthService>((ref) => AuthService());
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider));
});
