const fs = require('fs');
const path = require('path');

function getProjectRoot() {
  const initCwd = process.env.INIT_CWD;
  if (initCwd && fs.existsSync(path.join(initCwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(initCwd, 'package.json'), 'utf8'));
      if (
        (pkg.name === 'react-native-ota-controller' || pkg.name === 'react-native-ota-updater') &&
        fs.existsSync(path.join(initCwd, 'src', 'OTAService.ts'))
      ) {
        return null; // Self-development environment, skip
      }
    } catch (_) {}
    return initCwd;
  }

  // Traverse upwards from process.cwd()
  let dir = process.cwd();
  while (dir && dir !== path.dirname(dir)) {
    if (
      !dir.includes('.pnpm') &&
      !dir.includes('node_modules') &&
      fs.existsSync(path.join(dir, 'package.json'))
    ) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (
          (pkg.name === 'react-native-ota-controller' || pkg.name === 'react-native-ota-updater') &&
          fs.existsSync(path.join(dir, 'src', 'OTAService.ts'))
        ) {
          return null; // Self repo
        }
        return dir;
      } catch (_) {}
    }
    dir = path.dirname(dir);
  }

  return process.cwd();
}

function findFilesRecursively(dir, pattern, results = []) {
  if (!fs.existsSync(dir)) return results;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (_) {
      continue;
    }
    if (stat.isDirectory()) {
      if (!['build', '.gradle', 'Pods', 'DerivedData', 'node_modules'].includes(file)) {
        findFilesRecursively(fullPath, pattern, results);
      }
    } else if (pattern.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
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

  if (content.includes('OTAController.resolveBundlePath') || content.includes('OTAUpdater.resolveBundlePath')) {
    return { status: 'already_configured', file: path.relative(projectRoot, mainAppPath) };
  }

  // 1. Add import
  const importStatement = isKotlin
    ? 'import com.otacontroller.OTAController\n'
    : 'import com.otacontroller.OTAController;\n';

  if (!content.includes('com.otacontroller.OTAController') && !content.includes('com.otaupdater.OTAController') && !content.includes('com.otaupdater.OTAUpdater')) {
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
    if (content.includes('getDefaultReactHost')) {
      if (content.includes('packageList = PackageList(this).packages')) {
        content = content.replace(
          /(packageList\s*=\s*PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?,?)/,
          `$1\n      jsBundleFilePath = OTAController.resolveBundlePath(applicationContext),`
        );
      } else if (content.includes('context = applicationContext')) {
        content = content.replace(
          /(context\s*=\s*applicationContext,?)/,
          `$1\n      jsBundleFilePath = OTAController.resolveBundlePath(applicationContext),`
        );
      }
    } else if (content.includes('ReactNativeHost(this)') || content.includes('DefaultReactNativeHost(this)')) {
      content = content.replace(
        /(object\s*:\s*(?:Default)?ReactNativeHost\(this\)\s*\{)/,
        `$1\n\n      override fun getJSBundleFile(): String? =\n        OTAController.resolveBundlePath(applicationContext)\n`
      );
    }
  } else {
    if (content.includes('getJSBundleFile()')) {
      content = content.replace(
        /getJSBundleFile\(\)\s*\{[\s\S]*?\}/,
        `getJSBundleFile() {\n      return OTAController.resolveBundlePath(getApplicationContext());\n    }`
      );
    } else if (content.includes('new ReactNativeHost(this)') || content.includes('new DefaultReactNativeHost(this)')) {
      content = content.replace(
        /(new\s+(?:Default)?ReactNativeHost\(this\)\s*\{)/,
        `$1\n\n      @Override\n      protected String getJSBundleFile() {\n        return OTAController.resolveBundlePath(getApplicationContext());\n      }\n`
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

  const swiftFiles = findFilesRecursively(iosDir, /^AppDelegate\.swift$/);
  if (swiftFiles.length > 0) {
    const appDelegatePath = swiftFiles[0];
    let content = fs.readFileSync(appDelegatePath, 'utf8');

    if (content.includes('OTAController.resolveBundlePath') || content.includes('OTAUpdater.resolveBundlePath')) {
      return { status: 'already_configured', file: path.relative(projectRoot, appDelegatePath) };
    }

    if (!content.includes('import OtaController') && !content.includes('import OtaUpdater')) {
      content = `import OtaController\n` + content;
    }

    if (content.includes('bundleURL()')) {
      content = content.replace(
        /(override\s+func\s+bundleURL\(\)\s*->\s*URL\?\s*\{[\s\S]*?#else\s*\n)/,
        `$1    if let otaURL = OTAController.resolveBundlePath() {\n      return otaURL\n    }\n`
      );
    }

    fs.writeFileSync(appDelegatePath, content, 'utf8');
    return { status: 'configured', file: path.relative(projectRoot, appDelegatePath) };
  }

  const mmFiles = findFilesRecursively(iosDir, /^AppDelegate\.mm$/);
  if (mmFiles.length > 0) {
    const appDelegatePath = mmFiles[0];
    let content = fs.readFileSync(appDelegatePath, 'utf8');

    if (content.includes('OTAController') || content.includes('OTAUpdater')) {
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

function unlinkAndroid(projectRoot) {
  const androidDir = path.join(projectRoot, 'android');
  if (!fs.existsSync(androidDir)) return { status: 'skipped' };

  const mainAppFiles = findFilesRecursively(
    path.join(androidDir, 'app', 'src', 'main', 'java'),
    /^MainApplication\.(kt|java)$/
  );
  if (mainAppFiles.length === 0) return { status: 'skipped' };

  const mainAppPath = mainAppFiles[0];
  let content = fs.readFileSync(mainAppPath, 'utf8');

  content = content.replace(/import\s+com\.(?:otacontroller|otaupdater)\.(?:OTAController|OTAUpdater);?\n?/g, '');
  content = content.replace(/\s*jsBundleFilePath\s*=\s*(?:OTAController|OTAUpdater)\.resolveBundlePath\([^)]*\),?/g, '');
  content = content.replace(/\s*override\s+fun\s+getJSBundleFile\(\):\s*String\?\s*=\s*(?:OTAController|OTAUpdater)\.resolveBundlePath\([^)]*\)/g, '');
  content = content.replace(/\s*@Override\s+protected\s+String\s+getJSBundleFile\(\)\s*\{\s*return\s+(?:OTAController|OTAUpdater)\.resolveBundlePath\([^)]*\);\s*\}/g, '');

  fs.writeFileSync(mainAppPath, content, 'utf8');
  return { status: 'unlinked', file: path.relative(projectRoot, mainAppPath) };
}

function unlinkIOS(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return { status: 'skipped' };

  const swiftFiles = findFilesRecursively(iosDir, /^AppDelegate\.swift$/);
  if (swiftFiles.length > 0) {
    const appDelegatePath = swiftFiles[0];
    let content = fs.readFileSync(appDelegatePath, 'utf8');

    content = content.replace(/import\s+(?:OtaController|OtaUpdater)\n?/g, '');
    content = content.replace(/\s*if\s+let\s+otaURL\s*=\s*(?:OTAController|OTAUpdater)\.resolveBundlePath\(\)\s*\{\s*return\s+otaURL\s*\}/g, '');

    fs.writeFileSync(appDelegatePath, content, 'utf8');
    return { status: 'unlinked', file: path.relative(projectRoot, appDelegatePath) };
  }

  return { status: 'skipped' };
}

function setupGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const entriesToAdd = [];

  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }

  if (!content.includes('ota-dist')) {
    entriesToAdd.push('ota-dist/');
  }

  if (entriesToAdd.length === 0) {
    return { status: 'already_configured', file: '.gitignore' };
  }

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  const block = `${separator}\n# React Native OTA Controller\n${entriesToAdd.join('\n')}\n`;

  fs.appendFileSync(gitignorePath, block, 'utf8');
  return { status: 'configured', file: '.gitignore', added: entriesToAdd };
}

function runSetup() {
  const projectRoot = getProjectRoot();
  if (!projectRoot) return;

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

    const gitResult = setupGitignore(projectRoot);
    if (gitResult.status === 'configured') {
      console.log(`  ✅ Git: Added ${gitResult.added.join(', ')} to ${gitResult.file}`);
    } else if (gitResult.status === 'already_configured') {
      console.log(`  ✨ Git: Already configured in ${gitResult.file}`);
    }

    console.log('🚀 [react-native-ota-controller] Setup complete!\n');
  } catch (err) {
    console.warn('⚠️  [react-native-ota-controller] Auto-setup skipped:', err.message);
  }
}

function runUnlink() {
  const projectRoot = getProjectRoot();
  if (!projectRoot) return;

  console.log('\n🧹 [react-native-ota-controller] Removing native bundle loaders...');

  try {
    const androidResult = unlinkAndroid(projectRoot);
    if (androidResult.status === 'unlinked') {
      console.log(`  ✅ Android: Unlinked from ${androidResult.file}`);
    }

    const iosResult = unlinkIOS(projectRoot);
    if (iosResult.status === 'unlinked') {
      console.log(`  ✅ iOS: Unlinked from ${iosResult.file}`);
    }

    console.log('✨ [react-native-ota-controller] Unlink complete!\n');
  } catch (err) {
    console.warn('⚠️  [react-native-ota-controller] Unlink failed:', err.message);
  }
}

module.exports = { runSetup, runUnlink, setupAndroid, setupIOS, setupGitignore, unlinkAndroid, unlinkIOS, getProjectRoot };

if (require.main === module) {
  if (process.argv.includes('unlink') || process.argv.includes('--unlink')) {
    runUnlink();
  } else {
    runSetup();
  }
}
