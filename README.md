# react-native-ota-updater

[![npm version](https://img.shields.io/npm/v/react-native-ota-updater.svg)](https://www.npmjs.com/package/react-native-ota-updater)
[![license](https://img.shields.io/npm/l/react-native-ota-updater.svg)](https://github.com/saad.com/react-native-ota-updater/blob/main/LICENSE)

A lightweight, production-ready **Over-The-Air (OTA)** JavaScript bundle and asset updater for React Native applications (Android & iOS). Push bug fixes, UI updates, and feature enhancements directly to your users instantly without waiting for Play Store or App Store review cycles.

---

## 📚 Table of Contents

- [🎯 Key Features](#-key-features)
- [📦 Required Peer Dependencies](#-required-peer-dependencies)
- [⚙️ Step-by-Step Installation & Native Setup](#️-step-by-step-installation--native-setup)
  - [1. Install Packages](#1-install-packages)
  - [2. Android Setup (`MainApplication.kt`)](#2-android-setup-mainapplicationkt)
  - [3. iOS Setup (`AppDelegate.swift`)](#3-ios-setup-appdelegateswift)
- [💻 Component & Usage Guide](#-component--usage-guide)
  - [Declarative Approach (`<OTAUpdater />`)](#declarative-approach-otaupdater-)
  - [Imperative Approach (`OTAService`)](#imperative-approach-otaservice)
- [🛠️ CLI Bundle Generation (`npx ota-bundle`)](#️-cli-bundle-generation-npx-ota-bundle)
- [🧠 Deep Dive: How It Works Under The Hood](#-deep-dive-how-it-works-under-the-hood)
  - [1. The `current.json` Manifest File](#1-the-currentjson-manifest-file)
  - [2. The `meta.json` Bundle Safety File](#2-the-metajson-bundle-safety-file)
  - [3. Storage Management & Disk Cleanup](#3-storage-management--disk-cleanup)
  - [4. Automatic Crash Rollback System](#4-automatic-crash-rollback-system)
  - [5. Version Comparison & Downgrade Prevention](#5-version-comparison--downgrade-prevention)
- [📊 API & Props Reference](#-api--props-reference)
- [📄 License](#-license)

---

## 🎯 Key Features

- ⚡ **No-Backend Component API**: Provide a direct bundle `.zip` URL and version numbers directly in your TSX components — no complex backend API server required.
- 🔍 **Smart Version Guard & Skip**: Automatically compares target version against the installed active version on boot. If the app is already up-to-date or if a lower/equal version is passed, download is skipped instantly.
- 📊 **Granular Status Lifecycle**: Track update progress seamlessly with status transitions: `idle` ➔ `checking` ➔ `downloading` ➔ `downloaded` ➔ `installed` | `failed`.
- 🔒 **Native Version Guard (`meta.json`)**: Rejects OTA bundles built for a different native app version (e.g., bundle built for native `1.1.0` will auto-reject on native `1.0.0`).
- 🛡️ **Automatic Crash Rollback**: If a corrupt or faulty OTA bundle crashes the app twice on startup before boot confirmation, the native loader wipes OTA storage and rolls back to the built-in native bundle.
- 💾 **Atomic Storage Operations**: Write-then-rename file operations guarantee metadata (`current.json`) integrity even during sudden app termination or power loss.
- 🧹 **Automatic Disk Cleanup**: Old bundle versions and temporary zip archives are automatically purged from disk to conserve device storage space.
- 🔄 **Flexible Restart Control**: Auto-restart immediately upon install or defer app restart to user action.
- 📦 **Cross-Platform CLI**: Built-in CLI tool (`npx ota-bundle`) generates bundle zips on macOS, Linux, and Windows in a single command.

---

## 📦 Required Peer Dependencies

To prevent version conflicts with native modules, `react-native-ota-updater` relies on standard, high-performance peer dependencies:

| Package | Minimum Version | Purpose |
|---|---|---|
| `react-native` | `>= 0.60` | Core React Native framework |
| `react-native-fs` | `>= 2.20.0` | File system operations (downloading zip, writing current.json, disk cleanup) |
| `react-native-zip-archive` | `>= 6.0.0` | High-speed native unzipping utility to extract bundle zip archives |

---

## ⚙️ Step-by-Step Installation & Native Setup

### 1. Install Packages

Run the following command in your React Native project root:

```bash
# Using npm
npm install react-native-ota-updater react-native-fs react-native-zip-archive

# Using yarn
yarn add react-native-ota-updater react-native-fs react-native-zip-archive
```

#### iOS CocoaPods Link
```bash
cd ios && pod install && cd ..
```

---

### 2. Android Setup (`MainApplication.kt`)

Open `android/app/src/main/java/.../MainApplication.kt` (or `.java`).

#### New Architecture (React Native 0.76+ with `reactHost`)

```kotlin
package com.yourapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.otaupdater.OTAUpdater // 👈 1. Import OTAUpdater

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply {
        add(OTAUpdater.getRestartPackage()) // 👈 2. Register restart package
      },
      jsBundleFilePath = OTAUpdater.resolveBundlePath(applicationContext) // 👈 3. Resolve active OTA bundle path
    )
  }
}
```

#### Legacy Architecture (`reactNativeHost`)

```kotlin
package com.yourapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.otaupdater.OTAUpdater // 👈 1. Import OTAUpdater

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {

      override fun getJSBundleFile(): String? =
        OTAUpdater.resolveBundlePath(applicationContext) // 👈 2. Resolve active OTA bundle path

      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {
          add(OTAUpdater.getRestartPackage()) // 👈 3. Register restart package
        }
    }
}
```

---

### 3. iOS Setup (`AppDelegate.swift`)

Open `ios/<YourProjectName>/AppDelegate.swift`. Update `bundleURL()` to resolve the active OTA bundle path:

```swift
import UIKit
import React
import React_RCTAppDelegate
import OtaUpdater // 👈 1. Import OtaUpdater

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // ... standard setup ...
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    // 👈 2. Resolve active OTA bundle path; fallback to embedded main.jsbundle
    if let otaURL = OTAUpdater.resolveBundlePath() {
      return otaURL
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

---

## 💻 Component & Usage Guide

### Declarative Approach (`<OTAUpdater />`)

Mount `<OTAUpdater />` anywhere in your component hierarchy (e.g. Root App component or Splash Screen).

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  OTAUpdater,
  OTAProgressPayload,
  OTAUpdaterProgressPayload,
} from 'react-native-ota-updater';

export default function App() {
  const [status, setStatus] = useState<OTAProgressPayload['status']>('idle');
  const [progressText, setProgressText] = useState<string>('0%');

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={styles.statusText}>OTA Status: {status}</Text>
      <Text style={styles.progressText}>Progress: {progressText}</Text>

      <OTAUpdater
        url="https://your-server.com/bundles/bundle-android.zip"
        androidOtaVersion={1}
        iosOtaVersion={1}
        autoRestart={true}
        callbacks={{
          onStateChange: (state) => {
            console.log('OTA State:', state);
            setStatus(state);
          },
          onProgress: (payload: OTAUpdaterProgressPayload) => {
            const sizeInfo = payload.totalMB
              ? `${payload.downloadedMB} / ${payload.totalMB}`
              : payload.downloadedMB;
            setProgressText(`${payload.percentage}% (${sizeInfo})`);
          },
          onError: (error: Error) => {
            console.error('OTA Error:', error.message);
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 16, marginTop: 12 },
  progressText: { fontSize: 14, color: '#666', marginTop: 4 },
});
```

---

### Imperative Approach (`OTAService`)

For advanced custom flows (such as checking updates via your own backend API first):

```tsx
import { OTAService, restartApp } from 'react-native-ota-updater';

async function handleUpdateFlow() {
  // 1. Read current active version on device
  const currentVersion = await OTAService.getActiveVersion();
  const serverOtaVersion = 2; // e.g. fetched from your backend API

  if (serverOtaVersion <= currentVersion) {
    console.log('App is already up to date!');
    return;
  }

  // 2. Download and apply update
  await OTAService.downloadAndApplyUpdate({
    downloadUrl: 'https://your-server.com/bundles/bundle-android.zip',
    bundleVersion: serverOtaVersion,
    autoRestart: false, // Don't auto restart immediately
    onProgress: (payload) => {
      console.log(`Status: ${payload.status}, Progress: ${payload.percentage}%`);
    },
  });

  // 3. Restart app when user taps "Restart Now"
  restartApp();
}
```

---

## 🛠️ CLI Bundle Generation (`npx ota-bundle`)

The package includes a built-in CLI tool `npx ota-bundle` that compiles React Native JS bundles, bundles assets, injects `meta.json`, and creates zip packages for Android & iOS.

### Commands

Run from your React Native project root:

```bash
# Auto-detect native appVersion from build.gradle / Info.plist:
npx ota-bundle android
npx ota-bundle ios
npx ota-bundle all

# Optional strict version flags (embeds otaVersion inside meta.json):
npx ota-bundle android --android-ota-version 1
npx ota-bundle ios --ios-ota-version 1
npx ota-bundle all --android-ota-version 1 --ios-ota-version 1
```

### Artifact Outputs
The CLI creates an `ota-dist/` folder containing:
- `ota-dist/bundle-android.zip` (Contains `index.android.bundle`, asset files, and `meta.json`)
- `ota-dist/bundle-ios.zip` (Contains `main.jsbundle`, asset files, and `meta.json`)

Upload these zip files to your static server, S3 bucket, or CDN.

---

## 🧠 Deep Dive: How It Works Under The Hood

```
[ Developer ]
   │
   ├─► Runs `npx ota-bundle all` ──► Generates bundle zip files in `ota-dist/`
   └─► Uploads zip files to CDN / Server
 
[ Native App Startup (Before JS Engine Runs) ]
   │
   ├─► `OTAUpdater.resolveBundlePath()` executes in Kotlin/Swift
   ├─► Reads `OTA/current.json` from device storage
   │     ├─► Valid & Native Version Matches  ──► Returns path to active OTA bundle
   │     └─► Missing / Corrupt / Version Mismatch ──► Wipes OTA & returns null (fallback to APK/IPA bundle)
   │
[ React Native JS Startup ]
   │
   ├─► `<OTAUpdater />` mounts
   ├─► Calls `OTAService.reportBootSuccess()` (resets native crash counter to 0)
   ├─► Emits state: 'checking'
   ├─► Compares prop version (e.g. 2) vs device active version (e.g. 1)
   │     ├─► Version <= Active ──► Emits 'downloaded' & Skips download
   │     └─► Version > Active  ──► Starts download & emits 'downloading'
   │
   ├─► Downloads zip (3 retries with HEAD connectivity check)
   ├─► Verifies optional SHA-256 hash & extracts zip
   ├─► Verifies `meta.json` (native appVersion & platform otaVersion match)
   ├─► Atomically updates `current.json` & deletes old bundle folder
   └─► If `autoRestart` is true ──► Calls `restartApp()`
```

---

### 1. The `current.json` Manifest File

#### What & Where is it?
`current.json` is the internal state tracker file stored in device storage:
- **Android:** `context.filesDir + "/OTA/current.json"`
- **iOS:** `Documents/OTA/current.json`

#### What data does it hold?
```json
{
  "activeVersion": 2,
  "activeBundlePath": "/path/to/OTA/bundles/bundle2/index.android.bundle",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "updatedAt": "2026-08-12T16:00:00.000Z",
  "bootFailCount": 0,
  "builtForNativeVersion": "1.0.0"
}
```

#### Why Atomic Writes (`writeCurrent`)?
During update installation, `current.json` is written using a 3-step atomic process:
1. Write JSON data to temporary file `current.json.tmp`.
2. Delete destination file `current.json` if present.
3. Rename `current.json.tmp` ➔ `current.json`.

**Purpose:** If the phone turns off or the app is killed during file writing, `current.json` will NEVER remain in an incomplete or corrupted state. It either completely succeeds or retains the previous safe state.

---

### 2. The `meta.json` Bundle Safety File

#### What & Where is it?
`meta.json` is an internal manifest automatically created by `npx ota-bundle` inside the root of every bundle `.zip` file.

```json
{
  "appVersion": "1.0.0",
  "androidOtaVersion": 2,
  "iosOtaVersion": 2,
  "builtAt": "2026-08-12T16:00:00.000Z"
}
```

#### Why is it used?
When an update zip is extracted on device, `OTAService` reads `meta.json` BEFORE applying the bundle:
1. **Native Version Guard:** If `meta.json` has `"appVersion": "1.1.0"` but the device is running Native App `"1.0.0"`, the bundle is immediately rejected and deleted. This prevents JS code that depends on new native modules from crashing old native builds.
2. **OTA Version Guard:** If `--android-ota-version` was specified at build time, it verifies that the bundle version matches the expected target version.

---

### 3. Storage Management & Disk Cleanup

To prevent mobile device storage from filling up over time, `react-native-ota-updater` automatically cleans disk space in 3 scenarios:

1. **Post-Update Cleanup:** Right after extracting a new bundle and writing `current.json`, the temporary downloaded `.zip` file is deleted, and the previous extracted bundle directory (e.g. `bundle1`) is permanently removed.
2. **Native Store Update Cleanup:** When a user updates the app via Google Play Store or Apple App Store, the native `appVersion` changes. Native `OTABundleLoader` detects that `builtForNativeVersion != currentNativeVersion` and executes `clearAll()`, purging all old OTA bundles.
3. **Crash Rollback Cleanup:** If a bad bundle causes consecutive startup crashes, `clearAll()` wipes the entire `OTA/` root directory.

---

### 4. Automatic Crash Rollback System

If a buggy OTA bundle with JS syntax errors or unhandled exceptions is deployed:

1. On native app boot, native `OTABundleLoader` increments the native boot attempt counter in `SharedPreferences` / `UserDefaults`.
2. When JS mounts successfully, `<OTAUpdater />` calls `reportBootSuccess()`, which resets the boot attempt counter to `0`.
3. If the JS bundle crashes before calling `reportBootSuccess()` for **2 consecutive app launches**, native `OTABundleLoader` detects `bootAttempt >= 2`.
4. Native loader automatically executes `clearAll()`, deleting the faulty OTA bundle, and falls back to the embedded APK/IPA native bundle. **The app will never get stuck in an infinite crash loop!**

---

### 5. Version Comparison & Downgrade Prevention

When `<OTAUpdater androidOtaVersion={X} />` runs:
- `activeVersion` is read from `current.json` (defaults to `0` for fresh installs).
- If `bundleVersion <= activeVersion`, the update process **instantly skips** and emits status `'downloaded'`. No network request or file download takes place.
- Only when `bundleVersion > activeVersion` will a download be executed.

---

## 📊 API & Props Reference

### `<OTAUpdater />` Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | Yes | Download URL of the compiled bundle `.zip` file |
| `androidOtaVersion` | `number` | Yes | Target OTA bundle version number for Android |
| `iosOtaVersion` | `number` | Yes | Target OTA bundle version number for iOS |
| `autoRestart` | `boolean` | No | Auto-restart app after successful install. Default: `false` |
| `bundleHash` | `string` | No | Optional SHA-256 hash for bundle integrity verification |
| `callbacks` | `OTAUpdaterCallbacks` | No | Event handlers (`onProgress`, `onStateChange`, `onError`) |

### `OTAProgressPayload`

| Field | Type | Description |
|---|---|---|
| `status` | `'idle' \| 'checking' \| 'downloading' \| 'downloaded' \| 'installed' \| 'failed'` | Current execution lifecycle status |
| `percentage` | `number` | Progress percentage (`0-99` downloading, `100` complete, `-1` if size unknown) |
| `downloadedBytes` | `number` | Raw bytes downloaded so far |
| `totalBytes` | `number` | Total bytes expected (`0` if unknown) |
| `downloadedMB` | `string` | Formatted downloaded size string (e.g. `"12.5 MB"`) |
| `totalMB` | `string` | Formatted total size string (e.g. `"45.0 MB"`, or `""` if unknown) |

### Helper Exports

- **`restartApp()`**: Immediately reloads/restarts the React Native app.
- **`getAppVersion()`**: Returns native app version string (e.g. `"1.0.0"`).
- **`OTAService.getActiveVersion()`**: Returns active OTA bundle version on disk (`0` if native default).

---

## 📄 License

MIT © Saadullah
