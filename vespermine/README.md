# ⛏️ VesperMine - Passive Bitcoin Earning App

<div align="center">

![VesperMine](https://img.shields.io/badge/VesperMine-v1.0.0-00F5FF?style=for-the-badge)
![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?style=for-the-badge&logo=flutter)
![Firebase](https://img.shields.io/badge/Firebase-Ready-FFCA28?style=for-the-badge&logo=firebase)
![Platform](https://img.shields.io/badge/Platform-Android%20|%20iOS%20|%20Web-00C853?style=for-the-badge)

**Mine. Earn. Repeat.**

A production-ready cross-platform app for passive Bitcoin earning through cloud mining, daily rewards, and task-based earning.

</div>

---

## 📊 Project Stats

| Metric | Count |
|--------|-------|
| **Total Files** | 80+ |
| **Lines of Code** | 11,500+ |
| **Screens** | 10 |
| **Services** | 10 |
| **Commits** | 7 |

---

## 🏗️ Architecture

```
vespermine/
├── android/                    # Android platform config
│   ├── app/
│   │   ├── build.gradle        # SDK versions, dependencies, signing
│   │   ├── google-services.json # Firebase config (replace with real)
│   │   ├── proguard-rules.pro  # Release build rules
│   │   └── src/main/
│   │       ├── AndroidManifest.xml  # Permissions, AdMob, deep links
│   │       ├── kotlin/.../MainActivity.kt
│   │       └── res/
│   └── build.gradle
│   └── settings.gradle
├── ios/                        # iOS platform config
│   ├── Runner/
│   │   ├── Info.plist          # AdMob, SKAdNetwork, biometric, camera
│   │   └── GoogleService-Info.plist  # Firebase config (replace)
│   └── Podfile                 # CocoaPods deps
├── firebase/                   # Backend infrastructure
│   ├── firebase.json           # Firebase project config
│   ├── firestore/
│   │   ├── firestore.rules     # Security rules
│   │   ├── firestore.indexes.json
│   │   └── storage.rules
│   └── functions/              # Cloud Functions (TypeScript)
│       ├── src/
│       │   ├── index.ts        # Entry point
│       │   ├── auth.ts         # User creation, referrals
│       │   ├── mining.ts       # Mining sessions, earnings
│       │   ├── tasks.ts        # Tasks, check-ins, streaks
│       │   ├── payments.ts     # Subscriptions, withdrawals
│       │   └── price.ts        # BTC price oracle
│       ├── package.json
│       └── tsconfig.json
├── lib/                        # Flutter app
│   ├── main.dart               # Entry point (Firebase + AdMob + Services init)
│   ├── app.dart                # App widget
│   ├── config/
│   │   ├── theme.dart          # Dark cyber/neon theme
│   │   ├── routes.dart         # GoRouter navigation
│   │   ├── constants.dart      # App constants, enums
│   │   └── firebase_options.dart  # Firebase config
│   ├── models/                 # Data models
│   │   ├── user_model.dart
│   │   ├── mining_session.dart
│   │   ├── task.dart
│   │   ├── wallet.dart
│   │   └── earnings.dart
│   ├── services/               # Business logic
│   │   ├── service_manager.dart # Central service coordinator
│   │   ├── auth_service.dart
│   │   ├── mining_service.dart
│   │   ├── task_service.dart
│   │   ├── wallet_service.dart
│   │   ├── earnings_service.dart
│   │   ├── ad_service.dart      # Real AdMob SDK
│   │   ├── payment_service.dart # Real RevenueCat SDK
│   │   ├── firebase/            # Firebase service wrappers
│   │   │   ├── firebase_auth_service.dart
│   │   │   ├── firebase_firestore_service.dart
│   │   │   ├── firebase_functions_service.dart
│   │   │   └── firebase_providers.dart
│   │   └── mining/              # Cloud mining abstraction
│   │       ├── mining_provider_manager.dart
│   │       └── providers/
│   │           ├── mining_provider_interface.dart
│   │           ├── nicehash_provider.dart  # Real API
│   │           └── simulated_provider.dart
│   ├── screens/                 # UI screens
│   │   ├── splash_screen.dart
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── register_screen.dart
│   │   ├── dashboard/
│   │   │   └── dashboard_screen.dart
│   │   ├── mining/
│   │   │   └── mining_screen.dart
│   │   ├── tasks/
│   │   │   └── tasks_screen.dart
│   │   ├── wallet/
│   │   │   └── wallet_screen.dart
│   │   ├── profile/
│   │   │   └── profile_screen.dart
│   │   └── subscriptions/
│   │       └── subscription_screen.dart
│   ├── widgets/                 # Reusable UI
│   │   ├── bottom_nav.dart
│   │   ├── neon_button.dart
│   │   ├── stat_card.dart
│   │   ├── mining_animation.dart
│   │   ├── task_card.dart
│   │   ├── earnings_card.dart
│   │   ├── ad_banner.dart
│   │   └── rewarded_ad_dialog.dart
│   └── utils/
│       ├── formatters.dart
│       └── validators.dart
├── docs/
│   └── SETUP_GUIDE.md           # Complete setup walkthrough
├── pubspec.yaml                 # Dependencies
└── analysis_options.yaml
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Flutter 3.x (Dart) |
| **State** | Riverpod (StateNotifier) |
| **Navigation** | GoRouter |
| **Auth** | Firebase Auth |
| **Database** | Cloud Firestore |
| **Backend** | Firebase Cloud Functions (TypeScript) |
| **Ads** | Google Mobile Ads (AdMob) |
| **Payments** | RevenueCat (purchases_flutter) |
| **Mining** | NiceHash API (provider abstraction) |
| **Analytics** | Firebase Analytics |
| **Crash Reports** | Firebase Crashlytics |
| **Price Oracle** | CoinGecko API |

---

## 💰 Monetization Model

| Revenue Stream | Details |
|---------------|---------|
| **Subscriptions** | 4 tiers: Free ($0), Starter ($4.99), Pro ($14.99), Elite ($29.99) |
| **Ad Revenue** | Rewarded ads (50 sats each, 10/day max), interstitials, banners |
| **Withdrawal Fee** | 2% commission (reduced for higher tiers, 0% for Elite) |

---

## 🎮 Features

### Cloud Mining
- ✅ Simulated mining with realistic economics
- ✅ Provider abstraction (NiceHash ready)
- ✅ Real-time hash rate, shares, uptime tracking
- ✅ Earnings estimation (daily/monthly)
- ✅ Animated mining visualization

### Earning Tasks
- ✅ Daily check-in with streak tracking
- ✅ Watch rewarded ads for sats
- ✅ Surveys, social sharing
- ✅ Referral program (500 sats per referral)
- ✅ Streak milestones (3, 7, 30 days)

### Wallet
- ✅ In-app earnings ledger
- ✅ External wallet linking
- ✅ Withdrawal processing
- ✅ Transaction history

### Payments
- ✅ RevenueCat subscription management
- ✅ 4 subscription tiers
- ✅ Restore purchases
- ✅ Intro price eligibility

---

## 🚀 Quick Start

```bash
# 1. Get dependencies
cd vespermine
flutter pub get

# 2. Configure Firebase
#    - Replace android/app/google-services.json
#    - Replace ios/Runner/GoogleService-Info.plist
#    - Update lib/config/firebase_options.dart

# 3. Configure AdMob
#    - Replace Ad Unit IDs in lib/services/ad_service.dart

# 4. Configure RevenueCat
#    - Replace API keys in lib/services/payment_service.dart

# 5. Run
flutter run
```

---

## 📋 Setup Checklist

- [ ] Create Firebase project + enable Auth, Firestore, Functions
- [ ] Download google-services.json → android/app/
- [ ] Download GoogleService-Info.plist → ios/Runner/
- [ ] Update firebase_options.dart with real config
- [ ] Create AdMob account + ad units
- [ ] Replace test Ad Unit IDs with real ones
- [ ] Add AdMob App ID to AndroidManifest.xml + Info.plist
- [ ] Create RevenueCat project + products
- [ ] Replace RevenueCat API keys
- [ ] Deploy Cloud Functions: `cd firebase && npm install && firebase deploy`
- [ ] Create NiceHash account + API key (for real mining)
- [ ] Test all flows end-to-end
- [ ] Build release: `flutter build appbundle` (Android) / `flutter build ipa` (iOS)
- [ ] Submit to stores

See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed instructions.

---

## ⚠️ Important

- Mining is **simulated** by default. Connect NiceHash API for real mining.
- No on-device mining (banned by app stores).
- AdMob test IDs are included — replace before production.
- May require VASP registration in your jurisdiction.

---

## 📄 License

MIT License
