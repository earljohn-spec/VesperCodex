# 🔧 VesperMine Complete Setup Guide

This guide walks you through setting up all integrations for VesperMine.

---

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" → Name it `vespermine`
3. Disable Google Analytics (optional, can enable later)

### 1.2 Enable Services
In Firebase Console:
- **Authentication** → Sign-in method → Enable "Email/Password"
- **Firestore Database** → Create database → Start in test mode
- **Cloud Functions** → Enable (upgrade to Blaze plan required)
- **Cloud Storage** → Enable

### 1.3 Add Apps
- **Android**: Add app → Package name: `com.vespercodex.vespermine` → Download `google-services.json` → Place in `android/app/`
- **iOS**: Add app → Bundle ID: `com.vespercodex.vespermine` → Download `GoogleService-Info.plist` → Place in `ios/Runner/`
- **Web**: Add web app → Copy config

### 1.4 Update Firebase Options
Edit `lib/config/firebase_options.dart`:
```dart
// Replace YOUR_* placeholders with your actual Firebase config
apiKey: 'AIzaSy...',
appId: '1:123456789:android:abcdef',
projectId: 'vespermine',
```

### 1.5 Enable Firebase in App
In `lib/main.dart`, uncomment:
```dart
await Firebase.initializeApp(
  options: DefaultFirebaseConfig.currentPlatform,
);
```

In `lib/services/firebase/firebase_providers.dart`:
```dart
const bool useFirebase = true; // Change from false to true
```

### 1.6 Deploy Cloud Functions
```bash
cd firebase
npm install
firebase login
firebase use --add
firebase deploy --only firestore:rules
firebase deploy --only functions
```

---

## Step 2: Run the App

### Prerequisites
```bash
# Install Flutter
flutter doctor

# Get dependencies
cd vespermine
flutter pub get
```

### Run
```bash
# Android
flutter run -d android

# iOS (macOS only)
flutter run -d ios

# Web
flutter run -d chrome
```

### Emulator Testing
```bash
# List devices
flutter devices

# Run on specific device
flutter run -d emulator-5554
```

---

## Step 3: Firebase Wire-up (done via Step 1.5)

---

## Step 4: AdMob Integration

### 4.1 Create AdMob Account
1. Go to [AdMob](https://admob.google.com)
2. Sign in with your Google account
3. Add your app → "VesperMine"
4. Get your **App ID**

### 4.2 Create Ad Units
In AdMob Console:
1. **Rewarded Ad** → Create → Name: "Watch for Sats"
2. **Interstitial Ad** → Create → Name: "Action Break"
3. **Banner Ad** → Create → Name: "Dashboard Banner"

### 4.3 Update Ad Unit IDs
Edit `lib/services/ad_service.dart`:
```dart
// Replace test IDs with your real AdMob unit IDs
static String get rewardedAdUnitId {
  if (Platform.isAndroid) return 'ca-app-pub-YOUR_ANDROID_UNIT_ID';
  if (Platform.isIOS) return 'ca-app-pub-YOUR_IOS_UNIT_ID';
  return '';
}
```

### 4.4 Add App ID to Platforms

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<manifest>
    <application>
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-YOUR_APP_ID"/>
    </application>
</manifest>
```

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-YOUR_APP_ID</string>
```

### 4.5 Enable SDK
In `pubspec.yaml`, uncomment:
```yaml
google_mobile_ads: ^3.1.0
```

---

## Step 5: Real Mining API (NiceHash)

### 5.1 Create NiceHash Account
1. Go to [NiceHash](https://www.nicehash.com)
2. Create account → Verify email
3. Go to **Settings → API** → Create new API key

### 5.2 Configure Provider
In your app's initialization:
```dart
final manager = ref.read(miningProviderManagerProvider);
await manager.setProvider(
  ProviderType.nicehash,
  apiKey: 'YOUR_NICEHASH_API_KEY',
  apiSecret: 'YOUR_NICEHASH_API_SECRET',
  orgId: 'YOUR_ORG_ID', // optional
);
```

### 5.3 Test Connection
```dart
final status = await manager.getStatus();
print('Provider: ${status.message}');
print('BTC Price: \$${status.btcPrice}');
```

---

## Step 6: RevenueCat Setup

### 6.1 Create RevenueCat Account
1. Go to [RevenueCat](https://www.revenuecat.com)
2. Create project → "VesperMine"
3. Add platforms: Apple App Store + Google Play

### 6.2 Configure Products
In RevenueCat Dashboard → Products:

| Product ID | Type | Price |
|-----------|------|-------|
| `starter_monthly` | Auto-renewing | $4.99/mo |
| `starter_yearly` | Auto-renewing | $39.99/yr |
| `pro_monthly` | Auto-renewing | $14.99/mo |
| `pro_yearly` | Auto-renewing | $119.99/yr |
| `elite_monthly` | Auto-renewing | $29.99/mo |
| `elite_yearly` | Auto-renewing | $239.99/yr |

### 6.3 Configure Entitlements
In RevenueCat Dashboard → Entitlements:

| Entitlement | Products |
|------------|----------|
| `starter` | starter_monthly, starter_yearly |
| `pro` | pro_monthly, pro_yearly |
| `elite` | elite_monthly, elite_yearly |

### 6.4 Get API Keys
- **Public SDK Key** (for app) → Copy for both iOS and Android
- **Secret Key** (for server/webhooks) → Save for Cloud Functions

### 6.5 Update API Keys
Edit `lib/services/payment_service.dart`:
```dart
static const String _appleApiKey = 'appl_YOUR_APPLE_KEY';
static const String _googleApiKey = 'goog_YOUR_GOOGLE_KEY';
```

### 6.6 Configure Webhook
In RevenueCat Dashboard → Webhooks:
- URL: `https://YOUR_CLOUD_FUNCTION_URL/revenuecatWebhook`
- Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION

### 6.7 Enable SDK
In `pubspec.yaml`, add:
```yaml
purchases_flutter: ^6.0.0
```

---

## Step 7: App Store Deployment

### 7.1 Google Play Store
1. Go to [Google Play Console](https://play.google.com/console)
2. Create app → "VesperMine"
3. Fill in store listing (screenshots, description, etc.)
4. Build release:
```bash
flutter build appbundle --release
```
5. Upload `build/app/outputs/bundle/release/app-release.aab`

### 7.2 Apple App Store
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create app → "VesperMine"
3. Build release:
```bash
flutter build ipa --release
```
4. Upload via Xcode or Transporter
5. Submit for review

### 7.3 App Review Tips
- ✅ Clearly label simulated mining as "demo" or "simulation"
- ✅ No on-device mining (banned by both stores)
- ✅ Include privacy policy URL
- ✅ Show data collection practices
- ✅ Test all in-app purchases in sandbox mode before submission

---

## 🔐 Environment Variables

Create `.env` (never commit this):
```
FIREBASE_API_KEY=your_key
NICEHASH_API_KEY=your_key
NICEHASH_API_SECRET=your_secret
REVENUECAT_APPLE_KEY=appl_your_key
REVENUECAT_GOOGLE_KEY=goog_your_key
ADMOB_APP_ID=ca-app-pub-xxxxx~yyyyy
```

---

## 🧪 Testing Checklist

- [ ] Firebase Auth: Sign up, sign in, sign out
- [ ] Firestore: User data read/write
- [ ] Cloud Functions: Mining start/stop, task completion
- [ ] Bitcoin Price: Real-time updates from CoinGecko
- [ ] Ads: Watch rewarded ad → receive sats
- [ ] Subscriptions: Purchase, restore, cancel
- [ ] Mining: Start session → see earnings → stop
- [ ] Wallet: Withdraw to external address
- [ ] Referrals: Share code → friend signs up → bonus

---

## 📞 Support

- Firebase: [firebase.google.com/support](https://firebase.google.com/support)
- RevenueCat: [docs.revenuecat.com](https://docs.revenuecat.com)
- NiceHash: [docs.nicehash.com](https://docs.nicehash.com)
- AdMob: [developers.google.com/admob](https://developers.google.com/admob)
- Flutter: [flutter.dev/docs](https://flutter.dev/docs)
