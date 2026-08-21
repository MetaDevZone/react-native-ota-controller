#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Determine platform argument: default to 'all' if omitted or if options/flags are passed first
let platformArg = process.argv[2];
if (!platformArg || platformArg.startsWith('-')) {
  platformArg = 'all';
}

if (!['android', 'ios', 'all'].includes(platformArg)) {
  console.error(
    'Usage: npx ota-bundle [android|ios|all] [--ota-version <n>] [--android-ota-version <n>] [--ios-ota-version <n>]'
  );
  process.exit(1);
}

function parseIntFlag(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  const raw = process.argv[idx + 1];
  const num = parseInt(raw, 10);
  return Number.isFinite(num) ? num : undefined;
}

const cliGenericOtaVersion = parseIntFlag('--ota-version');
const cliAndroidOtaVersion = parseIntFlag('--android-ota-version') ?? cliGenericOtaVersion;
const cliIosOtaVersion     = parseIntFlag('--ios-ota-version') ?? cliGenericOtaVersion;

function detectAndroidVersion() {
  const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  if (!fs.existsSync(gradlePath)) return null;
  const content = fs.readFileSync(gradlePath, 'utf8');
  const match = content.match(/versionName\s+["']?([^"'\s\n]+)["']?/);
  return match ? match[1] : null;
}

function detectIOSVersionFromPbxproj(iosDir) {
  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    if (entry.endsWith('.xcodeproj')) {
      const pbxPath = path.join(iosDir, entry, 'project.pbxproj');
      if (fs.existsSync(pbxPath)) {
        const content = fs.readFileSync(pbxPath, 'utf8');
        const match = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
        if (match) {
          const ver = match[1].trim().replace(/^["']|["']$/g, '');
          if (ver && ver !== '$(MARKETING_VERSION)') return ver;
        }
      }
    }
  }
  return null;
}

function detectIOSVersion() {
  const iosDir = path.join(process.cwd(), 'ios');
  if (!fs.existsSync(iosDir)) return null;

  // 1. Try resolving MARKETING_VERSION directly from Xcode project file
  const pbxVersion = detectIOSVersionFromPbxproj(iosDir);
  if (pbxVersion) return pbxVersion;

  // 2. Try Info.plist
  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    const plistPath = path.join(iosDir, entry, 'Info.plist');
    if (fs.existsSync(plistPath)) {
      try {
        const result = execSync(
          `plutil -extract CFBundleShortVersionString raw "${plistPath}"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result && result !== '$(MARKETING_VERSION)') return result;
      } catch {
      }
    }
  }

  // 3. Fallback to package.json version if available
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return pkg.version;
    } catch {
    }
  }

  return null;
}

const OTA_VERSION_FILE = path.join(process.cwd(), '.ota-version.json');

function loadOtaVersionState() {
  if (fs.existsSync(OTA_VERSION_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(OTA_VERSION_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveOtaVersionState(state) {
  try {
    fs.writeFileSync(OTA_VERSION_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('OTA: Failed to save .ota-version.json', err);
  }
}

function computeOtaVersion(platform, appVersion, cliOverride) {
  if (cliOverride !== undefined) {
    return cliOverride;
  }
  const state = loadOtaVersionState();
  const platformState = state[platform] || {};

  // If native appVersion changed -> reset to 1
  // If native appVersion is unchanged -> increment (+1)
  if (platformState.appVersion === appVersion && Number.isFinite(platformState.otaVersion)) {
    return platformState.otaVersion + 1;
  }
  return 1;
}

function updateTrackedOtaVersion(platform, appVersion, otaVersion) {
  const state = loadOtaVersionState();
  state[platform] = {
    appVersion,
    otaVersion,
    updatedAt: new Date().toISOString(),
  };
  saveOtaVersionState(state);
}

const OUT_DIR = path.join(process.cwd(), 'ota-dist');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit' });
}

function writeMeta(workDir, appVersion, otaVersion) {
  const meta = {
    appVersion,
    otaVersion,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(workDir, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function bundleAndroid(appVersion, otaVersion) {
  console.log(`\n📦 Building Android bundle | appVersion: ${appVersion} | otaVersion: ${otaVersion}\n`);

  const workDir = path.join(OUT_DIR, '.android-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform android --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'index.android.bundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, otaVersion);

  const zipPath = path.join(OUT_DIR, 'bundle-android.zip');
  fs.rmSync(zipPath, { force: true });
  await zipDirectory(workDir, zipPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  updateTrackedOtaVersion('android', appVersion, otaVersion);

  const size = fs.existsSync(zipPath) ? formatFileSize(fs.statSync(zipPath).size) : 'N/A';
  return {
    platform: 'Android 🤖',
    appVersion,
    otaVersion,
    zipFile: 'ota-dist/bundle-android.zip',
    fileSize: size,
  };
}

async function bundleIOS(appVersion, otaVersion) {
  console.log(`\n📦 Building iOS bundle | appVersion: ${appVersion} | otaVersion: ${otaVersion}\n`);

  const workDir = path.join(OUT_DIR, '.ios-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform ios --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'main.jsbundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, otaVersion);

  const zipPath = path.join(OUT_DIR, 'bundle-ios.zip');
  fs.rmSync(zipPath, { force: true });
  await zipDirectory(workDir, zipPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  updateTrackedOtaVersion('ios', appVersion, otaVersion);

  const size = fs.existsSync(zipPath) ? formatFileSize(fs.statSync(zipPath).size) : 'N/A';
  return {
    platform: 'iOS 🍏',
    appVersion,
    otaVersion,
    zipFile: 'ota-dist/bundle-ios.zip',
    fileSize: size,
  };
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function printSummary(results) {
  console.log('\n' + '='.repeat(70));
  console.log('                   🚀 OTA BUNDLE BUILD SUMMARY');
  console.log('='.repeat(70));

  for (const item of results) {
    console.log(`\n  ${item.platform}`);
    console.log(`    • Native App Version : ${item.appVersion}`);
    console.log(`    • OTA Bundle Version : ${item.otaVersion}`);
    console.log(`    • Bundle File Size   : ${item.fileSize}`);
    console.log(`    • Output Artifact    : ${item.zipFile}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✨ All build artifacts ready in ota-dist/\n');
}

(async () => {
  const results = [];

  if (platformArg === 'android') {
    const appVersion = detectAndroidVersion() ?? 'unknown';
    const otaVersion = computeOtaVersion('android', appVersion, cliAndroidOtaVersion);
    const res = await bundleAndroid(appVersion, otaVersion);
    results.push(res);
  } else if (platformArg === 'ios') {
    const appVersion = detectIOSVersion() ?? 'unknown';
    const otaVersion = computeOtaVersion('ios', appVersion, cliIosOtaVersion);
    const res = await bundleIOS(appVersion, otaVersion);
    results.push(res);
  } else {
    const androidVersion = detectAndroidVersion() ?? 'unknown';
    const androidOtaVer  = computeOtaVersion('android', androidVersion, cliAndroidOtaVersion);

    const iosVersion     = detectIOSVersion() ?? 'unknown';
    const iosOtaVer      = computeOtaVersion('ios', iosVersion, cliIosOtaVersion);

    const androidRes = await bundleAndroid(androidVersion, androidOtaVer);
    const iosRes     = await bundleIOS(iosVersion, iosOtaVer);
    results.push(androidRes, iosRes);
  }

  printSummary(results);
})();
