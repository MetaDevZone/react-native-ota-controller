"use strict";

import { Platform } from 'react-native';
import { OTADownloader } from "./OTADownloader.js";
import { OTAStorage } from "./OTAStorage.js";
import { OTA_BUNDLE_FILE_NAME, OTA_BUNDLE_FILE_NAME_IOS } from "./OTAConstants.js";
import { confirmNativeBootSuccess, getAppId, getAppVersion, getOtaVersion, restartApp } from "./OTARestart.js";
const MAX_BOOT_FAIL_COUNT = 2;
let isDownloading = false;
export class OTAError extends Error {
  constructor(code, message, originalError) {
    super(message);
    this.name = 'OTAError';
    this.code = code;
    this.originalError = originalError;
  }
  toPayload() {
    return {
      code: this.code,
      message: this.message,
      originalError: this.originalError
    };
  }
}
class OTAServiceClass {
  getActiveVersion() {
    return getOtaVersion();
  }
  async downloadAndApplyUpdate(options) {
    const {
      url,
      onProgress,
      onError,
      autoRestart
    } = options;
    if (!url) {
      const err = new OTAError('DOWNLOAD_FAILED', 'OTA: No download URL provided in options');
      onError?.(err.toPayload());
      throw err;
    }
    const nativeVersion = getAppVersion();
    const nativeAppId = getAppId();
    const rejectedInfo = await OTAStorage.getRejectedUrlInfo(url, nativeVersion);
    if (rejectedInfo) {
      const err = new OTAError('UPDATE_BLACKLISTED', `OTA: Skipping update — bundle URL was previously rejected (${rejectedInfo.reason})`);
      onError?.(err.toPayload());
      throw err;
    }
    if (isDownloading) {
      const err = new OTAError('ALREADY_IN_PROGRESS', 'OTA: An update download is already in progress');
      onError?.(err.toPayload());
      throw err;
    }
    isDownloading = true;
    const emit = partial => {
      onProgress?.({
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
      let zipPath;
      try {
        zipPath = await OTADownloader.downloadBundle(url, payload => emit(payload));
      } catch (err) {
        throw new OTAError('DOWNLOAD_FAILED', `OTA: Failed to download update zip from ${url} — ${err?.message ?? err}`, err);
      }
      let stagingDir;
      try {
        stagingDir = await OTAStorage.extractToStaging(zipPath);
      } catch (err) {
        throw new OTAError('EXTRACTION_FAILED', `OTA: Failed to extract update zip archive — ${err?.message ?? err}`, err);
      }
      const meta = await OTAStorage.readBundleMeta(stagingDir);
      if (meta === null) {
        throw new OTAError('INVALID_META', 'OTA: Bundle is corrupt or missing meta.json manifest');
      }
      if (!meta.appId || nativeAppId && meta.appId !== nativeAppId) {
        throw new OTAError('APP_ID_MISMATCH', meta.appId ? `OTA: App ID mismatch — bundle is built for ${meta.appId}, but device is running ${nativeAppId}` : `OTA: App ID missing in bundle — bundles must be built with a valid appId matching ${nativeAppId}`);
      }
      if (meta.appVersion !== nativeVersion) {
        throw new OTAError('APP_VERSION_MISMATCH', `OTA: App version mismatch — bundle is built for native ${meta.appVersion}, but device is running ${nativeVersion}`);
      }
      const targetOtaVersion = meta.otaVersion ?? 1;
      const activeVersion = this.getActiveVersion();
      if (targetOtaVersion <= activeVersion) {
        await OTAStorage.cleanupStaging();
        await new Promise(resolve => setTimeout(resolve, 1000));
        emit({
          status: 'downloaded',
          percentage: 100
        });
        return {
          updated: false,
          version: activeVersion
        };
      }
      let bundleDir;
      try {
        bundleDir = await OTAStorage.promoteStaging(targetOtaVersion);
      } catch (err) {
        throw new OTAError('STORAGE_ERROR', `OTA: Failed to promote staging bundle to storage — ${err?.message ?? err}`, err);
      }
      const bundleFileName = Platform.OS === 'ios' ? OTA_BUNDLE_FILE_NAME_IOS : OTA_BUNDLE_FILE_NAME;
      const bundlePath = `${bundleDir}/${bundleFileName}`;
      const newCurrent = {
        activeVersion: targetOtaVersion,
        activeBundlePath: bundlePath,
        updatedAt: new Date().toISOString(),
        bootFailCount: 0,
        builtForNativeVersion: nativeVersion
      };
      try {
        await OTAStorage.writeCurrent(newCurrent);
        // Successful OTA update applied -> reset rejected URLs list
        await OTAStorage.clearRejectedUpdates();
      } catch (err) {
        throw new OTAError('STORAGE_ERROR', `OTA: Failed to write current.json manifest — ${err?.message ?? err}`, err);
      }
      emit({
        status: 'downloaded',
        percentage: 100
      });
      if (autoRestart === true) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        emit({
          status: 'installed',
          percentage: 100
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        restartApp();
      }
      return {
        updated: true,
        version: targetOtaVersion
      };
    } catch (err) {
      await OTAStorage.cleanupStaging();
      if (err instanceof OTAError && (err.code === 'APP_ID_MISMATCH' || err.code === 'APP_VERSION_MISMATCH' || err.code === 'INVALID_META')) {
        await OTAStorage.addRejectedUrl(url, err.message, nativeVersion);
      }
      emit({
        status: 'failed',
        percentage: 0
      });
      const otaErrorPayload = err instanceof OTAError ? err.toPayload() : {
        code: 'UNKNOWN_ERROR',
        message: String(err?.message ?? err),
        originalError: err
      };
      onError?.(otaErrorPayload);
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

    // Clean up older stale bundle directories on disk now that active bundle booted successfully
    if (typeof current.activeVersion === 'number' && current.activeVersion > 0) {
      await OTAStorage.cleanupStaleBundles(current.activeVersion);
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