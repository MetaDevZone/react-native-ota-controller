"use strict";

import { Platform } from 'react-native';
import { OTADownloader } from "./OTADownloader.js";
import { OTAStorage } from "./OTAStorage.js";
import { OTA_BUNDLE_FILE_NAME, OTA_BUNDLE_FILE_NAME_IOS } from "./OTAConstants.js";
import { confirmNativeBootSuccess, getAppVersion, restartApp } from "./OTARestart.js";
const MAX_BOOT_FAIL_COUNT = 2;
let isDownloading = false;
class OTAServiceClass {
  async getActiveVersion() {
    const current = await OTAStorage.readCurrent();
    return current?.activeVersion ?? 0;
  }
  async downloadAndApplyUpdate(options) {
    if (isDownloading) {
      throw new Error('OTA: download already in progress');
    }
    isDownloading = true;
    const {
      downloadUrl,
      bundleVersion,
      onProgress,
      autoRestart
    } = options;
    const emit = partial => {
      onProgress({
        downloadedBytes: partial.downloadedBytes ?? 0,
        totalBytes: partial.totalBytes ?? 0,
        downloadedMB: '0.0 MB',
        totalMB: '',
        percentage: partial.percentage,
        status: partial.status
      });
    };
    emit({
      status: 'idle',
      percentage: 0
    });
    try {
      const previous = await OTAStorage.readCurrent();
      const zipPath = await OTADownloader.downloadBundle(downloadUrl, onProgress, bundleVersion);
      const stagingDir = await OTAStorage.extractToStaging(zipPath);
      const meta = await OTAStorage.readBundleMeta(stagingDir);
      const nativeVersion = await getAppVersion();
      if (meta === null) {
        await OTAStorage.cleanupStaging();
        emit({
          status: 'failed',
          percentage: 0
        });
        throw new Error('OTA: bundle has no meta.json, invalid package');
      }
      if (meta.appVersion !== nativeVersion) {
        await OTAStorage.cleanupStaging();
        emit({
          status: 'failed',
          percentage: 0
        });
        throw new Error(`OTA: app version mismatch — bundle=${meta.appVersion}, device=${nativeVersion}`);
      }
      const targetOtaVersion = meta.otaVersion ?? bundleVersion ?? 1;
      const activeVersion = await this.getActiveVersion();
      if (targetOtaVersion <= activeVersion) {
        await OTAStorage.cleanupStaging();
        emit({
          status: 'downloaded',
          percentage: 100
        });
        return {
          updated: false,
          version: activeVersion
        };
      }
      const bundleDir = await OTAStorage.promoteStaging(targetOtaVersion);
      const bundleFileName = Platform.OS === 'ios' ? OTA_BUNDLE_FILE_NAME_IOS : OTA_BUNDLE_FILE_NAME;
      const bundlePath = `${bundleDir}/${bundleFileName}`;
      const newCurrent = {
        activeVersion: targetOtaVersion,
        activeBundlePath: bundlePath,
        updatedAt: new Date().toISOString(),
        bootFailCount: 0,
        builtForNativeVersion: nativeVersion
      };
      await OTAStorage.writeCurrent(newCurrent);
      if (previous && previous.activeVersion !== targetOtaVersion) {
        await OTAStorage.deleteBundleVersion(previous.activeVersion);
      }
      emit({
        status: 'downloaded',
        percentage: 100
      });
      if (autoRestart === true) {
        emit({
          status: 'installed',
          percentage: 100
        });
        restartApp();
      }
      return {
        updated: true,
        version: targetOtaVersion
      };
    } catch (err) {
      await OTAStorage.cleanupStaging();
      emit({
        status: 'failed',
        percentage: 0
      });
      throw err;
    } finally {
      isDownloading = false;
    }
  }
  async reportBootSuccess() {
    await confirmNativeBootSuccess();
    const current = await OTAStorage.readCurrent();
    if (!current) return;
    if (current.bootFailCount !== 0) {
      current.bootFailCount = 0;
      await OTAStorage.writeCurrent(current);
    }
  }
  async reportBootFailure() {
    const current = await OTAStorage.readCurrent();
    if (!current) return {
      rolledBack: false
    };
    current.bootFailCount = (current.bootFailCount ?? 0) + 1;
    if (current.bootFailCount >= MAX_BOOT_FAIL_COUNT) {
      await OTAStorage.clearAll();
      return {
        rolledBack: true
      };
    }
    await OTAStorage.writeCurrent(current);
    return {
      rolledBack: false
    };
  }
  async getActiveBundlePathForNative() {
    const current = await OTAStorage.readCurrent();
    return current?.activeBundlePath ?? null;
  }
}
export const OTAService = new OTAServiceClass();
//# sourceMappingURL=OTAService.js.map