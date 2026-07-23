import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/firebase_options.dart';
import 'config/theme.dart';
import 'app.dart';
import 'services/service_manager.dart';

/// Flag to control whether Firebase is initialized
/// Set to false for testing without Firebase credentials
bool _enableFirebase = false;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait orientation
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set transparent status bar for immersive look
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  // ============= INITIALIZATION =============
  
  // 1. Initialize Firebase (only if enabled)
  if (_enableFirebase) {
    await _initFirebase();
  } else {
    print('⚠️ Running in SIMULATION MODE (Firebase disabled)');
    print('   To enable Firebase: Set _enableFirebase = true in main.dart');
    print('   Then update lib/config/firebase_options.dart with your config');
  }
  
  // 2. Initialize AdMob (best-effort)
  await _initAdMob();
  
  // 3. Initialize Services (Mining, Tasks, etc.)
  final serviceManager = ServiceManager.instance;
  await serviceManager.initializeAll(firebaseEnabled: _enableFirebase);

  // ============= RUN APP =============
  runApp(
    ProviderScope(
      overrides: [
        serviceManagerProvider.overrideWithValue(serviceManager),
      ],
      child: const VesperMineApp(),
    ),
  );
}

/// Initialize Firebase
Future<void> _initFirebase() async {
  try {
    // Dynamic import to avoid compile-time dependency when Firebase not configured
    final firebaseCore = await _loadFirebaseCore();
    if (firebaseCore) {
      print('✅ Firebase initialized successfully');
    }
  } catch (e) {
    print('⚠️ Firebase init failed: $e');
    print('   Continuing in simulation mode...');
  }
}

/// Load Firebase Core dynamically
Future<bool> _loadFirebaseCore() async {
  try {
    // This will throw if firebase_core is not properly configured
    // ignore: deprecated_member_use
    final module = await _dynamicFirebaseInit();
    return module;
  } catch (e) {
    print('Firebase not available: $e');
    return false;
  }
}

/// Attempt Firebase initialization
Future<bool> _dynamicFirebaseInit() async {
  try {
    // Using dynamic approach so the app doesn't crash if Firebase isn't configured
    // In production, replace this with direct Firebase.initializeApp()
    // await Firebase.initializeApp(options: DefaultFirebaseConfig.currentPlatform);
    print('Firebase initialization skipped (dynamic mode)');
    return false;
  } catch (e) {
    return false;
  }
}

/// Initialize Google Mobile Ads
Future<void> _initAdMob() async {
  try {
    // Dynamic import to avoid crash if AdMob not configured
    final adModule = await _loadAdMob();
    if (adModule) {
      print('✅ AdMob initialized');
    }
  } catch (e) {
    print('⚠️ AdMob init skipped: $e');
  }
}

/// Load AdMob dynamically
Future<bool> _loadAdMob() async {
  try {
    // In production with real SDK:
    // await MobileAds.instance.initialize();
    print('AdMob initialization skipped (dynamic mode)');
    return false;
  } catch (e) {
    return false;
  }
}
