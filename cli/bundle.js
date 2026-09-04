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
    'Usage: npx ota-bundle [android|ios|all] [--ota-version <n>]'
  );
  process.exit(1);
}

function parseIntFlag(...flags) {
  for (const flag of flags) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1) {
      const raw = process.argv[idx + 1];
      const num = parseInt(raw, 10);
      if (Number.isFinite(num)) return num;
    }
  }
  return undefined;
}

function parseStringFlag(...flags) {
  for (const flag of flags) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1) {
      const val = process.argv[idx + 1];
      if (val && !val.startsWith('-')) return val;
    }
  }
  return undefined;
}

const cliOtaVersion = parseIntFlag('--ota-version', '--version', '-v');

function readEnvVariable(varName) {
  if (!varName) return null;
  const cleanVar = varName
    .replace(/^Config\./, '')
    .replace(/^process\.env\./, '')
    .trim();

  // Generate name variations (e.g. otaChannel -> OTA_CHANNEL, OTACHANNEL, cleanVar)
  const snakeCase = cleanVar.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  const upperCase = cleanVar.toUpperCase();
  const candidates = Array.from(
    new Set([
      cleanVar,
      snakeCase,
      upperCase,
      'OTA_CHANNEL',
      'APP_CHANNEL',
      'CHANNEL',
      'APP_ENV',
      'ENV',
    ])
  );

  // First check process.env
  for (const key of candidates) {
    if (process.env[key]) return process.env[key];
  }

  // Next check .env files in process.cwd()
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
  ];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const key of candidates) {
          const regex = new RegExp(
            `^\\s*${key}\\s*=\\s*["']?([^"'\r\n]+)["']?`,
            'm'
          );
          const match = content.match(regex);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      } catch {}
    }
  }
  return null;
}

function stripComments(src) {
  if (!src || typeof src !== 'string') return '';
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments
    .replace(/^\s*\/\/.*$/gm, '')      // remove full-line comments
    .replace(/\/\/.*$/gm, '');         // remove inline comments
}

function normalizeChannel(val) {
  if (!val || typeof val !== 'string') return null;
  const lower = val.trim().toLowerCase();
  if (
    lower === 'development' ||
    lower === 'dev' ||
    lower === 'staging' ||
    lower === 'stage'
  ) {
    return 'development';
  }
  if (lower === 'production' || lower === 'prod') {
    return 'production';
  }
  return null;
}

function evaluateCondition(condStr, content) {
  if (!condStr || typeof condStr !== 'string') return null;
  condStr = condStr.trim();
  if (condStr === '__DEV__') return true;
  if (condStr === '!__DEV__') return false;

  // Comparison: VAR === 'VAL' or VAR == 'VAL' or VAR !== 'VAL' or VAR != 'VAL'
  const compMatch = condStr.match(
    /^([A-Za-z0-9_]+)\s*(===|==|!==|!=)\s*["']([^"']+)["']$/
  );
  if (compMatch) {
    const varName = compMatch[1];
    const op = compMatch[2];
    const targetVal = compMatch[3];

    // Find varName in content (with optional TypeScript type annotation)
    const varDeclRegex = new RegExp(
      `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${varName}\\s*(?::\\s*[^=]+)?=\\s*["']([^"']+)["']`,
      'i'
    );
    const varDeclMatch = content.match(varDeclRegex);
    if (varDeclMatch) {
      const actualVal = varDeclMatch[1].trim();
      const isEqual = actualVal.toLowerCase() === targetVal.toLowerCase();
      return op === '===' || op === '==' ? isEqual : !isEqual;
    }
  }

  // Boolean variable: isDev, isProduction, etc.
  const boolDeclRegex = new RegExp(
    `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${condStr}\\s*(?::\\s*[^=]+)?=\\s*([^;\\n]+)`,
    'i'
  );
  const boolDeclMatch = content.match(boolDeclRegex);
  if (boolDeclMatch) {
    const val = boolDeclMatch[1].trim();
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val.includes('dev')) return true;
    if (val.includes('prod')) return false;
  }

  if (/dev/i.test(condStr)) return true;
  if (/prod/i.test(condStr)) return false;

  return null;
}

function evaluateChannelExpression(expr, content) {
  if (!expr || typeof expr !== 'string') return null;
  expr = expr.trim();

  // 1. Literal string in quotes: "development", "PROD", 'DEV', 'production', etc.
  const literalMatch = expr.match(/^["']([^"']+)["']$/);
  if (literalMatch) {
    return normalizeChannel(literalMatch[1]);
  }

  // 2. Ternary expression: condition ? trueVal : falseVal
  const ternaryMatch = expr.match(
    /^([^?]+)\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']$/
  );
  if (ternaryMatch) {
    const condition = ternaryMatch[1].trim();
    const trueVal = normalizeChannel(ternaryMatch[2]);
    const falseVal = normalizeChannel(ternaryMatch[3]);

    const condResult = evaluateCondition(condition, content);
    if (condResult === true) return trueVal;
    if (condResult === false) return falseVal;

    return trueVal || falseVal;
  }

  // 3. Object property lookup: map[ENV] or map['PROD']
  const mapMatch = expr.match(/^([A-Za-z0-9_]+)\[([A-Za-z0-9_]+)\]$/);
  if (mapMatch) {
    const mapName = mapMatch[1];
    const keyVar = mapMatch[2];
    const keyDeclRegex = new RegExp(
      `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${keyVar}\\s*(?::\\s*[^=]+)?=\\s*["']([^"']+)["']`,
      'i'
    );
    const keyMatch = content.match(keyDeclRegex);
    const actualKey = keyMatch ? keyMatch[1].trim() : keyVar;

    const mapDeclRegex = new RegExp(
      `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${mapName}\\s*(?::\\s*[^=]+)?=\\s*\\{([\\s\\S]*?)\\}`,
      'i'
    );
    const mapObjMatch = content.match(mapDeclRegex);
    if (mapObjMatch) {
      const objBody = mapObjMatch[1];
      const entryRegex = new RegExp(
        `["']?${actualKey}["']?\\s*:\\s*["']([^"']+)["']`,
        'i'
      );
      const entryMatch = objBody.match(entryRegex);
      if (entryMatch) {
        return normalizeChannel(entryMatch[1]);
      }
    }
  }

  // 4. Variable reference: export const otaChannel = ENV
  const varRefMatch = expr.match(/^([A-Za-z0-9_]+)$/);
  if (varRefMatch) {
    const refName = varRefMatch[1];
    const refDeclRegex = new RegExp(
      `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${refName}\\s*(?::\\s*[^=]+)?=\\s*["']([^"']+)["']`,
      'i'
    );
    const refMatch = content.match(refDeclRegex);
    if (refMatch) {
      return normalizeChannel(refMatch[1]);
    }
  }

  // 5. Fallback: Any string containing recognized channel in expression
  const anyMatch = expr.match(
    /["'](production|prod|development|dev|staging|stage)["']/i
  );
  if (anyMatch && anyMatch[1]) {
    return normalizeChannel(anyMatch[1]);
  }

  return null;
}

function findVariableValueInContent(varName, rawContent, baseDir, depth = 0) {
  if (!varName || !rawContent || depth > 3) return null;

  // Always strip comments first to ignore commented out code
  const content = stripComments(rawContent);

  const cleanVar = varName
    .replace(/^Config\./, '')
    .replace(/^process\.env\./, '')
    .trim();

  // 1. Variable declaration with optional TypeScript type annotation:
  // e.g. export const otaChannel: OTAChannel = 'development'
  // e.g. export const ENV: Environment = 'PROD'
  const declRegex = new RegExp(
    `(?:const|let|var|export\\s+const|export\\s+let|export\\s+var)\\s+${cleanVar}\\s*(?::\\s*[^=]+)?=\\s*([^;\\n]+)`,
    'i'
  );
  const declMatch = content.match(declRegex);
  if (declMatch && declMatch[1]) {
    const rawVal = declMatch[1].trim();
    const evaluated = evaluateChannelExpression(rawVal, content);
    if (evaluated) return evaluated;

    const envRefMatch = rawVal.match(/(?:Config|process\.env)\.([A-Za-z0-9_]+)/);
    if (envRefMatch && envRefMatch[1]) {
      const envVal = readEnvVariable(envRefMatch[1]);
      if (envVal) {
        const norm = normalizeChannel(envVal);
        if (norm) return norm;
      }
    }
  }

  // 2. Import declaration: import { otaChannel } from '...'
  const importRegex = new RegExp(
    `import\\s*\\{[^}]*\\b${cleanVar}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
    'i'
  );
  const importMatch = content.match(importRegex);
  if (importMatch && importMatch[1]) {
    const importRel = importMatch[1]
      .replace(/^@\//, '')
      .replace(/^~\//, '');

    const candidateRoots = [baseDir, process.cwd()];
    for (const root of candidateRoots) {
      if (!root) continue;
      const candidates = [
        path.resolve(root, importRel),
        path.resolve(root, `${importRel}.ts`),
        path.resolve(root, `${importRel}.tsx`),
        path.resolve(root, `${importRel}.js`),
        path.resolve(root, `${importRel}.jsx`),
        path.resolve(root, importRel, 'index.ts'),
        path.resolve(root, importRel, 'index.tsx'),
        path.resolve(root, importRel, 'index.js'),
        path.resolve(root, importRel, 'index.jsx'),
        path.resolve(root, 'src', importRel),
        path.resolve(root, 'src', `${importRel}.ts`),
        path.resolve(root, 'src', `${importRel}.tsx`),
        path.resolve(root, 'src', `${importRel}.js`),
        path.resolve(root, 'src', `${importRel}.jsx`),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          try {
            if (!fs.statSync(cand).isDirectory()) {
              const importedContent = fs.readFileSync(cand, 'utf8');
              const found = findVariableValueInContent(
                cleanVar,
                importedContent,
                path.dirname(cand),
                depth + 1
              );
              if (found) return found;
            }
          } catch {}
        }
      }
    }
  }

  // 3. Fallback: Search well-known config files (e.g. src/utils/baseUrls.ts)
  if (depth === 0) {
    const knownConfigFiles = [
      path.join(process.cwd(), 'src', 'utils', 'baseUrls.ts'),
      path.join(process.cwd(), 'src', 'utils', 'baseUrls.tsx'),
      path.join(process.cwd(), 'src', 'utils', 'baseUrls.js'),
      path.join(process.cwd(), 'src', 'utils', 'baseUrls.jsx'),
      path.join(process.cwd(), 'utils', 'baseUrls.ts'),
      path.join(process.cwd(), 'utils', 'baseUrls.js'),
      path.join(process.cwd(), 'src', 'config', 'index.ts'),
      path.join(process.cwd(), 'src', 'config', 'index.js'),
      path.join(process.cwd(), 'src', 'config.ts'),
      path.join(process.cwd(), 'src', 'config.js'),
      path.join(process.cwd(), 'config.ts'),
      path.join(process.cwd(), 'config.js'),
    ];

    for (const file of knownConfigFiles) {
      if (fs.existsSync(file)) {
        try {
          const cfgRaw = fs.readFileSync(file, 'utf8');
          const cfgContent = stripComments(cfgRaw);

          // Try searching for cleanVar (e.g. otaChannel)
          if (cfgContent.includes(cleanVar)) {
            const found = findVariableValueInContent(
              cleanVar,
              cfgContent,
              path.dirname(file),
              depth + 1
            );
            if (found) return found;

            // If cleanVar was in this file but relied on ENV
            const envDeclRegex = /(?:const|let|var|export\s+const|export\s+let|export\s+var)\s+ENV\s*(?::\s*[^=]+)?=\s*["']([^"']+)["']/i;
            const envMatch = cfgContent.match(envDeclRegex);
            if (envMatch && envMatch[1]) {
              const norm = normalizeChannel(envMatch[1]);
              if (norm) return norm;
            }
          }
        } catch {}
      }
    }
  }

  return null;
}

function detectChannelFromProvider() {
  const candidateFiles = [
    'App.tsx',
    'App.js',
    'App.jsx',
    'index.js',
    'index.tsx',
    'index.ts',
    path.join('src', 'App.tsx'),
    path.join('src', 'App.js'),
    path.join('src', 'App.jsx'),
    path.join('src', 'index.js'),
    path.join('src', 'index.tsx'),
  ];

  for (const rel of candidateFiles) {
    const fullPath = path.join(process.cwd(), rel);
    if (fs.existsSync(fullPath)) {
      try {
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        const content = stripComments(rawContent);
        if (!content.includes('OTAProvider') && !content.includes('OTARoot')) continue;

        // 1. Literal: channel="development" or channel={'development'} or channel={ 'development' }
        const literalMatch =
          content.match(/<(?:OTAProvider|OTARoot)[^>]*channel\s*=\s*["']([^"']+)["']/i) ||
          content.match(/<(?:OTAProvider|OTARoot)[^>]*channel\s*=\s*\{\s*["']([^"']+)["']\s*\}/i);
        if (literalMatch && literalMatch[1]) {
          const norm = normalizeChannel(literalMatch[1]);
          if (norm) return norm;
        }

        // 2. Variable or expression: channel={Config.APP_ENV} or channel={otaChannel}
        const varMatch = content.match(/<(?:OTAProvider|OTARoot)[^>]*channel\s*=\s*\{\s*([^}]+)\s*\}/i);
        if (varMatch && varMatch[1]) {
          const rawVar = varMatch[1].trim();

          // Try checking in current file or follow imports
          const fileVal = findVariableValueInContent(rawVar, content, path.dirname(fullPath));
          if (fileVal) return fileVal;

          // Try reading from environment (.env / process.env)
          const envVal = readEnvVariable(rawVar);
          if (envVal) {
            const norm = normalizeChannel(envVal);
            if (norm) return norm;
          }
        }
      } catch {}
    }
  }
  return null;
}

function resolveChannel() {
  // 1. CLI flag takes highest priority
  const rawFlag = parseStringFlag('--channel', '-c');
  if (rawFlag) {
    const norm = normalizeChannel(rawFlag);
    if (!norm) {
      console.error(
        `\n❌ Error: Invalid channel "${rawFlag}". Allowed channels are only: "development" | "production".\n`
      );
      process.exit(1);
    }
    console.log(`ℹ️  Channel: "${norm}" (specified via --channel flag)`);
    return norm;
  }

  // 2. Auto-detect from <OTAProvider channel={...} /> in app files
  const providerChannel = detectChannelFromProvider();
  if (providerChannel) {
    console.log(`ℹ️  Channel: "${providerChannel}" (auto-detected from <OTAProvider channel={...} />)`);
    return providerChannel;
  }

  // 3. Default to production
  console.log(`ℹ️  Channel: "production" (defaulted — no --channel flag passed and could not auto-detect from source)`);
  return 'production';
}

const cliChannel = resolveChannel();

function detectAndroidVersion() {
  const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  if (!fs.existsSync(gradlePath)) return null;
  const content = fs.readFileSync(gradlePath, 'utf8');
  const match = content.match(/versionName\s+["']?([^"'\s\n]+)["']?/);
  return match ? match[1] : null;
}

function detectAndroidAppId() {
  const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    const content = fs.readFileSync(gradlePath, 'utf8');
    const appMatch = content.match(/applicationId\s+["']?([^"'\s\n]+)["']?/);
    if (appMatch && appMatch[1]) return appMatch[1];
    const namespaceMatch = content.match(/namespace\s+["']?([^"'\s\n]+)["']?/);
    if (namespaceMatch && namespaceMatch[1]) return namespaceMatch[1];
  }
  const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const pkgMatch = content.match(/package\s*=\s*["']([^"']+)["']/);
    if (pkgMatch && pkgMatch[1]) return pkgMatch[1];
  }
  return null;
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

function detectIOSBundleIdFromPbxproj(iosDir) {
  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    if (entry.endsWith('.xcodeproj')) {
      const pbxPath = path.join(iosDir, entry, 'project.pbxproj');
      if (fs.existsSync(pbxPath)) {
        const content = fs.readFileSync(pbxPath, 'utf8');
        const matches = content.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g);
        for (const match of matches) {
          const id = match[1].trim().replace(/^["']|["']$/g, '');
          if (id && !id.includes('$(') && !id.endsWith('Tests') && !id.endsWith('UITests')) {
            return id;
          }
        }
      }
    }
  }
  return null;
}

function detectIOSBundleId() {
  const iosDir = path.join(process.cwd(), 'ios');
  if (!fs.existsSync(iosDir)) return null;

  // 1. Try resolving from Xcode project file
  const pbxId = detectIOSBundleIdFromPbxproj(iosDir);
  if (pbxId) return pbxId;

  // 2. Try Info.plist
  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    const plistPath = path.join(iosDir, entry, 'Info.plist');
    if (fs.existsSync(plistPath)) {
      try {
        const result = execSync(
          `plutil -extract CFBundleIdentifier raw "${plistPath}"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result && !result.includes('$(')) return result;
      } catch {}
    }
  }

  // 3. Try app.json
  const appJsonPath = path.join(process.cwd(), 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (appJson.expo?.ios?.bundleIdentifier) return appJson.expo.ios.bundleIdentifier;
    } catch {}
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

function computeOtaVersion(platform, appVersion, cliOverride, channel = 'production') {
  if (cliOverride !== undefined) {
    return cliOverride;
  }
  const state = loadOtaVersionState();
  const channelData =
    state[channel] ||
    (channel === 'production' && state[platform] ? state : {});
  const platformState = channelData[platform] || {};

  // If native appVersion changed -> reset to 1
  // If native appVersion is unchanged -> increment (+1)
  if (platformState.appVersion === appVersion && Number.isFinite(platformState.otaVersion)) {
    return platformState.otaVersion + 1;
  }
  return 1;
}

function updateTrackedOtaVersion(platform, appVersion, otaVersion, channel = 'production') {
  const state = loadOtaVersionState();
  if (!state[channel] || typeof state[channel] !== 'object') {
    state[channel] = {};
  }
  state[channel][platform] = {
    appVersion,
    otaVersion,
    updatedAt: new Date().toISOString(),
  };
  if (channel === 'production') {
    delete state.android;
    delete state.ios;
  }
  saveOtaVersionState(state);
}

const OUT_DIR = path.join(process.cwd(), 'ota-dist');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function ensureGitignore() {
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
    }
    const entries = [];
    if (!content.includes('ota-dist')) entries.push('ota-dist/');
    if (entries.length > 0) {
      const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(gitignorePath, `${sep}\n# React Native OTA Controller\n${entries.join('\n')}\n`, 'utf8');
    }
  } catch {}
}
ensureGitignore();

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit' });
}

function writeMeta(workDir, appVersion, otaVersion, appId, channel = 'production') {
  const meta = {
    ...(appId ? { appId } : {}),
    appVersion,
    otaVersion,
    channel,
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

async function bundleAndroid(appVersion, otaVersion, appId) {
  console.log(`\n📦 Building Android bundle | appId: ${appId ?? 'auto'} | appVersion: ${appVersion} | otaVersion: ${otaVersion} | channel: ${cliChannel}\n`);

  const workDir = path.join(OUT_DIR, '.android-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform android --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'index.android.bundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, otaVersion, appId, cliChannel);

  const versionedName = `bundle-android-${cliChannel}(${appVersion}-${otaVersion}).zip`;
  const versionedZipPath = path.join(OUT_DIR, versionedName);

  fs.rmSync(versionedZipPath, { force: true });

  await zipDirectory(workDir, versionedZipPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  updateTrackedOtaVersion('android', appVersion, otaVersion, cliChannel);

  const size = fs.existsSync(versionedZipPath) ? formatFileSize(fs.statSync(versionedZipPath).size) : 'N/A';
  return {
    platform: 'Android 🤖',
    appId: appId || 'N/A',
    appVersion,
    otaVersion,
    channel: cliChannel,
    zipFile: `ota-dist/${versionedName}`,
    fileSize: size,
  };
}

async function bundleIOS(appVersion, otaVersion, appId) {
  console.log(`\n📦 Building iOS bundle | appId: ${appId ?? 'auto'} | appVersion: ${appVersion} | otaVersion: ${otaVersion} | channel: ${cliChannel}\n`);

  const workDir = path.join(OUT_DIR, '.ios-tmp');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  run(
    `npx react-native bundle --platform ios --dev false ` +
    `--entry-file index.js ` +
    `--bundle-output ${path.join(workDir, 'main.jsbundle')} ` +
    `--assets-dest ${workDir}`
  );

  writeMeta(workDir, appVersion, otaVersion, appId, cliChannel);

  const versionedName = `bundle-ios-${cliChannel}(${appVersion}-${otaVersion}).zip`;
  const versionedZipPath = path.join(OUT_DIR, versionedName);

  fs.rmSync(versionedZipPath, { force: true });

  await zipDirectory(workDir, versionedZipPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  updateTrackedOtaVersion('ios', appVersion, otaVersion, cliChannel);

  const size = fs.existsSync(versionedZipPath) ? formatFileSize(fs.statSync(versionedZipPath).size) : 'N/A';
  return {
    platform: 'iOS 🍏',
    appId: appId || 'N/A',
    appVersion,
    otaVersion,
    channel: cliChannel,
    zipFile: `ota-dist/${versionedName}`,
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
    if (item.appId && item.appId !== 'N/A') {
      console.log(`    • App ID / Package   : ${item.appId}`);
    }
    console.log(`    • Native App Version : ${item.appVersion}`);
    console.log(`    • OTA Bundle Version : ${item.otaVersion}`);
    console.log(`    • Target Channel     : ${item.channel}`);
    console.log(`    • Bundle File Size   : ${item.fileSize}`);
    console.log(`    • Output Artifact    : ${item.zipFile}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✨ All build artifacts ready in ota-dist/\n');
}

module.exports = {
  readEnvVariable,
  normalizeChannel,
  findVariableValueInContent,
  detectChannelFromProvider,
  resolveChannel,
  computeOtaVersion,
  updateTrackedOtaVersion,
  writeMeta,
};

const isTestEnv = process.env.NODE_ENV === 'test' || typeof jest !== 'undefined';
if (!isTestEnv) {
  (async () => {
    const results = [];

    if (platformArg === 'android') {
      const appId = detectAndroidAppId();
      const appVersion = detectAndroidVersion() ?? 'unknown';
      const otaVersion = computeOtaVersion('android', appVersion, cliOtaVersion, cliChannel);
      const res = await bundleAndroid(appVersion, otaVersion, appId);
      results.push(res);
    } else if (platformArg === 'ios') {
      const appId = detectIOSBundleId();
      const appVersion = detectIOSVersion() ?? 'unknown';
      const otaVersion = computeOtaVersion('ios', appVersion, cliOtaVersion, cliChannel);
      const res = await bundleIOS(appVersion, otaVersion, appId);
      results.push(res);
    } else {
      const androidAppId   = detectAndroidAppId();
      const androidVersion = detectAndroidVersion() ?? 'unknown';
      const androidOtaVer  = computeOtaVersion('android', androidVersion, cliOtaVersion, cliChannel);

      const iosAppId       = detectIOSBundleId();
      const iosVersion     = detectIOSVersion() ?? 'unknown';
      const iosOtaVer      = computeOtaVersion('ios', iosVersion, cliOtaVersion, cliChannel);

      const androidRes = await bundleAndroid(androidVersion, androidOtaVer, androidAppId);
      const iosRes     = await bundleIOS(iosVersion, iosOtaVer, iosAppId);
      results.push(androidRes, iosRes);
    }

    printSummary(results);
  })();
}
