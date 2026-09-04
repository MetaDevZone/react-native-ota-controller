jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn().mockResolvedValue(true),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn().mockResolvedValue(undefined),
}));

import * as OtaPackage from '../index';
import OTA, {
  OTAProvider,
  OTARoot,
  OTAController,
  OTAService,
  OTALink,
  OTAError,
  OTADownloader,
  OTAStorage,
  restartApp,
  getAppVersion,
  getOtaVersion,
  getAppId,
  getActiveVersion,
} from '../index';

describe('Public Package Exports (index.ts)', () => {
  it('should export all public components, services, and utilities', () => {
    expect(OTA).toBeDefined();
    expect(OTAProvider).toBeDefined();
    expect(OTARoot).toBe(OTAProvider);
    expect(OTAController).toBeDefined();
    expect(OTAService).toBe(OTA);
    expect(OTALink).toBe(OTA);
    expect(OTAError).toBeDefined();
    expect(OTADownloader).toBeDefined();
    expect(OTAStorage).toBeDefined();
    expect(typeof restartApp).toBe('function');
    expect(typeof getAppVersion).toBe('function');
    expect(typeof getOtaVersion).toBe('function');
    expect(typeof getAppId).toBe('function');
    expect(typeof getActiveVersion).toBe('function');
  });

  it('default export should match named OTA export', () => {
    expect(OtaPackage.default).toBe(OTA);
  });
});
