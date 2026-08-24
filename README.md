# react-native-ota-controller

<div align="center">

[![npm version](https://img.shields.io/npm/v/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-blue.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![typescript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/react-native-ota-controller.svg?style=flat-square)](https://github.com/metadevzone/react-native-ota-controller/blob/main/LICENSE)

**A lightweight, secure, and self-hosted Over-The-Air (OTA) update solution for React Native.**  
*Push instant JS bundle & asset updates to your users without waiting for App Store or Google Play reviews.*

</div>

---

## 🌟 Why `react-native-ota-controller`?

- 🔒 **Strict App ID Security Guard**: Verifies bundle package name / bundle identifier at runtime to prevent accidental cross-app bundle injection.
- 🛡️ **Smart Blacklisting & Auto-Skip**: Prevents infinite re-download loops of incompatible bundles and automatically resets on subsequent App Store / Play Store releases or valid OTA updates.
- 🔄 **Native Crash Rollback Protection**: Automatically purges corrupt updates and rolls back to the built-in binary bundle if the app crashes twice on boot.
- 📶 **Network Resilience**: 3-stage automatic retry with connectivity ping and automatic cleanup of partial / interrupted downloads.
- ⚡ **Hermes & New Architecture Ready**: Fully optimized for Hermes bytecode bundles, TurboModules, and New Architecture (`reactHost`).
- 🌐 **100% Self-Hosted & Free**: Host your bundles on AWS S3, Cloudflare R2, Google Cloud Storage, or your own private VPS/CDN.
- 🛠️ **Zero-Config Bundle CLI**: One simple command (`npx ota build`) auto-detects native versions and bundles assets automatically.

---

## 📊 Feature Comparison

| Feature | `react-native-ota-controller` | Microsoft CodePush | Expo Updates |
| :--- | :---: | :---: | :---: |
| **Self-Hosted / Private Server** | ✅ 100% Free & Self-Hosted | ❌ (App Center Deprecated) | ⚠️ Cloud Bound / Paid |
| **Bare React Native** | ✅ Zero-Config Auto-Link | ⚠️ Manual Native Linking | ⚠️ Requires Expo Runtime |
| **Strict App ID Security Check** | ✅ Built-in & Automatic | ⚠️ Manual Verification | ⚠️ Custom Config |
| **Smart Bandwidth Blacklisting** | ✅ Auto-Skip Corrupt URLs | ❌ No | ⚠️ Partial |
| **Native Crash Rollback** | ✅ Native Level Guard | ✅ Supported | ✅ Supported |
| **Hermes Bytecode Support** | ✅ Built-in | ⚠️ Setup required | ✅ Supported |
| **New Architecture Support** | ✅ React Native 0.76+ | ⚠️ Legacy Bridge Only | ✅ Supported |

---

## ⚡ 1. Installation

```bash
# Using npm:
npm install react-native-ota-controller react-native-fs react-native-zip-archive

# Using Yarn:
yarn add react-native-ota-controller react-native-fs react-native-zip-archive

# Using pnpm:
pnpm add react-native-ota-controller react-native-fs react-native-zip-archive
```

```bash
# iOS only (CocoaPods):
cd ios && pod install && cd ..
```

> 💡 **Auto-Configured**: Native build files (Gradle / Podspec) are automatically linked during installation.
>
> ⚠️ **Release Mode Note**: OTA bundle updates execute **only in Release builds** (APK, AAB, TestFlight, Production). In **Debug mode**, React Native always connects to the live Metro Bundler (`localhost:8081`).

---

## 💻 2. Basic Usage (`<OTAController />`)

Mount the `<OTAController />` component in your root `App.tsx` or Splash Screen:

```tsx
import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import {
  OTAController,
  OTAControllerProgressPayload,
} from 'react-native-ota-controller';

export default function App() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('0%');

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={styles.text}>Status: {status}</Text>
      <Text style={styles.text}>Progress: {progress}</Text>

      <OTAController
        url="https://your-server.com/bundles/bundle-android(1.0.0-2).zip"
        autoRestart={true}
        callbacks={{
          onStateChange: (s) => setStatus(s),
          onProgress: (p: OTAControllerProgressPayload) =>
            setProgress(`${p.percentage}%`),
          onError: (e) => console.error(`OTA Error [${e.code}]:`, e.message),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { marginTop: 8, fontSize: 16 },
});
```

---

## 🛠️ 3. Create OTA Bundle (CLI)

Run the CLI command from your project root:

```bash
# ─── 1. Using npx (npm) ─────────────────────────
npx ota build                   # Android & iOS
npx ota build android           # Android only
npx ota build ios               # iOS only

# ─── 2. Using pnpm ──────────────────────────────
pnpm exec ota build             # Android & iOS
pnpm exec ota build android     # Android only
pnpm exec ota build ios         # iOS only

# ─── 3. Using Yarn ──────────────────────────────
yarn ota build                  # Android & iOS
yarn ota build android          # Android only
yarn ota build ios              # iOS only
```

Output archives are saved in **`ota-dist/`**:
- `ota-dist/bundle-android(<appVersion>-<otaVersion>).zip` *(e.g. `bundle-android(1.0.0-2).zip`)*
- `ota-dist/bundle-ios(<appVersion>-<otaVersion>).zip` *(e.g. `bundle-ios(1.0.0-2).zip`)*

Upload these zip files directly to your S3 bucket, CDN, or server.

<details>
<summary><b>🏷️ Version Number Override (Optional)</b></summary>

By default, the CLI auto-increments the OTA version (`1 ➔ 2 ➔ 3...`). If you want to force a specific version number:

```bash
# Force specific version for both platforms:
npx ota build --ota-version 5

# Platform specific:
npx ota build android --android-ota-version 5
npx ota build ios --ios-ota-version 5
```

</details>

---

## 📊 4. API & Helper Functions

| Function / Component | Type | Description |
| :--- | :---: | :--- |
| `<OTAController url="..." />` | Component | Drop-in component to auto-check, download, and apply updates. |
| `getAppId()` | `() => string` | Returns native application ID / bundle identifier **synchronously** (e.g. `"com.company.app"`). |
| `getAppVersion()` | `() => string` | Returns native app version string **synchronously** (e.g. `"1.0.0"`). |
| `getOtaVersion()` | `() => number` | Returns active running OTA version number **synchronously** (`0` if native binary). |
| `restartApp()` | `() => void` | Immediately reloads the app with the newly activated bundle. |

---

## 🔍 Advanced Guides & Error Reference

<details>
<summary><b>⚙️ Custom Imperative Flow (<code>OTAService</code>)</b></summary>

```tsx
import {
  getOtaVersion,
  getAppId,
  getAppVersion,
  OTAService,
  restartApp,
} from 'react-native-ota-controller';

async function checkAndApplyUpdate() {
  const activeVersion = getOtaVersion(); // ⚡ Synchronous
  const serverVersion = 2; // e.g. from your remote API

  if (serverVersion <= activeVersion) return;

  await OTAService.downloadAndApplyUpdate({
    url: 'https://your-server.com/bundle-android(1.0.0-2).zip',
    autoRestart: false,
    onProgress: (payload) => console.log(`Downloading: ${payload.percentage}%`),
    onError: (err) => console.error(err.code, err.message),
  });

  // Prompt user or reload immediately
  restartApp();
}
```

</details>

<details>
<summary><b>⚠️ Error Codes Reference (<code>onError</code>)</b></summary>

| Error Code | Description |
| :--- | :--- |
| `DOWNLOAD_FAILED` | Network timeout, HTTP 404/500, or broken internet connection |
| `EXTRACTION_FAILED` | Corrupt zip file or extraction failure |
| `INVALID_META` | Missing or corrupt `meta.json` manifest inside bundle |
| `APP_ID_MISMATCH` | Bundle was built for a different app package / bundle identifier |
| `APP_VERSION_MISMATCH` | Bundle was compiled for a different native app binary version |
| `UPDATE_BLACKLISTED` | Bundle URL was previously rejected; skipped to save user bandwidth |
| `ALREADY_IN_PROGRESS` | Another download is already running concurrently |
| `STORAGE_ERROR` | Failed to write or promote bundle in local storage |
| `UNKNOWN_ERROR` | Unexpected runtime exception |

</details>

<details>
<summary><b>🔧 Manual Native Setup (Optional)</b></summary>

#### Android (`MainApplication.kt`):

```kotlin
import com.otacontroller.OTAController

// React Native 0.76+ (reactHost):
override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = OTAController.resolveBundlePath(applicationContext)
  )
}

// Legacy ReactNativeHost:
override fun getJSBundleFile(): String? =
  OTAController.resolveBundlePath(applicationContext)
```

#### iOS (`AppDelegate.swift`):

```swift
import OtaController

override func bundleURL() -> URL? {
#if DEBUG
  RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  if let otaURL = OTAController.resolveBundlePath() {
    return otaURL
  }
  return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
}
```

</details>

<details>
<summary><b>🧠 Deep Dive: Under-The-Hood Architecture</b></summary>

- **Strict App ID Verification**: Prevents cross-app bundle injection by verifying package name / bundle identifier at runtime before installation.
- **Smart Blacklist & Auto-Skip**: Prevents infinite re-download loops of incompatible bundles and automatically resets on subsequent App Store / Play Store binary updates or new OTA updates.
- **Network Resilience & Auto-Retry**: Automatically retries downloads with connectivity checks and purges partial corrupt files on abrupt network drops.
- **Automatic Crash Rollback**: If a buggy bundle crashes the app twice before startup confirmation, the native loader purges OTA storage and rolls back to the built-in app bundle.
- **Native Version Guard**: `meta.json` ensures that bundles compiled for native `1.1.0` are never applied on native `1.0.0`.
- **Automatic Storage Cleanup**: Outdated bundles and downloaded temporary zip files are automatically removed after installation.
- **Atomic File Writing**: `current.json` is updated via atomic rename operations to prevent corruption during sudden app termination.

</details>

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Is Over-The-Air updating compliant with Apple App Store and Google Play policies?</b></summary>

Yes! Both Apple (App Store Review Guideline 2.5.2) and Google Play allow Over-The-Air JavaScript updates as long as the updates do not fundamentally change the primary purpose or nature of the application.

</details>

<details>
<summary><b>2. Does this work with Hermes Bytecode enabled?</b></summary>

Yes. The CLI automatically bundles JS using the project's configured Hermes compiler settings, generating fully compatible Hermes bytecode (`.hbc`) for maximum launch performance.

</details>

<details>
<summary><b>3. Where can I host my OTA bundle zip files?</b></summary>

Any static file server, Cloudflare R2, Amazon S3, Google Cloud Storage, DigitalOcean Spaces, or your own custom API server. All you need is a direct HTTP/HTTPS URL to the `.zip` file.

</details>

<details>
<summary><b>4. Does this require Expo or works on Bare React Native?</b></summary>

`react-native-ota-controller` is built specifically for **Bare React Native** (CLI) projects, with full support for React Native 0.70 through the latest React Native 0.76+ (New Architecture).

</details>

---

## 📄 License

MIT © [metadevzone](https://github.com/metadevzone)
