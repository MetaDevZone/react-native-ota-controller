import fs from 'fs';
import path from 'path';
import {
  setupAndroid,
  setupIOS,
  unlinkAndroid,
  unlinkIOS,
  setupGitignore,
  getProjectRoot,
  runSetup,
  runUnlink,
} from '../../cli/setup.js';

describe('CLI Native Setup & Unlink Test Suite', () => {
  const tempDir = path.join(__dirname, 'temp-cli-test-project');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('setupAndroid', () => {
    it('should return skipped if android directory does not exist', () => {
      const res = setupAndroid(tempDir);
      expect(res.status).toBe('skipped');
      expect(res.reason).toContain('android directory not found');
    });

    it('should return skipped if MainApplication is missing', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('skipped');
      expect(res.reason).toContain('MainApplication file not found');
    });

    it('should configure Kotlin MainApplication with getDefaultReactHost and PackageList', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.kt');

      const initialContent = `package com.app

class MainApplication : Application(), ReactApplication {
  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, packageList = PackageList(this).packages)
}
`;
      fs.writeFileSync(mainAppFile, initialContent, 'utf8');

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).toContain('import com.otacontroller.OTAController');
      expect(updated).toContain('jsBundleFilePath = OTAController.resolveBundlePath(applicationContext)');

      // Calling setup again should return already_configured
      const res2 = setupAndroid(tempDir);
      expect(res2.status).toBe('already_configured');
    });

    it('should configure Kotlin MainApplication with getDefaultReactHost and context = applicationContext', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.kt');

      const initialContent = `package com.app

class MainApplication : Application(), ReactApplication {
  override val reactHost: ReactHost
    get() = getDefaultReactHost(context = applicationContext)
}
`;
      fs.writeFileSync(mainAppFile, initialContent, 'utf8');

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).toContain('jsBundleFilePath = OTAController.resolveBundlePath(applicationContext)');
    });

    it('should configure Kotlin MainApplication with ReactNativeHost override', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.kt');

      const initialContent = `package com.app

class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> = PackageList(this).packages
    }
}
`;
      fs.writeFileSync(mainAppFile, initialContent, 'utf8');

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).toContain('override fun getJSBundleFile(): String? =');
      expect(updated).toContain('OTAController.resolveBundlePath(applicationContext)');
    });

    it('should configure Java MainApplication with existing getJSBundleFile', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.java');

      const initialContent = `package com.app;

public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
    @Override
    protected String getJSBundleFile() {
      return null;
    }
  };
}
`;
      fs.writeFileSync(mainAppFile, initialContent, 'utf8');

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).toContain('import com.otacontroller.OTAController;');
      expect(updated).toContain('return OTAController.resolveBundlePath(getApplicationContext());');
    });

    it('should configure Java MainApplication without getJSBundleFile by injecting into ReactNativeHost', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.java');

      const initialContent = `package com.app;

public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost mReactNativeHost = new DefaultReactNativeHost(this) {
    @Override
    protected List<ReactPackage> getPackages() {
      return new PackageList(this).getPackages();
    }
  };
}
`;
      fs.writeFileSync(mainAppFile, initialContent, 'utf8');

      const res = setupAndroid(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).toContain('@Override');
      expect(updated).toContain('protected String getJSBundleFile()');
      expect(updated).toContain('return OTAController.resolveBundlePath(getApplicationContext());');
    });
  });

  describe('setupIOS', () => {
    it('should return skipped if ios directory does not exist', () => {
      const res = setupIOS(tempDir);
      expect(res.status).toBe('skipped');
      expect(res.reason).toContain('ios directory not found');
    });

    it('should return skipped if AppDelegate is missing', () => {
      fs.mkdirSync(path.join(tempDir, 'ios'), { recursive: true });
      const res = setupIOS(tempDir);
      expect(res.status).toBe('skipped');
      expect(res.reason).toContain('AppDelegate file not found');
    });

    it('should configure Swift AppDelegate with resolveBundlePath', () => {
      const iosDir = path.join(tempDir, 'ios', 'MyApp');
      fs.mkdirSync(iosDir, { recursive: true });
      const appDelegateFile = path.join(iosDir, 'AppDelegate.swift');

      const initialContent = `import UIKit
import React

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
`;
      fs.writeFileSync(appDelegateFile, initialContent, 'utf8');

      const res = setupIOS(tempDir);
      expect(res.status).toBe('configured');

      const updated = fs.readFileSync(appDelegateFile, 'utf8');
      expect(updated).toContain('import OtaController');
      expect(updated).toContain('if let otaURL = OTAController.resolveBundlePath()');

      // Calling again should return already_configured
      const res2 = setupIOS(tempDir);
      expect(res2.status).toBe('already_configured');
    });

    it('should return notice for Objective-C++ AppDelegate.mm', () => {
      const iosDir = path.join(tempDir, 'ios', 'MyApp');
      fs.mkdirSync(iosDir, { recursive: true });
      const appDelegateFile = path.join(iosDir, 'AppDelegate.mm');

      const initialContent = `#import "AppDelegate.h"
@implementation AppDelegate
@end
`;
      fs.writeFileSync(appDelegateFile, initialContent, 'utf8');

      const res = setupIOS(tempDir);
      expect(res.status).toBe('notice');
      expect(res.message).toContain('Objective-C++');

      // If already has OTAController, returns already_configured
      fs.writeFileSync(appDelegateFile, initialContent + '\nOTAController\n', 'utf8');
      const res2 = setupIOS(tempDir);
      expect(res2.status).toBe('already_configured');
    });
  });

  describe('unlinkAndroid and unlinkIOS', () => {
    it('unlinkAndroid should clean up imports and resolveBundlePath statements', () => {
      const javaDir = path.join(tempDir, 'android', 'app', 'src', 'main', 'java', 'com', 'app');
      fs.mkdirSync(javaDir, { recursive: true });
      const mainAppFile = path.join(javaDir, 'MainApplication.kt');

      const content = `package com.app
import com.otacontroller.OTAController

class MainApplication : Application(), ReactApplication {
  override fun getJSBundleFile(): String? = OTAController.resolveBundlePath(applicationContext)
}
`;
      fs.writeFileSync(mainAppFile, content, 'utf8');

      const res = unlinkAndroid(tempDir);
      expect(res.status).toBe('unlinked');

      const updated = fs.readFileSync(mainAppFile, 'utf8');
      expect(updated).not.toContain('import com.otacontroller.OTAController');
      expect(updated).not.toContain('OTAController.resolveBundlePath');
    });

    it('unlinkAndroid should return skipped if android directory does not exist', () => {
      const res = unlinkAndroid(tempDir);
      expect(res.status).toBe('skipped');
    });

    it('unlinkIOS should clean up Swift AppDelegate imports and resolveBundlePath statements', () => {
      const iosDir = path.join(tempDir, 'ios', 'MyApp');
      fs.mkdirSync(iosDir, { recursive: true });
      const appDelegateFile = path.join(iosDir, 'AppDelegate.swift');

      const content = `import OtaController
import UIKit

class AppDelegate {
  func bundleURL() {
    if let otaURL = OTAController.resolveBundlePath() { return otaURL }
  }
}
`;
      fs.writeFileSync(appDelegateFile, content, 'utf8');

      const res = unlinkIOS(tempDir);
      expect(res.status).toBe('unlinked');

      const updated = fs.readFileSync(appDelegateFile, 'utf8');
      expect(updated).not.toContain('import OtaController');
      expect(updated).not.toContain('OTAController.resolveBundlePath');
    });

    it('unlinkIOS should return skipped if ios directory does not exist', () => {
      const res = unlinkIOS(tempDir);
      expect(res.status).toBe('skipped');
    });
  });

  describe('getProjectRoot', () => {
    it('should return null when running inside self-repository (react-native-ota-controller)', () => {
      const originalInitCwd = process.env.INIT_CWD;
      try {
        const repoRoot = path.resolve(__dirname, '../..');
        process.env.INIT_CWD = repoRoot;
        expect(getProjectRoot()).toBeNull();
      } finally {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should return custom INIT_CWD if valid package.json exists and not self repo', () => {
      const originalInitCwd = process.env.INIT_CWD;
      try {
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'my-consumer-app' }),
          'utf8'
        );
        process.env.INIT_CWD = tempDir;
        expect(getProjectRoot()).toBe(tempDir);
      } finally {
        process.env.INIT_CWD = originalInitCwd;
      }
    });
  });

  describe('runSetup and runUnlink runner functions', () => {
    it('runSetup should execute without crashing when project root is null or valid', () => {
      expect(() => runSetup()).not.toThrow();
    });

    it('runUnlink should execute without crashing when project root is null or valid', () => {
      expect(() => runUnlink()).not.toThrow();
    });
  });
});
