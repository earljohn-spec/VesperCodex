import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../models/user_model.dart';
import '../auth_service.dart';
import 'firebase_auth_service.dart';
import 'firebase_firestore_service.dart';
import 'firebase_functions_service.dart';

/// Whether to use real Firebase or mock services
/// Set to true when Firebase is configured
const bool useFirebase = false; // TODO: Change to true when Firebase is configured

/// Provider for Firebase Auth Service
final firebaseAuthProvider = Provider<FirebaseAuthServiceImpl>((ref) {
  return FirebaseAuthServiceImpl();
});

/// Provider for Firestore Service
final firestoreServiceProvider = Provider<FirestoreService>((ref) {
  return FirestoreService();
});

/// Provider for Cloud Functions Service
final cloudFunctionsProvider = Provider<CloudFunctionsService>((ref) {
  if (useFirebase) {
    return CloudFunctionsService();
  }
  return MockCloudFunctionsService();
});

/// Provider for the current user stream from Firestore
final currentUserStreamProvider = StreamProvider<UserModel?>((ref) {
  final currentUser = fb_auth.FirebaseAuth.instance.currentUser;
  if (currentUser == null) return Stream.value(null);

  return FirebaseFirestore.instance
      .collection('users')
      .doc(currentUser.uid)
      .snapshots()
      .map((doc) {
    if (!doc.exists) return null;
    return UserModel.fromJson(doc.data()!);
  });
});

/// Provider for Bitcoin price stream
final bitcoinPriceStreamProvider = StreamProvider<double>((ref) {
  if (!useFirebase) {
    // Return mock price with slight fluctuation
    return Stream.periodic(
      const Duration(seconds: 30),
      (count) => 67500.0 + (count % 10) * 100,
    );
  }
  return ref.watch(firestoreServiceProvider).bitcoinPriceStream();
});

/// Provider for current auth state from Firebase
final firebaseAuthStateProvider = StreamProvider<fb_auth.User?>((ref) {
  return fb_auth.FirebaseAuth.instance.authStateChanges();
});
