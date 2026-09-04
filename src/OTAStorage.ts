import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import {
  OTA_ROOT_DIR,
  OTA_BUNDLES_DIR,
  OTA_DOWNLOAD_DIR,
  OTA_STAGING_DIR,
  OTA_CURRENT_FILE,
  OTA_REJECTED_FILE,
} from './OTAConstants';
import type { OTACurrentInfo } from './OTATypes';

export type BundleMeta = {
  appId: string;
  appVersion: string;
  otaVersion?: number;
  channel?: string;
  builtAt?: string;
};

export type RejectedEntry = {
  reason: string;
  rejectedAt: string;
};

export type RejectedUpdatesData = {
  nativeAppVersion: string;
  rejectedUrls: Record<string, RejectedEntry>;
};

class OTAStorageClass {
  async ensureRootDirs() {
    for (const dir of [OTA_ROOT_DIR, OTA_BUNDLES_DIR, OTA_DOWNLOAD_DIR]) {
      const exists = await RNFS.exists(dir);
      if (!exists) {
        await RNFS.mkdir(dir);
      }
    }
  }

  bundleDirForVersion(version: number): string {
    return `${OTA_BUNDLES_DIR}/bundle${version}`;
  }

  async extractBundle(zipPath: string, version: number): Promise<string> {
    await this.ensureRootDirs();
    const targetDir = this.bundleDirForVersion(version);

    const exists = await RNFS.exists(targetDir);
    if (exists) {
      await RNFS.unlink(targetDir);
    }

    await unzip(zipPath, targetDir);

    const zipExists = await RNFS.exists(zipPath);
    if (zipExists) {
      await RNFS.unlink(zipPath);
    }

    return targetDir;
  }

  async extractToStaging(zipPath: string): Promise<string> {
    await this.ensureRootDirs();
    const stagingDir = OTA_STAGING_DIR;

    const exists = await RNFS.exists(stagingDir);
    if (exists) {
      await RNFS.unlink(stagingDir);
    }

    await unzip(zipPath, stagingDir);

    const zipExists = await RNFS.exists(zipPath);
    if (zipExists) {
      await RNFS.unlink(zipPath);
    }

    return stagingDir;
  }

  async promoteStaging(version: number): Promise<string> {
    await this.ensureRootDirs();
    const targetDir = this.bundleDirForVersion(version);

    const targetExists = await RNFS.exists(targetDir);
    if (targetExists) {
      await RNFS.unlink(targetDir);
    }

    await RNFS.moveFile(OTA_STAGING_DIR, targetDir);
    return targetDir;
  }

  async cleanupStaging(): Promise<void> {
    try {
      const exists = await RNFS.exists(OTA_STAGING_DIR);
      if (exists) {
        await RNFS.unlink(OTA_STAGING_DIR);
      }
    } catch {
      // Ignore cleanup error
    }
  }

  async readCurrent(): Promise<OTACurrentInfo | null> {
    const exists = await RNFS.exists(OTA_CURRENT_FILE);
    if (!exists) return null;

    const content = await RNFS.readFile(OTA_CURRENT_FILE, 'utf8');
    try {
      return JSON.parse(content) as OTACurrentInfo;
    } catch {
      return null;
    }
  }

  async writeCurrent(info: OTACurrentInfo): Promise<void> {
    await this.ensureRootDirs();

    const tempPath = `${OTA_CURRENT_FILE}.tmp`;

    try {
      await RNFS.writeFile(tempPath, JSON.stringify(info, null, 2), 'utf8');

      const destExists = await RNFS.exists(OTA_CURRENT_FILE);
      if (destExists) {
        await RNFS.unlink(OTA_CURRENT_FILE);
      }

      await RNFS.moveFile(tempPath, OTA_CURRENT_FILE);
    } catch (err) {
      const tempExists = await RNFS.exists(tempPath);
      if (tempExists) {
        await RNFS.unlink(tempPath);
      }
      throw err;
    }
  }

  async deleteBundleVersion(version: number): Promise<void> {
    const dir = this.bundleDirForVersion(version);
    const exists = await RNFS.exists(dir);
    if (exists) {
      await RNFS.unlink(dir);
    }
  }

  async cleanupStaleBundles(keepVersion: number): Promise<void> {
    try {
      const exists = await RNFS.exists(OTA_BUNDLES_DIR);
      if (!exists) return;
      const items = await RNFS.readDir(OTA_BUNDLES_DIR);
      for (const item of items) {
        if (item.isDirectory() && item.name.startsWith('bundle')) {
          const verStr = item.name.replace('bundle', '');
          const verNum = parseInt(verStr, 10);
          if (Number.isFinite(verNum) && verNum !== keepVersion) {
            await RNFS.unlink(item.path);
          }
        }
      }
    } catch {
      // Ignore background cleanup error
    }
  }

  async clearAll(): Promise<void> {
    const exists = await RNFS.exists(OTA_ROOT_DIR);
    if (exists) {
      await RNFS.unlink(OTA_ROOT_DIR);
    }
  }

  async readBundleMeta(bundleDir: string): Promise<BundleMeta | null> {
    const metaPath = `${bundleDir}/meta.json`;
    try {
      const exists = await RNFS.exists(metaPath);
      if (!exists) return null;
      const content = await RNFS.readFile(metaPath, 'utf8');
      return JSON.parse(content) as BundleMeta;
    } catch {
      return null;
    }
  }

  async readRejectedUpdates(currentNativeVersion: string): Promise<RejectedUpdatesData> {
    try {
      const exists = await RNFS.exists(OTA_REJECTED_FILE);
      if (!exists) {
        return { nativeAppVersion: currentNativeVersion, rejectedUrls: {} };
      }
      const content = await RNFS.readFile(OTA_REJECTED_FILE, 'utf8');
      const data = JSON.parse(content) as RejectedUpdatesData;

      // Agar App Store / Play Store ka naya binary version install hua ho, to purani rejected list reset karo
      if (data.nativeAppVersion !== currentNativeVersion) {
        await this.clearRejectedUpdates();
        return { nativeAppVersion: currentNativeVersion, rejectedUrls: {} };
      }

      return data;
    } catch {
      return { nativeAppVersion: currentNativeVersion, rejectedUrls: {} };
    }
  }

  async getRejectedUrlInfo(
    url: string,
    currentNativeVersion: string
  ): Promise<RejectedEntry | null> {
    const data = await this.readRejectedUpdates(currentNativeVersion);
    return data.rejectedUrls?.[url] ?? null;
  }

  async addRejectedUrl(
    url: string,
    reason: string,
    currentNativeVersion: string
  ): Promise<void> {
    try {
      await this.ensureRootDirs();
      const data = await this.readRejectedUpdates(currentNativeVersion);
      data.nativeAppVersion = currentNativeVersion;
      if (!data.rejectedUrls) data.rejectedUrls = {};
      data.rejectedUrls[url] = {
        reason,
        rejectedAt: new Date().toISOString(),
      };
      await RNFS.writeFile(
        OTA_REJECTED_FILE,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    } catch (err) {
      // Ignore background blacklist write failure
    }
  }

  async clearRejectedUpdates(): Promise<void> {
    try {
      const exists = await RNFS.exists(OTA_REJECTED_FILE);
      if (exists) {
        await RNFS.unlink(OTA_REJECTED_FILE);
      }
    } catch {
      // Ignore
    }
  }

  async markInstallReported(version: number): Promise<void> {
    try {
      const current = await this.readCurrent();
      if (current) {
        current.installReportedVersion = version;
        await this.writeCurrent(current);
      }
    } catch {
      // Ignore background storage write error
    }
  }

  async isInstallReported(version: number): Promise<boolean> {
    try {
      const current = await this.readCurrent();
      if (!current) return false;
      return current.installReportedVersion === version;
    } catch {
      return false;
    }
  }
}

export const OTAStorage = new OTAStorageClass();
