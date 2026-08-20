import { Platform } from 'react-native';
import { OTADownloader } from './OTADownloader';
import { OTAStorage } from './OTAStorage';
import type { BundleMeta } from './OTAStorage';
// import { OTAHash } from './OTAHash';
import type {
  OTACurrentInfo,
  OTADownloadOptions,
  OTAProgressPayload,
} from './OTATypes';
import { OTA_BUNDLE_FILE_NAME, OTA_BUNDLE_FILE_NAME_IOS } from './OTAConstants';
import { confirmNativeBootSuccess, getAppVersion, restartApp } from './OTARestart';

const MAX_BOOT_FAIL_COUNT = 2;

let isDownloading = false;

class OTAServiceClass {
  async getActiveVersion(): Promise<number> {
    const current = await OTAStorage.readCurrent();
    return current?.activeVersion ?? 0;
  }

  async downloadAndApplyUpdate(
    options: OTADownloadOptions
  ): Promise<{ updated: boolean; version?: number }> {
    if (isDownloading) {
      throw new Error('OTA: download already in progress');
    }
    isDownloading = true;

    const { downloadUrl, bundleVersion, hash, onProgress, autoRestart } = options;

    const emit = (
      partial: Omit<OTAProgressPayload, 'downloadedBytes' | 'totalBytes' | 'downloadedMB' | 'totalMB'> & {
        downloadedBytes?: number;
        totalBytes?: number;
      }
    ) => {
      onProgress({
        downloadedBytes: partial.downloadedBytes ?? 0,
        totalBytes: partial.totalBytes ?? 0,
        downloadedMB: '0.0 MB',
        totalMB: '',
        percentage: partial.percentage,
        status: partial.status,
      });
    };

    emit({ status: 'idle', percentage: 0 });

    try {
      const previous = await OTAStorage.readCurrent();

      const zipPath = await OTADownloader.downloadBundle(
        downloadUrl,
        bundleVersion,
        onProgress
      );

      // const isValid = await OTAHash.verify(zipPath, hash ?? '');
      // if (!isValid) {
      //   throw new Error('OTA: hash verification failed, bundle corrupt');
      // }

      const bundleDir = await OTAStorage.extractBundle(zipPath, bundleVersion);

      const meta: BundleMeta | null = await OTAStorage.readBundleMeta(bundleDir);
      const nativeVersion = await getAppVersion();
      if (meta === null) {
        console.warn('OTA: bundle has no meta.json, skipping version verification');
      } else {
        if (meta.appVersion !== nativeVersion) {
          await OTAStorage.deleteBundleVersion(bundleVersion);
          emit({ status: 'failed', percentage: 0 });
          throw new Error(
            `OTA: app version mismatch — bundle=${meta.appVersion}, device=${nativeVersion}`
          );
        }

        const metaBundleVersion =
          Platform.OS === 'ios' ? meta.iosOtaVersion : meta.androidOtaVersion;
        if (metaBundleVersion !== undefined && metaBundleVersion !== bundleVersion) {
          await OTAStorage.deleteBundleVersion(bundleVersion);
          emit({ status: 'failed', percentage: 0 });
          throw new Error(
            `OTA: bundle version mismatch — expected ${bundleVersion}, meta.json has ${metaBundleVersion}`
          );
        }
      }

      const bundleFileName =
        Platform.OS === 'ios' ? OTA_BUNDLE_FILE_NAME_IOS : OTA_BUNDLE_FILE_NAME;
      const bundlePath = `${bundleDir}/${bundleFileName}`;

      const newCurrent: OTACurrentInfo = {
        activeVersion: bundleVersion,
        activeBundlePath: bundlePath,
        hash: hash ?? '',
        updatedAt: new Date().toISOString(),
        bootFailCount: 0,
        builtForNativeVersion: nativeVersion,
      };

      await OTAStorage.writeCurrent(newCurrent);

      if (previous) {
        await OTAStorage.deleteBundleVersion(previous.activeVersion);
      }

      emit({ status: 'downloaded', percentage: 100 });

      if (autoRestart === true) {
        emit({ status: 'installed', percentage: 100 });
        restartApp();
      }

      return { updated: true, version: bundleVersion };
    } catch (err: any) {
      emit({ status: 'failed', percentage: 0 });
      throw err;
    } finally {
      isDownloading = false;
    }
  }

  async reportBootSuccess(): Promise<void> {
    await confirmNativeBootSuccess();

    const current = await OTAStorage.readCurrent();
    if (!current) return;
    if (current.bootFailCount !== 0) {
      current.bootFailCount = 0;
      await OTAStorage.writeCurrent(current);
    }
  }

  async reportBootFailure(): Promise<{ rolledBack: boolean }> {
    const current = await OTAStorage.readCurrent();
    if (!current) return { rolledBack: false };

    current.bootFailCount = (current.bootFailCount ?? 0) + 1;

    if (current.bootFailCount >= MAX_BOOT_FAIL_COUNT) {
      await OTAStorage.clearAll();
      return { rolledBack: true };
    }

    await OTAStorage.writeCurrent(current);
    return { rolledBack: false };
  }

  async getActiveBundlePathForNative(): Promise<string | null> {
    const current = await OTAStorage.readCurrent();
    return current?.activeBundlePath ?? null;
  }
}

export const OTAService = new OTAServiceClass();
