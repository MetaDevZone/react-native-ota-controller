import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { OTAStorage } from '../OTAStorage';
import {
  OTA_ROOT_DIR,
  OTA_BUNDLES_DIR,
  OTA_DOWNLOAD_DIR,
  OTA_STAGING_DIR,
  OTA_CURRENT_FILE,
  OTA_REJECTED_FILE,
} from '../OTAConstants';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  readDir: jest.fn(),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(),
}));

describe('OTAStorage Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
    (RNFS.moveFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    (unzip as jest.Mock).mockResolvedValue(undefined);
  });

  describe('ensureRootDirs', () => {
    it('should create directories if they do not exist', async () => {
      (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
        if (path === OTA_BUNDLES_DIR) return false;
        return true;
      });

      await OTAStorage.ensureRootDirs();

      expect(RNFS.mkdir).toHaveBeenCalledWith(OTA_BUNDLES_DIR);
      expect(RNFS.mkdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('bundleDirForVersion', () => {
    it('should return the correct versioned path', () => {
      expect(OTAStorage.bundleDirForVersion(5)).toBe(`${OTA_BUNDLES_DIR}/bundle5`);
    });
  });

  describe('extractBundle', () => {
    it('should extract zip, unlink old targetDir and clean up source zip', async () => {
      const zipPath = '/mock/downloads/bundle.zip';
      const targetDir = `${OTA_BUNDLES_DIR}/bundle3`;

      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      const res = await OTAStorage.extractBundle(zipPath, 3);

      expect(res).toBe(targetDir);
      expect(RNFS.unlink).toHaveBeenCalledWith(targetDir);
      expect(unzip).toHaveBeenCalledWith(zipPath, targetDir);
      expect(RNFS.unlink).toHaveBeenCalledWith(zipPath);
    });

    it('should not unlink targetDir or zipPath if they do not exist', async () => {
      const zipPath = '/mock/downloads/bundle.zip';
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      await OTAStorage.extractBundle(zipPath, 3);

      expect(unzip).toHaveBeenCalled();
      expect(RNFS.unlink).not.toHaveBeenCalled();
    });
  });

  describe('extractToStaging', () => {
    it('should extract zip to staging and delete source zip', async () => {
      const zipPath = '/mock/downloads/update.zip';
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      const res = await OTAStorage.extractToStaging(zipPath);

      expect(res).toBe(OTA_STAGING_DIR);
      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_STAGING_DIR);
      expect(unzip).toHaveBeenCalledWith(zipPath, OTA_STAGING_DIR);
      expect(RNFS.unlink).toHaveBeenCalledWith(zipPath);
    });
  });

  describe('promoteStaging', () => {
    it('should unlink existing targetDir and move staging to targetDir', async () => {
      const targetDir = `${OTA_BUNDLES_DIR}/bundle2`;
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      const res = await OTAStorage.promoteStaging(2);

      expect(res).toBe(targetDir);
      expect(RNFS.unlink).toHaveBeenCalledWith(targetDir);
      expect(RNFS.moveFile).toHaveBeenCalledWith(OTA_STAGING_DIR, targetDir);
    });
  });

  describe('cleanupStaging', () => {
    it('should remove staging directory if exists', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      await OTAStorage.cleanupStaging();

      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_STAGING_DIR);
    });

    it('should catch errors silently without throwing', async () => {
      (RNFS.exists as jest.Mock).mockRejectedValue(new Error('Permission error'));

      await expect(OTAStorage.cleanupStaging()).resolves.toBeUndefined();
    });
  });

  describe('readCurrent and writeCurrent', () => {
    it('readCurrent should return null if current.json does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      const res = await OTAStorage.readCurrent();
      expect(res).toBeNull();
    });

    it('readCurrent should return null if current.json content is corrupted', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue('{invalid json');

      const res = await OTAStorage.readCurrent();
      expect(res).toBeNull();
    });

    it('readCurrent should return parsed object if file is valid', async () => {
      const currentData = {
        activeVersion: 2,
        activeBundlePath: '/mock/bundle2/main.jsbundle',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify(currentData));

      const res = await OTAStorage.readCurrent();
      expect(res).toEqual(currentData);
    });

    it('writeCurrent should safely write to tmp file and move to current.json', async () => {
      const currentData = {
        activeVersion: 2,
        activeBundlePath: '/mock/bundle2/main.jsbundle',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => {
        if (p === OTA_CURRENT_FILE) return true;
        return true;
      });

      await OTAStorage.writeCurrent(currentData);

      const tempPath = `${OTA_CURRENT_FILE}.tmp`;
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        tempPath,
        JSON.stringify(currentData, null, 2),
        'utf8'
      );
      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_CURRENT_FILE);
      expect(RNFS.moveFile).toHaveBeenCalledWith(tempPath, OTA_CURRENT_FILE);
    });

    it('writeCurrent should clean up temp file and rethrow on failure', async () => {
      const currentData = {
        activeVersion: 2,
        activeBundlePath: '/mock/bundle2/main.jsbundle',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      (RNFS.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      const tempPath = `${OTA_CURRENT_FILE}.tmp`;

      await expect(OTAStorage.writeCurrent(currentData)).rejects.toThrow('Disk full');
      expect(RNFS.unlink).toHaveBeenCalledWith(tempPath);
    });
  });

  describe('deleteBundleVersion', () => {
    it('should delete bundle version dir if it exists', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      await OTAStorage.deleteBundleVersion(4);

      expect(RNFS.unlink).toHaveBeenCalledWith(`${OTA_BUNDLES_DIR}/bundle4`);
    });

    it('should do nothing if bundle version dir does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      await OTAStorage.deleteBundleVersion(4);

      expect(RNFS.unlink).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStaleBundles', () => {
    it('should delete older bundle directories except keepVersion', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readDir as jest.Mock).mockResolvedValue([
        { isDirectory: () => true, name: 'bundle1', path: `${OTA_BUNDLES_DIR}/bundle1` },
        { isDirectory: () => true, name: 'bundle2', path: `${OTA_BUNDLES_DIR}/bundle2` },
        { isDirectory: () => true, name: 'bundle3', path: `${OTA_BUNDLES_DIR}/bundle3` },
        { isDirectory: () => false, name: 'other.txt', path: `${OTA_BUNDLES_DIR}/other.txt` },
        { isDirectory: () => true, name: 'nonmatching', path: `${OTA_BUNDLES_DIR}/nonmatching` },
      ]);

      await OTAStorage.cleanupStaleBundles(3);

      expect(RNFS.unlink).toHaveBeenCalledWith(`${OTA_BUNDLES_DIR}/bundle1`);
      expect(RNFS.unlink).toHaveBeenCalledWith(`${OTA_BUNDLES_DIR}/bundle2`);
      expect(RNFS.unlink).not.toHaveBeenCalledWith(`${OTA_BUNDLES_DIR}/bundle3`);
      expect(RNFS.unlink).not.toHaveBeenCalledWith(`${OTA_BUNDLES_DIR}/other.txt`);
    });

    it('should ignore errors during cleanup', async () => {
      (RNFS.exists as jest.Mock).mockRejectedValue(new Error('Read failed'));

      await expect(OTAStorage.cleanupStaleBundles(1)).resolves.toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should delete root OTA directory if it exists', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      await OTAStorage.clearAll();

      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_ROOT_DIR);
    });

    it('should do nothing if root OTA directory does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      await OTAStorage.clearAll();

      expect(RNFS.unlink).not.toHaveBeenCalled();
    });
  });

  describe('readBundleMeta', () => {
    it('should return null if meta.json does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      const res = await OTAStorage.readBundleMeta('/mock/bundle1');
      expect(res).toBeNull();
    });

    it('should return null if meta.json contains invalid JSON', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue('corrupted meta');

      const res = await OTAStorage.readBundleMeta('/mock/bundle1');
      expect(res).toBeNull();
    });

    it('should return parsed BundleMeta if valid', async () => {
      const meta = {
        appId: 'com.test.app',
        appVersion: '1.0.0',
        otaVersion: 2,
      };
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify(meta));

      const res = await OTAStorage.readBundleMeta('/mock/bundle1');
      expect(res).toEqual(meta);
    });
  });

  describe('Rejected updates & Blacklist', () => {
    it('readRejectedUpdates should return empty structure if file does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      const res = await OTAStorage.readRejectedUpdates('1.0.0');
      expect(res).toEqual({
        nativeAppVersion: '1.0.0',
        rejectedUrls: {},
      });
    });

    it('readRejectedUpdates should reset and clear list if native store app version changed', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify({
          nativeAppVersion: '1.0.0',
          rejectedUrls: {
            'https://example.com/bad.zip': { reason: 'err', rejectedAt: '2026-08-01' },
          },
        })
      );

      const res = await OTAStorage.readRejectedUpdates('1.1.0');

      expect(res).toEqual({
        nativeAppVersion: '1.1.0',
        rejectedUrls: {},
      });
      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_REJECTED_FILE);
    });

    it('addRejectedUrl should append url and reason and persist to file', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      await OTAStorage.addRejectedUrl('https://example.com/bundle.zip', 'App mismatch', '1.0.0');

      expect(RNFS.writeFile).toHaveBeenCalledWith(
        OTA_REJECTED_FILE,
        expect.stringContaining('https://example.com/bundle.zip'),
        'utf8'
      );
    });

    it('clearRejectedUpdates should unlink file if exists', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      await OTAStorage.clearRejectedUpdates();

      expect(RNFS.unlink).toHaveBeenCalledWith(OTA_REJECTED_FILE);
    });
  });

  describe('markInstallReported and isInstallReported', () => {
    it('markInstallReported should update current info with installReportedVersion', async () => {
      const current = {
        activeVersion: 2,
        activeBundlePath: '/bundle2',
      };
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify(current));

      await OTAStorage.markInstallReported(2);

      expect(RNFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tmp'),
        expect.stringContaining('"installReportedVersion": 2'),
        'utf8'
      );
    });

    it('isInstallReported should return true when version matches', async () => {
      const current = {
        activeVersion: 3,
        activeBundlePath: '/bundle3',
        installReportedVersion: 3,
      };
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify(current));

      const res = await OTAStorage.isInstallReported(3);
      expect(res).toBe(true);
    });

    it('isInstallReported should return false when version does not match or no current exists', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);

      const res = await OTAStorage.isInstallReported(3);
      expect(res).toBe(false);
    });
  });
});
