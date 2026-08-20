#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const platformArg = process.argv[2];

if (!['android', 'ios', 'all'].includes(platformArg)) {
  console.error(
    'Usage: npx ota-bundle <android|ios|all> [--android-ota-version <n>] [--ios-ota-version <n>]'
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

const cliAndroidOtaVersion = parseIntFlag('--android-ota-version');
const cliIosOtaVersion     = parseIntFlag('--ios-ota-version');

function detectAndroidVersion() {
  const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  if (!fs.existsSync(gradlePath)) return null;
  const content = fs.readFileSync(gradlePath, 'utf8');
  const match = content.match(/versionName\s+"([^"]+)"/);
  return match ? match[1] : null;
}

function detectIOSVersion() {
  const iosDir = path.join(process.cwd(), 'ios');
  if (!fs.existsSync(iosDir)) return null;

  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    const plistPath = path.join(iosDir, entry, 'Info.plist');
    if (fs.existsSync(plistPath)) {
      try {
        const result = execSync(
          `plutil -extract CFBundleShortVersionString raw "${plistPath}"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result) return result;
      } catch {
      }
    }
  }
  return null;
}

function getAppVersion(platform) {
  if (platform === 'android') {
    return detectAndroidVersion();
  } else if (platform === 'ios') {
    return detectIOSVersion();
  }
  return detectAndroidVersion() ?? detectIOSVersion();
}

const OUT_DIR = path.join(process.cwd(), 'ota-dist');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit' });
}

function writeMeta(workDir, appVersion, androidOtaVersion, iosOtaVersion) {
  const meta = {
    appVersion,
    builtAt: new Date().toISOString(),
    ...(androidOtaVersion !== undefined && { androidOtaVersion }),
    ...(iosOtaVersion     !== undefined && { iosOtaVersion }),
  };
  fs.writeFileSync(
    path.join(workDir, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );
}

async function bundleAndroid(appVersion) {
  console.log(`\n📦 Building Android bundle for appVersion: ${appVersion}\n`);

  const workDir = path.join(OUT_DIR, '.android-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform android --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'index.android.bundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, cliAndroidOtaVersion, cliIosOtaVersion);

  const zipPath = path.join(OUT_DIR, 'bundle-android.zip');
  fs.rmSync(zipPath, { force: true });
  await zipDirectory(workDir, zipPath);
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`\n✅ Android bundle ready: ${zipPath}`);
}

async function bundleIOS(appVersion) {
  console.log(`\n📦 Building iOS bundle for appVersion: ${appVersion}\n`);

  const workDir = path.join(OUT_DIR, '.ios-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform ios --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'main.jsbundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, cliAndroidOtaVersion, cliIosOtaVersion);

  const zipPath = path.join(OUT_DIR, 'bundle-ios.zip');
  fs.rmSync(zipPath, { force: true });
  await zipDirectory(workDir, zipPath);
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`\n✅ iOS bundle ready: ${zipPath}`);
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

(async () => {
  if (platformArg === 'android') {
    const appVersion = getAppVersion('android') ?? 'unknown';
    await bundleAndroid(appVersion);
  } else if (platformArg === 'ios') {
    const appVersion = getAppVersion('ios') ?? 'unknown';
    await bundleIOS(appVersion);
  } else {
    const androidVersion = detectAndroidVersion() ?? 'unknown';
    const iosVersion     = detectIOSVersion()     ?? 'unknown';
    await bundleAndroid(androidVersion);
    await bundleIOS(iosVersion);
  }
})();
