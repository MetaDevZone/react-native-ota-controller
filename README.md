# react-native-ota-controller

<div align="center">

[![npm version](https://img.shields.io/npm/v/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ota-controller.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-blue.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ota-controller)
[![typescript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![portal](https://img.shields.io/badge/OTALink-Portal-8A2BE2.svg?style=flat-square)](https://otalink.metadevzone.com/)
[![license](https://img.shields.io/npm/l/react-native-ota-controller.svg?style=flat-square)](https://github.com/metadevzone/react-native-ota-controller/blob/main/LICENSE)

**The Official React Native Client SDK for [OTALink](https://otalink.metadevzone.com/)**  
*Ship JavaScript updates before the store review catches up.*

</div>

---

## 🌐 Powered by OTALink Web Platform

[**OTALink** (https://otalink.metadevzone.com/)](https://otalink.metadevzone.com/) is a dedicated release desk and dashboard for React Native teams. Register apps, stage bundles, and activate releases — with a clear record of what is live on every device.

### The 3-Step Release Flow:
1. **Register**: Add your app’s Android package ID (`applicationId`) and iOS bundle ID (`PRODUCT_BUNDLE_IDENTIFIER`) once.
2. **Stage**: Upload your bundle archive, review bundle size, native version compatibility, and release notes before anything reaches user devices.
3. **Activate & Track**: Activate the release with targeted rollout control, tracking real-time downloads and successful installs directly in your OTALink console.

Get your free workspace API key at [**otalink.metadevzone.com**](https://otalink.metadevzone.com/).

---

## Key Features

- **Single Root Configuration (`<OTAProvider />`)**: Configure your API key once at the app root. Zero credentials passed anywhere else.
- **Strict App ID Security Guard**: Verifies bundle application ID and package name at runtime to prevent cross-app bundle execution.
- **Native Binary Version Matching**: Ensures OTA updates only execute on matching native binaries, preventing native runtime crashes.
- **Store Update Priority (`skipOnStoreUpdate`)**: Exposes release flags so your app can easily defer OTA downloads whenever a major native App Store / Google Play update is available.
- **Silent & Interactive Updates**: Support for silent background downloads as well as drop-in interactive UI screens with real-time download progress.
- **Automated Install & Download Telemetry**: Reports `"download"` and `"install"` events to your OTALink dashboard with zero manual tracking code.
- **Smart Blacklisting & Auto-Skip**: Isolates incompatible bundles and automatically resets the blacklist upon new store releases.
- **Native Crash Rollback Protection**: Automatically reverts to the native binary bundle if consecutive boot failures are detected.
- **Hermes & New Architecture Ready**: Compatible with Hermes bytecode bundles, TurboModules, Bridgeless mode, and React Native 0.70+.

---

## 1. Installation & Linking

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

### Automated Native Setup (CLI)
You can automatically configure your iOS `AppDelegate` and Android `MainApplication` using the built-in CLI command:

```bash
npx ota setup
```

*(To remove native code modifications, run `npx ota unlink`).*

<details>
<summary><b>Manual Native Configuration (Optional)</b></summary>

If you prefer to configure native files manually:

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

> **Release Mode Requirement:** OTA bundle loading executes only in Release builds (APK, AAB, TestFlight, Production). In Debug mode, React Native automatically routes to your local Metro Bundler.

---

## 2. SDK Integration (Zero Complexity)

### Step 1: Initialize in `App.tsx` / `App.js`
Mount `<OTAProvider />` once at your root. Pass your API key from [otalink.metadevzone.com](https://otalink.metadevzone.com/).

You can use it either as a **standalone tag** inside a Fragment or as a **wrapper**:

#### Option A: Standalone Tag inside Fragment (Recommended)
```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { OTAProvider } from 'react-native-ota-controller';

export default function App() {
  return (
    <>
      <NavigationContainer>
        {/* Your screens and navigation */}
      </NavigationContainer>

      {/* Initialize OTALink SDK once with your portal key & target channel */}
      <OTAProvider
        apiKey="ota_live_YOUR_APP_KEY"
        channel="production" // "production" | "development" (defaults to "production")
      />
    </>
  );
}
```

#### Option B: Wrapper Syntax
```tsx
export default function App() {
  return (
    <OTAProvider
      apiKey="ota_live_YOUR_APP_KEY"
      channel="production" // "production" | "development"
    >
      <NavigationContainer>
        {/* Your screens and navigation */}
      </NavigationContainer>
    </OTAProvider>
  );
}
```

#### What `<OTAProvider />` does on mount:
- Sets credentials globally across the entire app.
- Confirms native startup to native boot-guard timers.
- Automatically reports the `"install"` telemetry event to your OTALink console if the app just restarted with a new OTA update.
- Automatically cleans up older, inactive bundle directories on disk.

---

### Step 2: Check for Updates in `Splash` Screen

Anywhere in your app, call `OTA.checkForUpdate()` **with zero parameters**. It automatically detects the platform, app ID, current OTA version, and uses the API key configured at root:

```javascript
import { OTA } from 'react-native-ota-controller';
import { checkAppUpdate } from './functions/checkAppUpdate'; // Your store version checker

async function checkUpdates() {
  // Check store & OTA in parallel
  const [storeCheck, otaCheck] = await Promise.all([
    checkAppUpdate(),
    OTA.checkForUpdate(), // Zero arguments needed!
  ]);

  if (otaCheck?.updateAvailable && otaCheck?.release) {
    const release = otaCheck.release;

    // 1. Manage skipOnStoreUpdate: If store update is needed, prioritize store!
    if (release.skipOnStoreUpdate && storeCheck?.needed) {
      refUpdateModal.current?.show({
        url: storeCheck.storeUrl,
        force: true,
      });
      return; // Stop: Do not download OTA update
    }

    // 2. Silent background update
    if (release.updateSilently) {
      OTA.downloadAndApplyUpdate({
        release,
        autoRestart: release.autoRestart, // Respects portal autoRestart setting
      });
      return;
    }

    // 3. Interactive update -> navigate to OTAScreen
    navigation.replace('OTAScreen', { release });
  }
}
```

---

### Step 3: Interactive Progress Screen (`<OTAController />`)

On your animated OTA screen (e.g. `OTAScreen.js`), drop in `<OTAController />`. Back to clean **v1.0.3 simplicity**: takes `release` object, downloads with real-time progress, and auto-restarts. Zero duplicate network check:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { OTAController } from 'react-native-ota-controller';

export default function OTAScreen({ route }) {
  const { release } = route.params || {};
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState('checking');

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Updating App: {progress}%</Text>
      <Text>Status: {status}</Text>

      <OTAController
        release={release}
        autoRestart={true}
        onProgress={({ percentage, downloadedMB, totalMB }) => {
          setProgress(percentage);
        }}
        onStateChange={(state) => {
          setStatus(state); // 'idle' | 'checking' | 'downloading' | 'downloaded' | 'installed' | 'failed'
        }}
        onError={(err) => {
          console.warn('OTA Error:', err.message);
        }}
      />
    </View>
  );
}
```

*(Also supports legacy `callbacks={{ onProgress, onStateChange, onError }}`).*

---

## 3. Creating & Staging Bundles (CLI)

Build your release bundles directly from your project root:

```bash
# Auto-detects target channel directly from <OTAProvider channel={...} /> in your app:
npx ota build

# Platform-specific builds
npx ota build android
npx ota build ios

# Explicit channel override ("production" | "development")
npx ota build android --channel development
npx ota build android --channel production
```

The CLI outputs zip archives ready to stage in [otalink.metadevzone.com](https://otalink.metadevzone.com/):
- `ota-dist/bundle-android-<channel>(<appVersion>-<otaVersion>).zip` *(e.g. `bundle-android-production(1.0.7-1).zip`)*
- `ota-dist/bundle-ios-<channel>(<appVersion>-<otaVersion>).zip` *(e.g. `bundle-ios-production(1.0.7-1).zip`)*

### Staging to OTALink:
1. Open your app workspace at [otalink.metadevzone.com](https://otalink.metadevzone.com/).
2. Click **Stage Bundle** and select the `.zip` from `ota-dist/`.
3. Fill in release notes and verify native version compatibility.
4. Click **Activate** to roll out the update to users!

<details>
<summary><b>Channel-Scoped Version Tracking (`.ota-version.json`)</b></summary>

The CLI automatically isolates and maintains independent build counters for `production` and `development` channels in `.ota-version.json`:

```json
{
  "production": {
    "android": {
      "appVersion": "1.0.7",
      "otaVersion": 1,
      "updatedAt": "2026-09-03T18:00:00.000Z"
    }
  },
  "development": {
    "android": {
      "appVersion": "1.0.7",
      "otaVersion": 5,
      "updatedAt": "2026-09-03T18:30:00.000Z"
    }
  }
}
```

To set an explicit sequence number for a channel:
```bash
npx ota build android --channel development --ota-version 5
```

</details>

---

## 4. Complete API Reference

### `<OTAProvider />`
Root configuration component. Mount once in `App.tsx`.

| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `apiKey` | `string` | **Yes** | App API key obtained from [otalink.metadevzone.com](https://otalink.metadevzone.com/). |
| `channel` | `'development' \| 'production'` | No | Target deployment channel. Defaults to `'production'`. |
| `disableInDev` | `boolean` | No | If `true`, skips update checks in `__DEV__` mode. Defaults to `false`. |
| `children` | `ReactNode` | No | Optional child elements if used as a wrapper. |

---

### `OTA.checkForUpdate(options?)`
Queries the OTALink check-update endpoint (`POST /api/ota/public/check-update`). Automatically reads the `apiKey` and `channel` from `<OTAProvider />`.

```typescript
const result = await OTA.checkForUpdate({
  channel: 'production', // Optional override: 'development' | 'production'
});
```

#### Outgoing POST Request Payload:
```json
{
  "bundleId": "com.yourcompany.app",
  "platform": "android",
  "version_no": "1.0.7",
  "build_no": 0,
  "channel": "production"
}
```

#### Returns `Promise<OTACheckUpdateResult>`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `updateAvailable` | `boolean` | `true` if a newer active OTA release is ready for this device. |
| `release` | `OTAReleaseInfo` | Metadata for the active release (see table below). |
| `isBlackList` | `boolean` | `true` if the release `bundleUrl` was previously rejected/blacklisted on this device. |
| `currentOtaVersion` | `number` | Running OTA version on device. |
| `skipOnStoreUpdate` | `boolean` | `true` if the release specifies prioritizing store updates. |
| `updateSilently` | `boolean` | `true` if the release should be downloaded quietly in the background. |
| `autoRestart` | `boolean` | `true` if the app should reload immediately upon download completion. |
| `reason` | `string` | Reason if no update available (e.g. `"no_active_release"`, `"native_version_too_low"`). |

#### `release` Object Properties:

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique release ID on the OTALink platform. |
| `platform` | `'android' \| 'ios'` | Target platform for this release. |
| `appVersion` | `string` | Native app version targeting this release (e.g. `"1.0.7"`). |
| `buildNumber` | `number` | Native build number targeting this release. |
| `bundleUrl` | `string` | Secure S3/CDN URL to download the update ZIP. |
| `bundleSizeBytes` | `number` | Exact file size of the bundle ZIP in bytes. |
| `skipOnStoreUpdate` | `boolean` | `true` if store update takes priority. |
| `updateSilently` | `boolean` | `true` if update should install without interactive screen. |
| `autoRestart` | `boolean` | `true` if update should restart JS automatically. |
| `publishedAt` | `string` | ISO timestamp when release was activated. |

---

### `OTA.downloadAndApplyUpdate(options)`
Downloads, unpacks into staging, validates `meta.json`, promotes to active bundle directory, and optionally restarts.

```typescript
await OTA.downloadAndApplyUpdate({
  release,
  autoRestart: false,
  onProgress: (payload) => console.log(payload.percentage),
  onError: (err) => console.error(err.code, err.message),
});
```

| Option | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `release` | `OTAReleaseInfo` | No (defaults to cached) | Target release from `checkForUpdate()`. |
| `autoRestart` | `boolean` | No | If `true`, restarts JS bundle automatically after 3.5s. Default: `false`. |
| `onProgress` | `Function` | No | Callback receiving `OTAProgressPayload`. |
| `onError` | `Function` | No | Callback receiving `OTAErrorPayload`. |

#### `OTAProgressPayload`:
```typescript
interface OTAProgressPayload {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  downloadedMB: string;   // e.g. "2.40"
  totalMB: string;        // e.g. "4.80"
  status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'installed' | 'failed';
}
```

---

### `<OTAController />`
Declarative headless component for progress screens (1.0.3 simplicity). Zero duplicate network check.

| Prop | Type | Default | Description |
| :--- | :--- | :---: | :--- |
| `release` | `OTAReleaseInfo` | (cached) | Target release metadata from `checkForUpdate()`. |
| `autoRestart` | `boolean` | `true` | Whether to automatically reload JS after installation. |
| `onProgress` | `Function` | - | Emits `{ downloaded, fullSize, percentage, downloadedMB, totalMB }`. |
| `onStateChange` | `Function` | - | Emits state string (`'checking'`, `'downloading'`, `'downloaded'`, `'installed'`, `'failed'`). |
| `onError` | `Function` | - | Emits `OTAErrorPayload` on download or extraction failure. |
| `callbacks` | `Object` | - | Legacy container object `{ onProgress, onStateChange, onError }`. |

---

### Native Helpers

```javascript
import {
  getAppVersion,
  getOtaVersion,
  getAppId,
  restartApp,
} from 'react-native-ota-controller';

getAppVersion(); // string: native binary version (e.g. "1.0.0")
getOtaVersion(); // number: running OTA version (0 if running binary bundle)
getAppId();      // string: native package/bundle identifier (e.g. "com.company.app")
restartApp();    // triggers immediate in-place JS bundle reload
```

---

## 5. Error Codes Reference

| Error Code | Description |
| :--- | :--- |
| `API_KEY_MISSING` | No `apiKey` provided. Configure `<OTAProvider apiKey="..." />` in `App.tsx`. |
| `UNAUTHORIZED` | Invalid app API key (HTTP 401). Verify key in [otalink.metadevzone.com](https://otalink.metadevzone.com/). |
| `FORBIDDEN` | App bundle ID mismatch or app inactive (HTTP 403). Check registered package ID. |
| `NETWORK_ERROR` | Device offline, connection timeout, or server HTTP 500 error. |
| `DOWNLOAD_FAILED` | ZIP download failed or returned non-200 status code. |
| `EXTRACTION_FAILED` | ZIP archive is corrupted or could not be decompressed. |
| `INVALID_META` | Missing or invalid `meta.json` inside update archive. |
| `APP_ID_MISMATCH` | Bundle was compiled for a different package ID than the running binary. |
| `APP_VERSION_MISMATCH`| Bundle was compiled for a different native version than the running binary. |
| `UPDATE_BLACKLISTED` | Bundle previously failed extraction or validation; skipped to save bandwidth. |
| `ALREADY_IN_PROGRESS` | Another download or extraction operation is currently active. |
| `STORAGE_ERROR` | Failed writing `current.json` or promoting bundle directory. |

---

## 6. Architecture & Reliability Guarantees

- **Application ID Isolation**: Every bundle's embedded `meta.json` must match the running application identifier. Cross-app bundle execution is impossible.
- **Native Version Matching**: Ensures bundles compiled for native binary version `1.0.0` will never execute on `1.1.0`.
- **Automated Blacklisting**: If an archive is corrupt or fails metadata validation, it is blacklisted to prevent infinite download loops. The blacklist automatically clears when a user updates via Google Play or App Store.
- **Crash Recovery & Rollback**: If consecutive boot crashes occur after an update, the module rolls back to the bundled asset automatically.
- **Zero-Overhead Debug Bypass**: In debug builds, all native hooks automatically route to Metro bundler.

---

## Frequently Asked Questions

<details>
<summary><b>Is OTA updating compliant with Apple App Store and Google Play guidelines?</b></summary>

Yes. Both Apple App Store Review Guidelines (Section 2.5.2) and Google Play Store policies permit Over-The-Air JavaScript updates, provided the updates do not alter the primary purpose or core functionality of the application.

</details>

<details>
<summary><b>Is Hermes bytecode supported?</b></summary>

Yes. The CLI generates optimized Hermes bytecode (`.hbc`) when Hermes is enabled in your project, ensuring instant startup identical to native release binaries.

</details>

<details>
<summary><b>Where can I get an API key?</b></summary>

Create a free workspace at [https://otalink.metadevzone.com/](https://otalink.metadevzone.com/). Free workspaces include 1 organization, 5 apps, and 3 teammates with no credit card required.

</details>

<details>
<summary><b>Does this support Bare React Native projects?</b></summary>

Yes. `react-native-ota-controller` is purpose-built for Bare React Native projects, supporting React Native 0.70 through the latest New Architecture releases.

</details>

---

## License

MIT © [metadevzone](https://github.com/metadevzone)
