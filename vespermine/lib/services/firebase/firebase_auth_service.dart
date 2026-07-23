import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../auth_service.dart';
import '../../models/user_model.dart';

/// Firebase Authentication service
/// Replaces the simulated auth with real Firebase Auth
class FirebaseAuthServiceImpl implements AuthService {
  final fb_auth.FirebaseAuth _firebaseAuth = fb_auth.FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  @override
  UserModel? get currentUser {
    final fbUser = _firebaseAuth.currentUser;
    if (fbUser == null) return null;
    // We'll load user data from Firestore
    return null; // Use loadCurrentUser() instead
  }

  @override
  bool get isAuthenticated => _firebaseAuth.currentUser != null;

  /// Load user data from Firestore
  Future<UserModel?> loadCurrentUser() async {
    final fbUser = _firebaseAuth.currentUser;
    if (fbUser == null) return null;

    try {
      final doc = await _firestore.collection('users').doc(fbUser.uid).get();
      if (!doc.exists) return null;
      return UserModel.fromJson(doc.data()!);
    } catch (e) {
      print('Error loading user: $e');
      return null;
    }
  }

  /// Sign in with email and password
  @override
  Future<UserModel> signIn(String email, String password) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final fbUser = credential.user;
      if (fbUser == null) throw Exception('Sign in failed');

      // Load full user data from Firestore
      final user = await loadCurrentUser();
      if (user == null) throw Exception('User data not found');

      return user;
    } on fb_auth.FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          throw Exception('No account found with this email');
        case 'wrong-password':
          throw Exception('Incorrect password');
        case 'invalid-email':
          throw Exception('Invalid email address');
        case 'user-disabled':
          throw Exception('This account has been disabled');
        case 'too-many-requests':
          throw Exception('Too many attempts. Please try again later');
        default:
          throw Exception(e.message ?? 'Sign in failed');
      }
    }
  }

  /// Register new account
  @override
  Future<UserModel> register(String email, String password, String displayName) async {
    try {
      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final fbUser = credential.user;
      if (fbUser == null) throw Exception('Registration failed');

      // Update display name
      await fbUser.updateDisplayName(displayName);

      // Load user data (created by Cloud Function trigger)
      await Future.delayed(const Duration(seconds: 1)); // Wait for trigger
      final user = await loadCurrentUser();
      if (user == null) throw Exception('Failed to create user profile');

      return user;
    } on fb_auth.FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'email-already-in-use':
          throw Exception('This email is already registered');
        case 'weak-password':
          throw Exception('Password is too weak (min 6 characters)');
        case 'invalid-email':
          throw Exception('Invalid email address');
        default:
          throw Exception(e.message ?? 'Registration failed');
      }
    }
  }

  /// Sign out
  @override
  Future<void> signOut() async {
    await _firebaseAuth.signOut();
  }

  /// Update user profile
  @override
  Future<UserModel> updateProfile({String? displayName, String? avatarUrl}) async {
    final fbUser = _firebaseAuth.currentUser;
    if (fbUser == null) throw Exception('Not authenticated');

    if (displayName != null) {
      await fbUser.updateDisplayName(displayName);
    }

    final updates = <String, dynamic>{};
    if (displayName != null) updates['displayName'] = displayName;
    if (avatarUrl != null) updates['avatarUrl'] = avatarUrl;
    updates['lastActiveAt'] = FieldValue.serverTimestamp();

    await _firestore.collection('users').doc(fbUser.uid).update(updates);

    return (await loadCurrentUser())!;
  }

  /// Update streak (called via Cloud Function)
  @override
  Future<UserModel> updateStreak() async {
    // Streak is updated via Cloud Function on daily check-in
    return (await loadCurrentUser())!;
  }

  /// Update subscription tier (called via Cloud Function)
  @override
  Future<UserModel> updateSubscription(String tier) async {
    final fbUser = _firebaseAuth.currentUser;
    if (fbUser == null) throw Exception('Not authenticated');

    await _firestore.collection('users').doc(fbUser.uid).update({
      'subscriptionTier': tier,
    });

    return (await loadCurrentUser())!;
  }
}
