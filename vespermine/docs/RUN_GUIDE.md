# 🏃 How to Run VesperMine — Step by Step

This guide walks you through running VesperMine on your machine.
The app runs in **simulation mode** — no real Firebase, AdMob, or payment credentials needed.

---

## Prerequisites

You need:
- A computer (Windows, Mac, or Linux)
- Internet connection
- ~2 GB disk space for Flutter SDK
- ~5 minutes of your time

---

## STEP 1: Install Flutter SDK

### Option A: Windows
1. Go to https://docs.flutter.dev/get-started/install/windows/mobile
2. Download the Flutter SDK zip file
3. Extract it to `C:\src\flutter` (or any path without spaces)
4. Add `C:\src\flutter\bin` to your system PATH:
   - Press `Win + R` → type `sysdm.cpl` → Enter
   - Click "Advanced" tab → "Environment Variables"
   - Under "System variables" → Find `Path` → Click "Edit"
   - Click "New" → Add `C:\src\flutter\bin` → OK all dialogs
5. Open a **new** Command Prompt or PowerShell
6. Run: `flutter --version`

### Option B: Mac
```bash
# Install using Homebrew (recommended)
brew install flutter

# OR download manually:
# https://docs.flutter.dev/get-started/install/macos/mobile-ios
```

### Option C: Linux
```bash
# Using snap (easiest)
sudo snap install flutter --classic

# OR manual install:
cd ~
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:$HOME/flutter/bin"
# Add the export line to your ~/.bashrc or ~/.zshrc
```

### Verify Flutter installation:
```bash
flutter --version
flutter doctor
```

You should see Flutter 3.x.x and it will tell you what's missing.
**Ignore** iOS/Android toolchain warnings for now — we'll use Chrome/web mode.

---

## STEP 2: Get the VesperMine Code

### If you have Git:
```bash
git clone https://github.com/earljohn-spec/VesperCodex.git
cd VesperCodex/vespermine
```

### If you don't have Git:
1. Go to https://github.com/earljohn-spec/VesperCodex
2. Click the green "Code" button → "Download ZIP"
3. Extract the zip file
4. Open terminal/command prompt
5. Navigate to the extracted folder:
   ```bash
   cd Downloads/VesperCodex/vespermine
   ```
   (Adjust the path to where you extracted it)

---

## STEP 3: Install Dependencies

```bash
cd vespermine
flutter pub get
```

This downloads all the packages (Riverpod, Firebase SDK, AdMob, etc.)
It takes 1-3 minutes depending on your internet speed.

**Expected output:**
```
Resolving dependencies...
Got dependencies!
```

If you see errors:
- Make sure you're inside the `vespermine` folder (where `pubspec.yaml` is)
- Try: `flutter clean` then `flutter pub get` again

---

## STEP 4: Run the App

### Option A: Web Browser (Easiest — no phone needed)

Enable web support first (one-time):
```bash
flutter config --enable-web
flutter create . --platforms=web
```

Then run:
```bash
flutter run -d chrome
```

Or for Edge:
```bash
flutter run -d edge
```

### Option B: Android Phone/Emulator

1. Connect your Android phone via USB with USB debugging ON
   - On your phone: Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"
   
2. Check device is detected:
   ```bash
   flutter devices
   ```

3. Run:
   ```bash
   flutter run
   ```

### Option C: Android Emulator (No phone needed)

1. Install Android Studio: https://developer.android.com/studio
2. Open Android Studio → More Actions → Virtual Device Manager
3. Create a Pixel 7 or similar device
4. Start the emulator
5. Then:
   ```bash
   flutter run
   ```

### Option D: iOS (Mac only)

```bash
# One-time setup
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch

# Install CocoaPods
sudo gem install cocoapods

# Run
cd ios
pod install
cd ..
flutter run
```

---

## STEP 5: Use the App

Once the app loads, here's how to test everything:

### 1. Splash Screen
- Shows the VesperMine logo with animation
- Auto-navigates to Login after 3 seconds

### 2. Login
- Email is pre-filled: `demo@vespermine.app`
- Password is pre-filled: `password123`
- Just tap **Sign In**

### 3. Dashboard (Home)
You'll see:
- Your BTC balance card (gradient purple/cyan)
- Quick action buttons: Mine, Earn More, Withdraw
- Stats grid: Today's earnings, streak, hash rate, referrals
- Mining status card
- Earnings breakdown bars

### 4. Start Mining
- Tap the **Mine** tab at the bottom
- You'll see the animated Bitcoin mining visualization
- Tap **Start Mining** button
- Watch the session earnings increase in real-time
- See: uptime, shares completed, power consumption

### 5. Complete Tasks
- Tap the **Tasks** tab
- You'll see available tasks:
  - **Daily Check-in** (+100 sats)
  - **Watch Ad** (+50 sats each, up to 10/day)
  - **Quick Survey** (+200 sats)
  - **Invite a Friend** (+500 sats)
  - **Share on Social** (+150 sats)
- Tap any task to complete it and earn sats
- Watch your balance increase!

### 6. Check Wallet
- Tap the **Wallet** tab
- See your BTC balance and USD equivalent
- See earnings summary (total, today, week, month)
- Tap **Withdraw** to see the withdrawal dialog
- Tap **Link Wallet** to add an external Bitcoin address

### 7. View Profile
- Tap the **Profile** tab
- See your avatar, name, email
- Streak counter, referrals count, tasks completed
- Your referral code
- Settings: Notifications, Biometric, Language
- Tap **Upgrade Plan** to see subscription tiers

### 8. Subscription Plans
- See all 4 tiers: Free, Starter ($4.99), Pro ($14.99), Elite ($29.99)
- Each shows hash rate and features
- Tap "Upgrade" to simulate a purchase
- Your hash rate increases with higher tiers!

---

## 🐛 Troubleshooting

### "flutter: command not found"
- Flutter isn't in your PATH
- Restart your terminal after installing Flutter
- Windows: `set PATH=%PATH%;C:\src\flutter\bin`

### "flutter pub get" fails with SSL error
```bash
flutter pub get --verbose
# If network issues: try a different network or use VPN
```

### "No connected devices"
```bash
flutter devices
# If empty: connect phone or start emulator
# For web: flutter config --enable-web
```

### Build fails on first run
```bash
flutter clean
flutter pub get
flutter run
```

### "Gradle build failed" (Android)
```bash
# Try with more memory
flutter run --no-sound-null-safety
# Or check Java version
java -version  # Should be 17+
```

### App is white screen / crashes
```bash
# Run with verbose logging
flutter run --verbose 2>&1 | tee debug.log
# Check the log for the actual error
```

### "Could not determine the dependencies" (purchases_flutter)
```bash
# purchases_flutter needs platform setup
# For simulation mode, you can temporarily remove it from pubspec.yaml
# Then remove the import from lib/services/payment_service.dart
```

---

## 📁 Project Structure Quick Reference

```
vespermine/
├── lib/                          # All Flutter app code
│   ├── main.dart                 # ← App starts here
│   ├── app.dart                  # App widget + routing
│   ├── config/                   # Theme, routes, constants
│   ├── models/                   # Data models
│   ├── services/                 # Business logic
│   ├── screens/                  # UI screens (10 total)
│   ├── widgets/                  # Reusable components
│   └── utils/                    # Helpers
├── firebase/                     # Backend (Cloud Functions)
├── android/                      # Android platform config
├── ios/                          # iOS platform config
├── pubspec.yaml                  # Dependencies
└── docs/                         # Documentation
```

---

## 🎮 What's Simulated vs Real

| Feature | Simulation Mode | Production Mode |
|---------|----------------|-----------------|
| User login | ✅ Works (local) | Firebase Auth |
| Mining earnings | ✅ Simulated math | NiceHash API |
| Bitcoin price | ✅ Simulated (~$67,500) | CoinGecko API |
| Task rewards | ✅ Works (local) | Firestore |
| Wallet balance | ✅ Works (local) | Firestore |
| Watch ad | ✅ Simulated (3s) | Real AdMob ad |
| Subscriptions | ✅ Simulated purchase | RevenueCat |
| Withdrawal | ✅ Deducts balance | Real BTC transfer |
| Referrals | ✅ Code generated | Firestore + bonus |
| Streaks | ✅ Tracks days | Firestore |

---

## 🚀 Next Steps After Testing

Once you've tested and like the app:

1. **Create Firebase project** → Add real credentials
2. **Create AdMob account** → Replace test ad IDs
3. **Create RevenueCat account** → Replace API keys
4. **Test with real phone** → Check all flows
5. **Build for release** → Submit to stores

See `docs/SETUP_GUIDE.md` for full production setup.

---

## 💬 Need Help?

- Flutter docs: https://docs.flutter.dev
- Flutter Discord: https://discord.gg/flutter
- Stack Overflow: Tag your question with `flutter`

---

**That's it!** The app should be running on your screen in under 10 minutes.
