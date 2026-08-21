const fs = require('fs');
const path = require('path');

function getProjectRoot() {
  // If running from postinstall, INIT_CWD points to the project running npm/yarn install
  const initCwd = process.env.INIT_CWD;
  if (initCwd && fs.existsSync(path.join(initCwd, 'package.json'))) {
    // Check if INIT_CWD is our own package directory
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(initCwd, 'package.json'), 'utf8'));
      if (pkg.name === 'react-native-ota-updater' && fs.existsSync(path.join(initCwd, 'src', 'OTAService.ts'))) {
        return null; // Self-development environment, skip
      }
    } catch (_) {}
    return initCwd;
  }

  // Fallback: Check parent directories up from node_modules
  let current = process.cwd();
  if (current.includes('node_modules')) {
    const root = current.split('node_modules')[0];
    if (fs.existsSync(path.join(root, 'package.json'))) {
      return root;
    }
  }

  // Fallback to process.cwd() if it contains android/ or ios/
  if (fs.existsSync(path.join(current, 'android')) || fs.existsSync(path.join(current, 'ios'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8'));
      if (pkg.name === 'react-native-ota-updater' && fs.existsSync(path.join(current, 'src', 'OTAService.ts'))) {
        return null;
      }
    } catch (_) {}
    return current;
  }

  return null;
}

function findFilesRecursively(dir, filterRegex, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'build' && entry.name !== 'Pods' && entry.name !== '.gradle' && entry.name !== 'node_modules') {
        findFilesRecursively(fullPath, filterRegex, fileList);
      }
    } else if (filterRegex.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function setupAndroid(projectRoot) {
  const androidDir = path.join(projectRoot, 'android');
  if (!fs.existsSync(androidDir)) {
    return { status: 'skipped', reason: 'android directory not found' };
  }

  const mainAppFiles = findFilesRecursively(
    path.join(androidDir, 'app', 'src', 'main', 'java'),
    /^MainApplication\.(kt|java)$/
  );

  if (mainAppFiles.length === 0) {
    return { status: 'skipped', reason: 'MainApplication file not found' };
  }

  const mainAppPath = mainAppFiles[0];
  const isKotlin = mainAppPath.endsWith('.kt');
  let content = fs.readFileSync(mainAppPath, 'utf8');

  if (content.includes('OTAUpdater.resolveBundlePath')) {
    return { status: 'already_configured', file: path.relative(projectRoot, mainAppPath) };
  }

  // 1. Add import
  const importStatement = isKotlin
    ? 'import com.otaupdater.OTAUpdater\n'
    : 'import com.otaupdater.OTAUpdater;\n';

  if (!content.includes('com.otaupdater.OTAUpdater')) {
    const packageIndex = content.indexOf('package ');
    if (packageIndex !== -1) {
      const endOfLine = content.indexOf('\n', packageIndex);
      content = content.slice(0, endOfLine + 1) + '\n' + importStatement + content.slice(endOfLine + 1);
    } else {
      content = importStatement + content;
    }
  }

  // 2. Inject resolveBundlePath
  if (isKotlin) {
    // New Architecture (reactHost / getDefaultReactHost)
    if (content.includes('getDefaultReactHost')) {
      if (content.includes('packageList = PackageList(this).packages')) {
        content = content.replace(
          /(packageList\s*=\s*PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?,?)/,
          `$1\n      jsBundleFilePath = OTAUpdater.resolveBundlePath(applicationContext),`
        );
      } else if (content.includes('context = applicationContext')) {
        content = content.replace(
          /(context\s*=\s*applicationContext,?)/,
          `$1\n      jsBundleFilePath = OTAUpdater.resolveBundlePath(applicationContext),`
        );
      }
    } 
    // Legacy Architecture (ReactNativeHost)
    else if (content.includes('ReactNativeHost(this)') || content.includes('DefaultReactNativeHost(this)')) {
      content = content.replace(
        /(object\s*:\s*(?:Default)?ReactNativeHost\(this\)\s*\{)/,
        `$1\n\n      override fun getJSBundleFile(): String? =\n        OTAUpdater.resolveBundlePath(applicationContext)\n`
      );
    }
  } else {
    // Java - Legacy ReactNativeHost
    if (content.includes('getJSBundleFile()')) {
      content = content.replace(
        /getJSBundleFile\(\)\s*\{[\s\S]*?\}/,
        `getJSBundleFile() {\n      return OTAUpdater.resolveBundlePath(getApplicationContext());\n    }`
      );
    } else if (content.includes('new ReactNativeHost(this)') || content.includes('new DefaultReactNativeHost(this)')) {
      content = content.replace(
        /(new\s+(?:Default)?ReactNativeHost\(this\)\s*\{)/,
        `$1\n\n      @Override\n      protected String getJSBundleFile() {\n        return OTAUpdater.resolveBundlePath(getApplicationContext());\n      }\n`
      );
    }
  }

  fs.writeFileSync(mainAppPath, content, 'utf8');
  return { status: 'configured', file: path.relative(projectRoot, mainAppPath) };
}

function setupIOS(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) {
    return { status: 'skipped', reason: 'ios directory not found' };
  }

  // Check for AppDelegate.swift (Modern React Native)
  const swiftFiles = findFilesRecursively(iosDir, /^AppDelegate\.swift$/);
  if (swiftFiles.length > 0) {
    const appDelegatePath = swiftFiles[0];
    let content = fs.readFileSync(appDelegatePath, 'utf8');

    if (content.includes('OTAUpdater.resolveBundlePath')) {
      return { status: 'already_configured', file: path.relative(projectRoot, appDelegatePath) };
    }

    // 1. Add import
    if (!content.includes('import OtaUpdater')) {
      content = `import OtaUpdater\n` + content;
    }

    // 2. Inject into bundleURL()
    if (content.includes('bundleURL()')) {
      content = content.replace(
        /(override\s+func\s+bundleURL\(\)\s*->\s*URL\?\s*\{[\s\S]*?#else\s*\n)/,
        `$1    if let otaURL = OTAUpdater.resolveBundlePath() {\n      return otaURL\n    }\n`
      );
    }

    fs.writeFileSync(appDelegatePath, content, 'utf8');
    return { status: 'configured', file: path.relative(projectRoot, appDelegatePath) };
  }

  // Check for AppDelegate.mm (Objective-C++)
  const mmFiles = findFilesRecursively(iosDir, /^AppDelegate\.mm$/);
  if (mmFiles.length > 0) {
    const appDelegatePath = mmFiles[0];
    let content = fs.readFileSync(appDelegatePath, 'utf8');

    if (content.includes('OTAUpdater')) {
      return { status: 'already_configured', file: path.relative(projectRoot, appDelegatePath) };
    }

    return { 
      status: 'notice', 
      file: path.relative(projectRoot, appDelegatePath),
      message: 'Detected Objective-C++ AppDelegate.mm. Please follow manual setup for iOS.' 
    };
  }

  return { status: 'skipped', reason: 'AppDelegate file not found' };
}

function runSetup() {
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    // Running in own package repo or invalid root, skip silently
    return;
  }

  console.log('\n📦 [react-native-ota-controller] Configuring native bundle loaders...');

  try {
    const androidResult = setupAndroid(projectRoot);
    if (androidResult.status === 'configured') {
      console.log(`  ✅ Android: Configured in ${androidResult.file}`);
    } else if (androidResult.status === 'already_configured') {
      console.log(`  ✨ Android: Already configured in ${androidResult.file}`);
    } else {
      console.log(`  ℹ️  Android: ${androidResult.reason}`);
    }

    const iosResult = setupIOS(projectRoot);
    if (iosResult.status === 'configured') {
      console.log(`  ✅ iOS: Configured in ${iosResult.file}`);
    } else if (iosResult.status === 'already_configured') {
      console.log(`  ✨ iOS: Already configured in ${iosResult.file}`);
    } else if (iosResult.status === 'notice') {
      console.log(`  ⚠️  iOS: ${iosResult.message}`);
    } else {
      console.log(`  ℹ️  iOS: ${iosResult.reason}`);
    }

    console.log('🚀 [react-native-ota-controller] Setup complete!\n');
  } catch (err) {
    console.warn('⚠️  [react-native-ota-controller] Auto-setup skipped:', err.message);
  }
}

module.exports = { runSetup, setupAndroid, setupIOS, getProjectRoot };

if (require.main === module) {
  runSetup();
}
