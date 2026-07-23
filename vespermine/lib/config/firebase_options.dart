import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for VesperMine
/// 
/// SETUP INSTRUCTIONS:
/// 1. Create a Firebase project at https://console.firebase.google.com
/// 2. Add an Android app and download google-services.json → place in android/app/
/// 3. Add an iOS app and download GoogleService-Info.plist → place in ios/Runner/
/// 4. Replace the values below with your actual Firebase project config
/// 5. Enable these services in Firebase Console:
///    - Authentication (Email/Password)
///    - Firestore Database
///    - Cloud Functions
///    - Cloud Storage
/// 6. Uncomment Firebase initialization in lib/main.dart
class DefaultFirebaseConfig {
  /// Firebase options for Web platform
  static FirebaseOptions get web => const FirebaseOptions(
    apiKey: 'YOUR_WEB_API_KEY',
    appId: 'YOUR_WEB_APP_ID',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    projectId: 'vespermine',
    authDomain: 'vespermine.firebaseapp.com',
    storageBucket: 'vespermine.appspot.com',
    measurementId: 'YOUR_MEASUREMENT_ID',
  );

  /// Firebase options for Android platform
  static FirebaseOptions get android => const FirebaseOptions(
    apiKey: 'YOUR_ANDROID_API_KEY',
    appId: 'YOUR_ANDROID_APP_ID',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    projectId: 'vespermine',
    storageBucket: 'vespermine.appspot.com',
  );

  /// Firebase options for iOS platform
  static FirebaseOptions get ios => const FirebaseOptions(
    apiKey: 'YOUR_IOS_API_KEY',
    appId: 'YOUR_IOS_APP_ID',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    projectId: 'vespermine',
    storageBucket: 'vespermine.appspot.com',
    iosBundleId: 'com.vespercodex.vespermine',
  );

  /// Get the current platform's Firebase options
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseConfig are not supported for this platform.',
        );
    }
  }
}
