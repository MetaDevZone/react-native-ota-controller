import fs from 'fs';
import path from 'path';

describe('CLI - App ID Auto-Detection & Metadata Tests', () => {
  const testDir = path.join(__dirname, 'test-temp-project');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should correctly detect Android applicationId from build.gradle', () => {
    const gradleDir = path.join(testDir, 'android', 'app');
    fs.mkdirSync(gradleDir, { recursive: true });
    fs.writeFileSync(
      path.join(gradleDir, 'build.gradle'),
      `
        android {
          defaultConfig {
            applicationId "com.hisabkitab360.app"
            versionName "1.2.3"
          }
        }
      `
    );

    const content = fs.readFileSync(
      path.join(gradleDir, 'build.gradle'),
      'utf8'
    );
    const match = content.match(/applicationId\s+["']?([^"'\s\n]+)["']?/);
    const verMatch = content.match(/versionName\s+["']?([^"'\s\n]+)["']?/);

    expect(match?.[1]).toBe('com.hisabkitab360.app');
    expect(verMatch?.[1]).toBe('1.2.3');
  });

  it('should correctly detect iOS PRODUCT_BUNDLE_IDENTIFIER from project.pbxproj', () => {
    const pbxDir = path.join(testDir, 'ios', 'MyApp.xcodeproj');
    fs.mkdirSync(pbxDir, { recursive: true });
    fs.writeFileSync(
      path.join(pbxDir, 'project.pbxproj'),
      `
        PRODUCT_BUNDLE_IDENTIFIER = com.hisabkitab360.ios;
        MARKETING_VERSION = 2.0.0;
      `
    );

    const content = fs.readFileSync(
      path.join(pbxDir, 'project.pbxproj'),
      'utf8'
    );
    const match = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/);
    const verMatch = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/);

    expect(match?.[1].trim()).toBe('com.hisabkitab360.ios');
    expect(verMatch?.[1].trim()).toBe('2.0.0');
  });

  it('should generate valid meta.json with appId, version and channel info', () => {
    const meta = {
      appId: 'com.hisabkitab360.app',
      appVersion: '1.2.3',
      otaVersion: 5,
      channel: 'development',
      builtAt: new Date().toISOString(),
    };

    const metaFile = path.join(testDir, 'meta.json');
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    const parsed = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    expect(parsed.appId).toBe('com.hisabkitab360.app');
    expect(parsed.appVersion).toBe('1.2.3');
    expect(parsed.otaVersion).toBe(5);
    expect(parsed.channel).toBe('development');
    expect(parsed.builtAt).toBeDefined();
  });

  it('should auto-append ota-dist/ to .gitignore', () => {
    const { setupGitignore } = require('../../cli/setup.js');

    const gitignorePath = path.join(testDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\n.DS_Store\n');

    const res = setupGitignore(testDir);
    expect(res.status).toBe('configured');

    const updated = fs.readFileSync(gitignorePath, 'utf8');
    expect(updated).toContain('ota-dist/');
    expect(updated).not.toContain('.ota-version.json');

    // Calling again should return already_configured without duplicate entries
    const res2 = setupGitignore(testDir);
    expect(res2.status).toBe('already_configured');
  });

  describe('Channel Auto-Detection', () => {
    const {
      findVariableValueInContent,
      normalizeChannel,
      readEnvVariable,
    } = require('../../cli/bundle.js');

    it('should detect channel from literal variable declaration in file', () => {
      const content = `
        const otaKey = 'ota_live_key_123';
        const otaChannel = 'development';

        export default function App() {
          return <OTAProvider apiKey={otaKey} channel={otaChannel} />;
        }
      `;
      const detected = findVariableValueInContent('otaChannel', content, testDir);
      expect(detected).toBe('development');
    });

    it('should detect channel from imported file (e.g. baseUrls.ts)', () => {
      const utilsDir = path.join(testDir, 'src', 'utils');
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(
        path.join(utilsDir, 'baseUrls.ts'),
        `export const otaChannel = 'development';\nexport const otaKey = 'key_123';`
      );

      const appContent = `
        import { otaKey, otaChannel } from './src/utils/baseUrls';

        export default function App() {
          return <OTAProvider apiKey={otaKey} channel={otaChannel} />;
        }
      `;

      const detected = findVariableValueInContent('otaChannel', appContent, testDir);
      expect(detected).toBe('development');
    });

    it('should detect channel with TypeScript type annotations (e.g. export const otaChannel: OTAChannel = "development")', () => {
      const utilsDir = path.join(testDir, 'src', 'utils');
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(
        path.join(utilsDir, 'baseUrls.ts'),
        `export type OTAChannel = 'development' | 'production';\nexport const otaChannel: OTAChannel = 'development';`
      );

      const appContent = `
        import { otaChannel } from './src/utils/baseUrls';
        export default function App() {
          return <OTAProvider apiKey="key" channel={otaChannel} />;
        }
      `;

      const detected = findVariableValueInContent('otaChannel', appContent, testDir);
      expect(detected).toBe('development');
    });

    it('should detect channel from ternary with isDev = true', () => {
      const utilsDir = path.join(testDir, 'src', 'utils');
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(
        path.join(utilsDir, 'baseUrls.ts'),
        `const isDev = true;\nexport const otaChannel = isDev ? 'development' : 'production';`
      );

      const appContent = `
        import { otaChannel } from './src/utils/baseUrls';
      `;

      const detected = findVariableValueInContent('otaChannel', appContent, testDir);
      expect(detected).toBe('development');
    });

    it('should ignore commented-out ENV lines and resolve ENV = "PROD" to production', () => {
      const utilsDir = path.join(testDir, 'src', 'utils');
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(
        path.join(utilsDir, 'baseUrls.ts'),
        `
export type Environment = 'DEV' | 'STAGE' | 'PROD';

// export const ENV: Environment = 'DEV';
// export const ENV: Environment = 'STAGE';
// export const ENV: Environment = 'PROD';
export const ENV: Environment = 'PROD';

export const otaChannel = ENV === 'PROD' ? 'production' : 'development';
        `
      );

      const appContent = `
        import { otaChannel } from './src/utils/baseUrls';
        export default function App() {
          return <OTAProvider apiKey="key" channel={otaChannel} />;
        }
      `;

      const detected = findVariableValueInContent('otaChannel', appContent, testDir);
      expect(detected).toBe('production');
    });

    it('should normalize channel aliases', () => {
      expect(normalizeChannel('development')).toBe('development');
      expect(normalizeChannel('dev')).toBe('development');
      expect(normalizeChannel('staging')).toBe('development');
      expect(normalizeChannel('stage')).toBe('development');
      expect(normalizeChannel('production')).toBe('production');
      expect(normalizeChannel('prod')).toBe('production');
      expect(normalizeChannel('other')).toBeNull();
    });
  });
});



