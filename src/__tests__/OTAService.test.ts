import { OTAService, OTAError } from '../OTAService';
import { OTAStorage } from '../OTAStorage';
import { OTADownloader } from '../OTADownloader';
import * as OTARestart from '../OTARestart';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn().mockResolvedValue(true),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../OTADownloader', () => ({
  OTADownloader: {
    downloadBundle: jest.fn(),
  },
}));

jest.mock('../OTARestart', () => ({
  getAppId: jest.fn(),
  getAppVersion: jest.fn(),
  getOtaVersion: jest.fn(),
  restartApp: jest.fn(),
  confirmNativeBootSuccess: jest.fn(),
}));

describe('OTA Controller - Full Feature Test Suite', () => {
  const mockUrl = 'https://example.com/bundle.zip';

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (OTARestart.getAppId as jest.Mock).mockReturnValue('com.hisabkitab360.app');
    (OTARestart.getAppVersion as jest.Mock).mockReturnValue('1.0.0');
    (OTARestart.getOtaVersion as jest.Mock).mockReturnValue(1);
  });

  describe('1. appId Check Tests', () => {
    it('should successfully apply update when bundle appId matches native appId', async () => {
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);
      (OTADownloader.downloadBundle as jest.Mock).mockResolvedValue(
        '/mock/zip.zip'
      );
      jest
        .spyOn(OTAStorage, 'extractToStaging')
        .mockResolvedValue('/mock/staging');
      jest.spyOn(OTAStorage, 'readBundleMeta').mockResolvedValue({
        appId: 'com.hisabkitab360.app',
        appVersion: '1.0.0',
        otaVersion: 2,
      });
      jest
        .spyOn(OTAStorage, 'promoteStaging')
        .mockResolvedValue('/mock/bundles/bundle2');
      jest.spyOn(OTAStorage, 'writeCurrent').mockResolvedValue(undefined);
      jest
        .spyOn(OTAStorage, 'clearRejectedUpdates')
        .mockResolvedValue(undefined);

      const result = await OTAService.downloadAndApplyUpdate({
        release: { bundleUrl: mockUrl, otaVersion: 2 },
      });

      expect(result.updated).toBe(true);
      expect(result.version).toBe(2);
      expect(OTAStorage.clearRejectedUpdates).toHaveBeenCalled();
    });

    it('should reject bundle and throw APP_ID_MISMATCH when bundle is for another app', async () => {
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);
      (OTADownloader.downloadBundle as jest.Mock).mockResolvedValue(
        '/mock/zip.zip'
      );
      jest
        .spyOn(OTAStorage, 'extractToStaging')
        .mockResolvedValue('/mock/staging');
      jest.spyOn(OTAStorage, 'readBundleMeta').mockResolvedValue({
        appId: 'com.another.differentapp',
        appVersion: '1.0.0',
        otaVersion: 2,
      });
      const cleanupSpy = jest
        .spyOn(OTAStorage, 'cleanupStaging')
        .mockResolvedValue(undefined);
      const addRejectedSpy = jest
        .spyOn(OTAStorage, 'addRejectedUrl')
        .mockResolvedValue(undefined);

      await expect(
        OTAService.downloadAndApplyUpdate({
          release: { bundleUrl: mockUrl, otaVersion: 2 },
        })
      ).rejects.toThrow('App ID mismatch');

      expect(cleanupSpy).toHaveBeenCalled();
      expect(addRejectedSpy).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('App ID mismatch'),
        '1.0.0'
      );
    });

    it('should strictly reject bundles missing appId with APP_ID_MISMATCH', async () => {
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);
      (OTADownloader.downloadBundle as jest.Mock).mockResolvedValue(
        '/mock/zip.zip'
      );
      jest
        .spyOn(OTAStorage, 'extractToStaging')
        .mockResolvedValue('/mock/staging');
      jest.spyOn(OTAStorage, 'readBundleMeta').mockResolvedValue({
        appId: '', // missing / empty appId
        appVersion: '1.0.0',
        otaVersion: 2,
      });
      const cleanupSpy = jest
        .spyOn(OTAStorage, 'cleanupStaging')
        .mockResolvedValue(undefined);
      const addRejectedSpy = jest
        .spyOn(OTAStorage, 'addRejectedUrl')
        .mockResolvedValue(undefined);

      await expect(
        OTAService.downloadAndApplyUpdate({
          release: { bundleUrl: mockUrl, otaVersion: 2 },
        })
      ).rejects.toThrow('App ID missing in bundle');

      expect(cleanupSpy).toHaveBeenCalled();
      expect(addRejectedSpy).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('App ID missing in bundle'),
        '1.0.0'
      );
    });
  });

  describe('2. Blacklist / Rejected Cache Tests', () => {
    it('should skip download immediately when URL is already in rejected blacklist', async () => {
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue({
        reason: 'OTA: App ID mismatch',
        rejectedAt: '2026-08-24T10:00:00.000Z',
      });

      const onErrorMock = jest.fn();

      await expect(
        OTAService.downloadAndApplyUpdate({
          release: { bundleUrl: mockUrl, otaVersion: 2 },
          onError: onErrorMock,
        })
      ).rejects.toThrow('previously rejected');

      expect(OTADownloader.downloadBundle).not.toHaveBeenCalled();
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UPDATE_BLACKLISTED',
        })
      );
    });

    it('should reject and blacklist on APP_VERSION_MISMATCH', async () => {
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);
      (OTADownloader.downloadBundle as jest.Mock).mockResolvedValue(
        '/mock/zip.zip'
      );
      jest
        .spyOn(OTAStorage, 'extractToStaging')
        .mockResolvedValue('/mock/staging');
      jest.spyOn(OTAStorage, 'readBundleMeta').mockResolvedValue({
        appId: 'com.hisabkitab360.app',
        appVersion: '2.0.0', // Device has 1.0.0
        otaVersion: 2,
      });
      const addRejectedSpy = jest
        .spyOn(OTAStorage, 'addRejectedUrl')
        .mockResolvedValue(undefined);

      await expect(
        OTAService.downloadAndApplyUpdate({
          release: { bundleUrl: mockUrl, otaVersion: 2 },
        })
      ).rejects.toThrow('App version mismatch');

      expect(addRejectedSpy).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('App version mismatch'),
        '1.0.0'
      );
    });

    it('should reject and blacklist on CHANNEL_MISMATCH', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123', channel: 'production' });
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);
      (OTADownloader.downloadBundle as jest.Mock).mockResolvedValue(
        '/mock/zip.zip'
      );
      jest
        .spyOn(OTAStorage, 'extractToStaging')
        .mockResolvedValue('/mock/staging');
      jest.spyOn(OTAStorage, 'readBundleMeta').mockResolvedValue({
        appId: 'com.hisabkitab360.app',
        appVersion: '1.0.0',
        otaVersion: 2,
        channel: 'development',
      });
      const addRejectedSpy = jest
        .spyOn(OTAStorage, 'addRejectedUrl')
        .mockResolvedValue(undefined);

      await expect(
        OTAService.downloadAndApplyUpdate({
          release: { bundleUrl: mockUrl, otaVersion: 2 },
        })
      ).rejects.toThrow('Channel mismatch');

      expect(addRejectedSpy).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('Channel mismatch'),
        '1.0.0'
      );
    });
  });

  describe('3. Auto-Reset Blacklist Logic in Storage', () => {
    it('should reset rejected list when native store app version changes', async () => {
      const RNFS = require('react-native-fs');
      RNFS.exists.mockResolvedValue(true);
      RNFS.readFile.mockResolvedValue(
        JSON.stringify({
          nativeAppVersion: '1.0.0',
          rejectedUrls: {
            [mockUrl]: { reason: 'old mismatch', rejectedAt: '2026-08-24' },
          },
        })
      );

      // Now device updated from Store to '1.1.0'
      const info = await OTAStorage.getRejectedUrlInfo(mockUrl, '1.1.0');

      // Old blacklist should be ignored and cleared because of store update
      expect(info).toBeNull();
    });

    it('should return rejected entry if native app version is the same', async () => {
      const RNFS = require('react-native-fs');
      RNFS.exists.mockResolvedValue(true);
      RNFS.readFile.mockResolvedValue(
        JSON.stringify({
          nativeAppVersion: '1.0.0',
          rejectedUrls: {
            [mockUrl]: { reason: 'mismatch', rejectedAt: '2026-08-24' },
          },
        })
      );

      const info = await OTAStorage.getRejectedUrlInfo(mockUrl, '1.0.0');

      expect(info).toEqual({
        reason: 'mismatch',
        rejectedAt: '2026-08-24',
      });
    });
  });

  describe('Cloud SDK & checkForUpdate Suite', () => {
    beforeEach(() => {
      (OTAService as any).config = null;
      (OTAService as any).cachedCheckResult = null;
      global.fetch = jest.fn();
    });

    it('should configure apiKey and options', () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });
      expect(OTAService.getConfig()?.apiKey).toBe('ota_live_key_123');
      expect(OTAService.isConfigured()).toBe(true);
    });

    it('should throw if configure is called with empty key', () => {
      expect(() => {
        OTAService.configure({ apiKey: '   ' });
      }).toThrow('apiKey is required');
    });

    it('checkForUpdate should throw API_KEY_MISSING if apiKey is missing', async () => {
      await expect(OTAService.checkForUpdate()).rejects.toThrow('apiKey is required');
    });

    it('checkForUpdate should send correct query parameters and header', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            updateAvailable: true,
            release: {
              id: 'rel_123',
              otaVersion: 2,
              bundleUrl: 'https://cdn.example.com/bundle2.zip',
              skipOnStoreUpdate: true,
              updateSilently: true,
            },
          },
        }),
      });

      const result = await OTAService.checkForUpdate({
        platform: 'ios',
        bundleId: 'com.example.app',
        version_no: '1.0.1',
        build_no: 120,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://appapi.metadevzone.com/api/ota/public/check-update',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-ota-app-key': 'ota_live_key_123',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            bundleId: 'com.example.app',
            platform: 'ios',
            version_no: '1.0.1',
            build_no: 120,
            channel: 'production',
          }),
        })
      );

      expect(result.updateAvailable).toBe(true);
      expect(result.release?.id).toBe('rel_123');
      expect(result.release?.bundleUrl).toBe('https://cdn.example.com/bundle2.zip');
      expect(result.release?.skipOnStoreUpdate).toBe(true);
      expect(result.release?.updateSilently).toBe(true);
    });

    it('checkForUpdate should extract and return updateSilently, autoRestart, and skipOnStoreUpdate flags', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: 'Update available',
          data: {
            updateAvailable: true,
            release: {
              id: '66f1a2b3c4d5e6f708901234',
              platform: 'android',
              appVersion: '1.0.7',
              buildNumber: 1,
              bundleUrl: 'https://cdn.example.com/bundle.zip',
              bundleSizeBytes: 2457600,
              skipOnStoreUpdate: true,
              updateSilently: true,
              autoRestart: false,
              publishedAt: '2026-09-01T10:15:30.000Z',
            },
          },
        }),
      });

      const res = await OTAService.checkForUpdate();

      expect(res.updateAvailable).toBe(true);

      // Verify clean flags on release
      expect(res.release?.updateSilently).toBe(true);
      expect(res.release?.skipOnStoreUpdate).toBe(true);
      expect(res.release?.autoRestart).toBe(false);

      // Verify no duplicate snake_case variables
      expect((res.release as any)?.skip_on_store_update).toBeUndefined();
      expect((res.release as any)?.update_silently).toBeUndefined();
      expect((res as any)?.skip_on_store_update).toBeUndefined();
    });

    it('checkForUpdate should send POST request with platform, bundleId, version_no, and build_no on Android', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            updateAvailable: false,
            currentOtaVersion: 1,
          },
        }),
      });

      const result = await OTAService.checkForUpdate({
        platform: 'android',
        bundleId: 'com.example.android',
        version_no: '1.0.1',
        build_no: 120,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://appapi.metadevzone.com/api/ota/public/check-update',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-ota-app-key': 'ota_live_key_123',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            bundleId: 'com.example.android',
            platform: 'android',
            version_no: '1.0.1',
            build_no: 120,
            channel: 'production',
          }),
        })
      );
      expect(result.updateAvailable).toBe(false);
    });

    it('checkForUpdate should throw UNAUTHORIZED on 401', async () => {
      OTAService.configure({ apiKey: 'bad_key' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(OTAService.checkForUpdate()).rejects.toThrow(
        'Invalid API key'
      );
    });

    it('checkForUpdate should throw FORBIDDEN on 403', async () => {
      OTAService.configure({ apiKey: 'test_key' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(OTAService.checkForUpdate()).rejects.toThrow(
        'App bundle ID mismatch'
      );
    });

    it('checkForUpdate should return updateAvailable false on 404', async () => {
      OTAService.configure({ apiKey: 'test_key' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await OTAService.checkForUpdate();
      expect(result.updateAvailable).toBe(false);
    });

    it('checkForUpdate should throw NETWORK_ERROR on 500', async () => {
      OTAService.configure({ apiKey: 'test_key' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(OTAService.checkForUpdate()).rejects.toThrow(
        'Server returned HTTP status 500'
      );
    });

    it('checkForUpdate should include channel in POST body when specified', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123', channel: 'production' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { updateAvailable: false } }),
      });

      await OTAService.checkForUpdate({ channel: 'development' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://appapi.metadevzone.com/api/ota/public/check-update',
        expect.objectContaining({
          body: expect.stringContaining('"channel":"development"'),
        })
      );
    });

    it('checkForUpdate should throw INVALID_CHANNEL if channel is not development or production', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });

      await expect(
        OTAService.checkForUpdate({ channel: 'staging' as any })
      ).rejects.toThrow(
        'Allowed channels are only "development" | "production"'
      );
    });

    it('checkForUpdate should skip check when disableInDev is true', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123', disableInDev: true });
      (global.fetch as jest.Mock).mockClear();

      const result = await OTAService.checkForUpdate();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.updateAvailable).toBe(false);
      expect(result.isBlackList).toBe(false);
      expect(result.reason).toBe('OTA check disabled in __DEV__ mode');
    });

    it('checkForUpdate should set isBlackList to true when release bundleUrl is blacklisted', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue({
        reason: 'OTA: Channel mismatch',
        rejectedAt: '2026-09-01T10:00:00.000Z',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            updateAvailable: true,
            release: {
              id: 'rel_blacklisted',
              bundleUrl: 'https://cdn.example.com/rejected_bundle.zip',
            },
          },
        }),
      });

      const result = await OTAService.checkForUpdate();
      expect(result.updateAvailable).toBe(true);
      expect(result.isBlackList).toBe(true);
    });

    it('checkForUpdate should set isBlackList to false when release bundleUrl is not blacklisted', async () => {
      OTAService.configure({ apiKey: 'ota_live_key_123' });
      jest.spyOn(OTAStorage, 'getRejectedUrlInfo').mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            updateAvailable: true,
            release: {
              id: 'rel_clean',
              bundleUrl: 'https://cdn.example.com/clean_bundle.zip',
            },
          },
        }),
      });

      const result = await OTAService.checkForUpdate();
      expect(result.updateAvailable).toBe(true);
      expect(result.isBlackList).toBe(false);
    });

    it('reportEvent should warn and return false if apiKey is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await OTAService.reportEvent('download');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot report event')
      );
      consoleSpy.mockRestore();
    });

    it('reportEvent should send POST to events endpoint', async () => {
      OTAService.configure({ apiKey: 'test_key' });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const success = await OTAService.reportEvent('install', { releaseId: 'rel_1' });
      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ota/public/events'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-ota-app-key': 'test_key',
          }),
          body: expect.stringContaining('"event":"install"'),
        })
      );
    });

    it('reportBootSuccess should call reportEvent for install if not reported yet', async () => {
      OTAService.configure({ apiKey: 'test_key' });
      jest.spyOn(OTAStorage, 'readCurrent').mockResolvedValue({
        activeVersion: 2,
        activeBundlePath: '/mock/path',
        updatedAt: '2026-09-01',
        bootFailCount: 1,
        builtForNativeVersion: '1.0.0',
      });
      jest.spyOn(OTAStorage, 'writeCurrent').mockResolvedValue(undefined);
      jest.spyOn(OTAStorage, 'isInstallReported').mockResolvedValue(false);
      jest.spyOn(OTAStorage, 'markInstallReported').mockResolvedValue(undefined);
      jest.spyOn(OTAStorage, 'cleanupStaleBundles').mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      await OTAService.reportBootSuccess();

      expect(OTARestart.confirmNativeBootSuccess).toHaveBeenCalled();
      expect(OTAStorage.markInstallReported).toHaveBeenCalled();
      expect(OTAStorage.cleanupStaleBundles).toHaveBeenCalledWith(2);
    });

    it('helper methods proxy to native module', () => {
      expect(OTAService.getAppVersion()).toBe('1.0.0');
      expect(OTAService.getOtaVersion()).toBe(1);
      expect(OTAService.getActiveVersion()).toBe(1);
      expect(OTAService.getAppId()).toBe('com.hisabkitab360.app');
      OTAService.restartApp();
      expect(OTARestart.restartApp).toHaveBeenCalled();
    });
  });
});
