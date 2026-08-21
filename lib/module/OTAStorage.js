"use strict";

import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { OTA_ROOT_DIR, OTA_BUNDLES_DIR, OTA_DOWNLOAD_DIR, OTA_STAGING_DIR, OTA_CURRENT_FILE } from "./OTAConstants.js";
class OTAStorageClass {
  async ensureRootDirs() {
    for (const dir of [OTA_ROOT_DIR, OTA_BUNDLES_DIR, OTA_DOWNLOAD_DIR]) {
      const exists = await RNFS.exists(dir);
      if (!exists) {
        await RNFS.mkdir(dir);
      }
    }
  }
  bundleDirForVersion(version) {
    return `${OTA_BUNDLES_DIR}/bundle${version}`;
  }
  async extractBundle(zipPath, version) {
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
  async extractToStaging(zipPath) {
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
  async promoteStaging(version) {
    await this.ensureRootDirs();
    const targetDir = this.bundleDirForVersion(version);
    const targetExists = await RNFS.exists(targetDir);
    if (targetExists) {
      await RNFS.unlink(targetDir);
    }
    await RNFS.moveFile(OTA_STAGING_DIR, targetDir);
    return targetDir;
  }
  async cleanupStaging() {
    try {
      const exists = await RNFS.exists(OTA_STAGING_DIR);
      if (exists) {
        await RNFS.unlink(OTA_STAGING_DIR);
      }
    } catch {
      // Ignore cleanup error
    }
  }
  async readCurrent() {
    const exists = await RNFS.exists(OTA_CURRENT_FILE);
    if (!exists) return null;
    const content = await RNFS.readFile(OTA_CURRENT_FILE, 'utf8');
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  async writeCurrent(info) {
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
  async deleteBundleVersion(version) {
    const dir = this.bundleDirForVersion(version);
    const exists = await RNFS.exists(dir);
    if (exists) {
      await RNFS.unlink(dir);
    }
  }
  async clearAll() {
    const exists = await RNFS.exists(OTA_ROOT_DIR);
    if (exists) {
      await RNFS.unlink(OTA_ROOT_DIR);
    }
  }
  async readBundleMeta(bundleDir) {
    const metaPath = `${bundleDir}/meta.json`;
    try {
      const exists = await RNFS.exists(metaPath);
      if (!exists) return null;
      const content = await RNFS.readFile(metaPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
export const OTAStorage = new OTAStorageClass();
//# sourceMappingURL=OTAStorage.js.map