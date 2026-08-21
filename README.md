# react-native-ota-controller

[![npm version](https://img.shields.io/npm/v/react-native-ota-controller.svg)](https://www.npmjs.com/package/react-native-ota-controller)
[![license](https://img.shields.io/npm/l/react-native-ota-controller.svg)](https://github.com/metadevzone/react-native-ota-controller/blob/main/LICENSE)

A lightweight, zero-config **Over-The-Air (OTA)** bundle updater for React Native (Android & iOS). Push instant JS updates & assets to your users without app store reviews.

---

## ⚡ 1. Install

```bash
npm install react-native-ota-controller react-native-fs react-native-zip-archive
# or: yarn add / pnpm add
```

```bash
# iOS only:
cd ios && pod install && cd ..
```

> 💡 **Auto-Configured**: Native files are automatically set up during install.
>
> ⚠️ **Release Mode Only**: OTA bundle updates take effect **only in Release builds** (`--mode=release`, APK, TestFlight, Production). In **Debug mode**, React Native always loads live JS code from the Metro Bundler (`localhost:metro_port`), ignoring offline OTA bundles on disk.

---

## 💻 2. Basic Usage (`<OTAController />`)

Mount `<OTAController />` in your root or Splash Screen:

```tsx
import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import {
  OTAController,
  OTAControllerProgressPayload,
} from 'react-native-ota-controller';

export default function App() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('0%');

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text>Status: {status}</Text>
      <Text>Progress: {progress}</Text>

      <OTAController
        url="https://your-server.com/bundles/bundle-android.zip"
        autoRestart={true}
        callbacks={{
          onStateChange: (s) => setStatus(s),
          onProgress: (p: OTAControllerProgressPayload) =>
            setProgress(`${p.percentage}%`),
          onError: (e) => console.error(`[${e.code}]:`, e.message),
        }}
      />
    </View>
  );
}
```

---

## 🛠️ 3. Create OTA Bundle (CLI)

Run from your React Native project root:

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

The output zip files will be generated in **`ota-dist/`**:

- `ota-dist/bundle-android(<appVersion>-<otaVersion>).zip`  *(e.g. `bundle-android(1.0.0-1).zip`)*
- `ota-dist/bundle-ios(<appVersion>-<otaVersion>).zip`      *(e.g. `bundle-ios(1.0.0-1).zip`)*

Upload these zip files directly to your server, S3, or CDN.

<details>
<summary><b>🏷️ Build Specific Version (Manual Override)</b></summary>

By default, the CLI auto-increments the OTA version (`1 ➔ 2 ➔ 3...`). If you want to force a specific version number:

```bash
# Force specific version for both platforms:
npx ota build --ota-version 5

# Platform specific:
npx ota build android --ota-version 5
npx ota build ios --ota-version 5
```

</details>

---

## 📊 4. API & Helper Functions

| Function / Component          | Description                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `<OTAController url="..." />` | Drop-in component to auto-check, download, and apply updates.                |
| `getAppVersion()`             | Returns native app version string **synchronously** (e.g. `"1.0.7"`).        |
| `getOtaVersion()`             | Returns active OTA version number **synchronously** (`0` if native default). |
| `restartApp()`                | Immediately reloads the app with the active bundle.                          |

---

## 🔍 Extra Details & Advanced Guides

<details>
<summary><b>⚙️ Advanced / Custom Flow (Imperative <code>OTAService</code>)</b></summary>

```tsx
import {
  getOtaVersion,
  OTAService,
  restartApp,
} from 'react-native-ota-controller';

async function checkAndApplyUpdate() {
  const activeVersion = getOtaVersion(); // ⚡ Synchronous
  const serverVersion = 2; // e.g. from your API

  if (serverVersion <= activeVersion) return;

  await OTAService.downloadAndApplyUpdate({
    url: 'https://your-server.com/bundle-android.zip',
    autoRestart: false,
    onProgress: (payload) => console.log(`${payload.percentage}%`),
    onError: (err) => console.error(err.code, err.message),
  });

  restartApp();
}
```

</details>

<details>
<summary><b>⚠️ Error Codes Reference (<code>onError</code>)</b></summary>

| Error Code             | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `DOWNLOAD_FAILED`      | Network timeout, HTTP 404/500, broken connection |
| `EXTRACTION_FAILED`    | Corrupt zip file or extraction failure           |
| `INVALID_META`         | Missing or corrupt `meta.json` inside bundle     |
| `APP_VERSION_MISMATCH` | Bundle built for different native app version    |
| `ALREADY_IN_PROGRESS`  | Another download is already running concurrently |
| `STORAGE_ERROR`        | Failed to write or promote bundle in storage     |
| `UNKNOWN_ERROR`        | Unexpected runtime exception                     |

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

- **Automatic Crash Rollback**: If a buggy bundle crashes the app twice before startup confirmation, native loader purges OTA storage and rolls back to the built-in app bundle.
- **Native Version Guard**: `meta.json` ensures that bundles compiled for native `1.1.0` are never applied on native `1.0.0`.
- **Automatic Storage Cleanup**: Outdated bundles and downloaded temporary zip files are automatically removed after installation.
- **Atomic File Writing**: `current.json` is updated via atomic rename operations to prevent corruption during sudden app termination.

</details>

---

## 📄 License

MIT © metadevzone
