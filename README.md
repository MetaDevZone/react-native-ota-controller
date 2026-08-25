# react-native-ota-controller

<div align="center">

[![npm version](https://img.shields.io/npm/v/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-blue.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![typescript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/react-native-ota-controller.svg?style=flat-square)](https://github.com/metadevzone/react-native-ota-controller/blob/main/LICENSE)

**A lightweight, secure, and self-hosted Over-The-Air (OTA) update solution for React Native.**  
*Deploy instant JavaScript bundle and asset updates directly to users without App Store or Google Play review delays.*

</div>

---

## Key Features

- **Strict App ID Security Guard**: Verifies bundle application ID and package name at runtime to prevent cross-app bundle execution.
- **Native Binary Version Matching**: Ensures OTA updates only execute on the matching native binary version, preventing native runtime incompatibilities.
- **Smart Blacklisting & Auto-Skip**: Prevents redundant re-download attempts for incompatible bundles and automatically resets upon new store releases or valid OTA updates.
- **Native Crash Rollback Protection**: Automatically purges problematic bundles and rolls back to the binary's bundled asset if a startup crash is detected.
- **Network Resilience**: Implements staged retries with connectivity validation and automatic cleanup of partial downloads.
- **Hermes & New Architecture Ready**: Fully compatible with Hermes bytecode bundles, TurboModules, Bridgeless mode, and React Native 0.76+.
- **100% Self-Hosted**: Host update archives on AWS S3, Cloudflare R2, Google Cloud Storage, or any private HTTP/HTTPS endpoint.
- **Integrated Bundle CLI**: Streamlined build commands (`npx ota build`) with automatic version detection and asset packaging.

---

## 1. Installation

```bash
# Using npm
npm install react-native-ota-controller react-native-fs react-native-zip-archive

# Using Yarn
yarn add react-native-ota-controller react-native-fs react-native-zip-archive

# Using pnpm
pnpm add react-native-ota-controller react-native-fs react-native-zip-archive
```

```bash
# iOS only (CocoaPods)
cd ios && pod install && cd ..
```

> **Note:** Native dependencies (Gradle and Podspec) are automatically configured upon installation.  
> **Release Mode Requirement:** OTA bundle loading executes only in Release builds (APK, AAB, TestFlight, Production). In Debug mode, React Native automatically routes to the local Metro Bundler.

<details>
<summary><b>Manual Native Configuration (Optional)</b></summary>

If you prefer to configure native files manually instead of automatic linking:

#### Android (`MainApplication.kt`)

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

#### iOS (`AppDelegate.swift`)

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

---

## 2. Basic Usage (`<OTAController />`)

Mount the `<OTAController />` component in your root component (`App.tsx`) or splash screen:

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

## 3. Creating OTA Bundles (CLI)

Run the build command from your project root:

```bash
# Build for both platforms
npx ota build

# Platform-specific builds
npx ota build android
npx ota build ios
```

Output archives are generated in `ota-dist/`:
- `ota-dist/bundle-android(<appVersion>-<otaVersion>).zip`
- `ota-dist/bundle-ios(<appVersion>-<otaVersion>).zip`

Upload these archives to your CDN or storage bucket.

<details>
<summary><b>Manual OTA Version Override (Optional)</b></summary>

By default, the CLI auto-increments the OTA version based on local state (`1 -> 2 -> 3...`). To set an explicit sequence number:

```bash
# Explicit version for both platforms
npx ota build --ota-version 5

# Platform-specific builds with explicit version
npx ota build android --ota-version 5
npx ota build ios --ota-version 5
```

</details>

---

## 4. API & Helper Functions

- **`<OTAController url="..." />`**  
  Declarative drop-in component to automate update discovery, download, and application.

- **`getAppId(): string`**  
  Synchronously returns the native application package ID / bundle identifier (e.g., `"com.company.app"`).

- **`getAppVersion(): string`**  
  Synchronously returns the current native binary version string (e.g., `"1.0.0"`).

- **`getOtaVersion(): number`**  
  Synchronously returns the active running OTA version number (`0` when running the bundled binary).

- **`restartApp(): void`**  
  Triggers an in-place JavaScript reload with the newly activated bundle without terminating native processes.

---

## 5. Advanced Guides & Error Reference

<details>
<summary><b>Imperative Updates via <code>OTAService</code></b></summary>

For custom update workflows, prompt dialogs, or background synchronization:

```tsx
import {
  getOtaVersion,
  getAppId,
  getAppVersion,
  OTAService,
  restartApp,
} from 'react-native-ota-controller';

async function checkAndApplyUpdate() {
  const activeVersion = getOtaVersion();
  const remoteVersion = 2; // Retrieved from your remote API

  if (remoteVersion <= activeVersion) return;

  await OTAService.downloadAndApplyUpdate({
    url: 'https://your-server.com/bundle-android(1.0.0-2).zip',
    autoRestart: false,
    onProgress: (payload) => console.log(`Download progress: ${payload.percentage}%`),
    onError: (err) => console.error(err.code, err.message),
  });

  // Prompt the user or reload immediately
  restartApp();
}
```

</details>

<details>
<summary><b>Error Codes Reference</b></summary>

- **`DOWNLOAD_FAILED`**: Network timeout, HTTP 404/500, or connection failure.
- **`EXTRACTION_FAILED`**: Corrupt archive or extraction failure.
- **`INVALID_META`**: Missing or invalid `meta.json` manifest within the update archive.
- **`APP_ID_MISMATCH`**: Bundle was built for a different application identifier.
- **`APP_VERSION_MISMATCH`**: Bundle was built for a different native binary version.
- **`UPDATE_BLACKLISTED`**: Bundle URL previously failed validation and is skipped to preserve bandwidth.
- **`ALREADY_IN_PROGRESS`**: Another update download is currently active.
- **`STORAGE_ERROR`**: Storage write or directory promotion failure.
- **`UNKNOWN_ERROR`**: Unhandled runtime exception.

</details>

<details>
<summary><b>Architecture & Reliability Guarantees</b></summary>

- **Application ID Isolation**: Prevents accidental cross-app bundle execution by matching bundle identifiers at runtime.
- **Native Version Guard**: Ensures bundles compiled for a specific native version are never applied to mismatched binaries.
- **Automated Blacklisting**: Isolates failing or corrupt bundle URLs to prevent continuous background download loops.
- **Crash Recovery & Rollback**: Reverts to the bundled asset if consecutive boot failures are detected.
- **Atomic Manifest Updates**: Ensures `current.json` updates are performed atomically to eliminate state corruption.
- **Storage Lifecycle Management**: Automatically prunes stale bundles and temporary extraction artifacts post-installation.

</details>

---

## Frequently Asked Questions

<details>
<summary><b>Is Over-The-Air updating compliant with Apple App Store and Google Play guidelines?</b></summary>

Yes. Both Apple App Store Review Guidelines (Section 2.5.2) and Google Play Store policies permit Over-The-Air JavaScript updates, provided the updates do not alter the primary purpose or functionality of the application.

</details>

<details>
<summary><b>Is Hermes bytecode supported?</b></summary>

Yes. The CLI generates optimized Hermes bytecode (`.hbc`) when Hermes is enabled in the host project, ensuring identical performance to release binaries.

</details>

<details>
<summary><b>Where can update archives be hosted?</b></summary>

Any standard static file host, CDN, or object storage service (Amazon S3, Cloudflare R2, Google Cloud Storage, DigitalOcean Spaces, or self-hosted HTTP/HTTPS servers).

</details>

<details>
<summary><b>Does this support Bare React Native projects?</b></summary>

Yes. `react-native-ota-controller` is purpose-built for Bare React Native projects, supporting React Native 0.70 through the latest New Architecture releases.

</details>

---

## License

MIT © [metadevzone](https://github.com/metadevzone)
