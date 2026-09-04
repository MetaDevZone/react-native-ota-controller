import { Platform } from 'react-native';
import { OTADownloader } from './OTADownloader';
import { OTAStorage } from './OTAStorage';
import type { BundleMeta } from './OTAStorage';
import type {
  OTAChannel,
  OTAConfig,
  OTACheckUpdateOptions,
  OTACheckUpdateResult,
  OTACurrentInfo,
  OTADownloadOptions,
  OTAErrorCode,
  OTAErrorPayload,
  OTAProgressPayload,
  OTAReleaseInfo,
} from './OTATypes';
import {
  OTA_API_BASE_URL,
  OTA_BUNDLE_FILE_NAME,
  OTA_BUNDLE_FILE_NAME_IOS,
  OTA_CHECK_UPDATE_PATH,
  OTA_EVENTS_PATH,
} from './OTAConstants';
import {
  confirmNativeBootSuccess,
  getAppId,
  getAppVersion,
  getOtaVersion,
  restartApp,
} from './OTARestart';

const MAX_BOOT_FAIL_COUNT = 2;

let isDownloading = false;

export class OTAError extends Error {
  code: OTAErrorCode;
  originalError?: any;

  constructor(code: OTAErrorCode, message: string, originalError?: any) {
    super(message);
    this.name = 'OTAError';
    this.code = code;
    this.originalError = originalError;
  }

  toPayload(): OTAErrorPayload {
    return {
      code: this.code,
      message: this.message,
      originalError: this.originalError,
    };
  }
}

class OTAServiceClass {
  private config: OTAConfig | null = null;
  private cachedCheckResult: OTACheckUpdateResult | null = null;
  private reportedDownloads = new Set<string>();

  /**
   * Configure global credentials for the OTALink SDK.
   * Called automatically by <OTAProvider apiKey="..." /> on mount.
   */
  configure(config: OTAConfig): void {
    if (!config?.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
      throw new OTAError('API_KEY_MISSING', 'OTA: apiKey is required in configure().');
    }

    this.config = {
      ...config,
      apiKey: config.apiKey.trim(),
    };
  }

  getConfig(): OTAConfig | null {
    return this.config;
  }

  isConfigured(): boolean {
    return Boolean(this.config?.apiKey);
  }

  getLastCheckResult(): OTACheckUpdateResult | null {
    return this.cachedCheckResult;
  }

  setLastCheckResult(result: OTACheckUpdateResult | null): void {
    this.cachedCheckResult = result;
  }

  /**
   * Report telemetry event ("download" | "install") to the OTALink backend.
   * Non-blocking and resilient — catches failures so runtime updates are never disrupted.
   */
  async reportEvent(
    event: 'download' | 'install' | string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const apiKey = this.config?.apiKey;
    if (!apiKey) {
      console.warn('OTA: Cannot report event — apiKey is not configured.');
      return false;
    }

    const platform =
      this.config?.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');
    const bundleId = this.config?.bundleId || getAppId();

    const payload = {
      platform,
      bundleId,
      event,
      ...metadata,
    };

    const url = `${OTA_API_BASE_URL}${OTA_EVENTS_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ota-app-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      return res.ok;
    } catch (err: any) {
      console.warn(`OTA: Failed to report event "${event}":`, err?.message ?? err);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check for updates against the OTALink backend (POST /api/ota/public/check-update).
   * Zero apiKey needed here — automatically uses the apiKey from <OTAProvider apiKey="..." />.
   */
  async checkForUpdate(
    options?: OTACheckUpdateOptions
  ): Promise<OTACheckUpdateResult> {
    if (this.config?.disableInDev && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[OTA] checkForUpdate skipped: disableInDev is enabled.');
      return {
        updateAvailable: false,
        currentOtaVersion: getOtaVersion(),
        reason: 'OTA check disabled in __DEV__ mode',
        isBlackList: false,
      };
    }

    const apiKey = this.config?.apiKey;
    if (!apiKey) {
      throw new OTAError(
        'API_KEY_MISSING',
        'OTA: apiKey is required. Pass it once in <OTAProvider apiKey="..." /> at your app root.'
      );
    }

    const platform =
      options?.platform ??
      this.config?.platform ??
      (Platform.OS === 'ios' ? 'ios' : 'android');

    const bundleId = options?.bundleId ?? this.config?.bundleId ?? getAppId();

    const version_no =
      options?.version_no ??
      options?.appVersion ??
      getAppVersion();

    const currentOtaVersion = Number(
      options?.build_no ??
      options?.currentOtaVersion ??
      this.config?.currentOtaVersion ??
      getOtaVersion()
    );

    const build_no = currentOtaVersion;
    const rawChannel = options?.channel ?? this.config?.channel ?? 'production';
    if (rawChannel !== 'development' && rawChannel !== 'production') {
      throw new OTAError(
        'INVALID_CHANNEL',
        `OTA: Invalid channel "${rawChannel}". Allowed channels are only "development" | "production".`
      );
    }
    const channel: OTAChannel = rawChannel;

    const requestBody: Record<string, any> = {
      bundleId,
      platform,
      version_no,
      build_no,
      channel,
    };

    const url = `${OTA_API_BASE_URL}${OTA_CHECK_UPDATE_PATH}`;
    const timeoutMs = options?.timeoutMs ?? this.config?.timeoutMs ?? 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[OTA] checkForUpdate request =>', {
        url,
        method: 'POST',
        headers: {
          'x-ota-app-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
      });
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-ota-app-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new OTAError(
        'NETWORK_ERROR',
        `OTA: Network request failed when checking for updates — ${err?.message ?? err}`,
        err
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) {
      throw new OTAError('UNAUTHORIZED', 'OTA: Invalid API key (401 Unauthorized)');
    }
    if (res.status === 403) {
      throw new OTAError('FORBIDDEN', 'OTA: App bundle ID mismatch or app inactive (403 Forbidden)');
    }
    if (res.status === 404) {
      const emptyResult: OTACheckUpdateResult = {
        updateAvailable: false,
        currentOtaVersion,
        isBlackList: false,
      };
      this.cachedCheckResult = emptyResult;
      return emptyResult;
    }
    if (!res.ok) {
      throw new OTAError('NETWORK_ERROR', `OTA: Server returned HTTP status ${res.status}`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch (err: any) {
      throw new OTAError(
        'NETWORK_ERROR',
        'OTA: Failed to parse server response as JSON',
        err
      );
    }

    const data = json?.data ?? json;
    const updateAvailable = Boolean(data?.updateAvailable ?? data?.update_available);
    const rawRelease = data?.release ?? (data?.bundleUrl ? data : undefined);

    let release: OTAReleaseInfo | undefined;
    if (rawRelease && (rawRelease.bundleUrl || rawRelease.bundle_url || rawRelease.file_url)) {
      release = {
        id: String(rawRelease.id ?? rawRelease.releaseId ?? rawRelease._id ?? ''),
        platform: String(rawRelease.platform ?? Platform.OS),
        appVersion: rawRelease.appVersion ?? rawRelease.app_version,
        buildNumber: rawRelease.buildNumber ?? rawRelease.build_no,
        bundleUrl: rawRelease.bundleUrl ?? rawRelease.bundle_url ?? rawRelease.file_url,
        bundleSizeBytes: rawRelease.bundleSizeBytes ?? rawRelease.bundle_size_bytes,
        updateSilently: Boolean(rawRelease.updateSilently ?? rawRelease.update_silently),
        skipOnStoreUpdate: Boolean(rawRelease.skipOnStoreUpdate ?? rawRelease.skip_on_store_update),
        autoRestart:
          rawRelease.autoRestart !== undefined
            ? Boolean(rawRelease.autoRestart)
            : undefined,
        publishedAt: rawRelease.publishedAt ?? rawRelease.published_at,
      };
    }

    const bundleUrlToCheck = release?.bundleUrl;
    const nativeAppVersion = getAppVersion();
    const isBlackList = Boolean(
      bundleUrlToCheck
        ? await OTAStorage.getRejectedUrlInfo(bundleUrlToCheck, nativeAppVersion)
        : false
    );

    const result: OTACheckUpdateResult = {
      updateAvailable,
      ...(release ? { release } : {}),
      ...(currentOtaVersion !== undefined ? { currentOtaVersion } : {}),
      ...(data?.reason ? { reason: data.reason } : {}),
      isBlackList,
    };

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[OTA] checkForUpdate result =>', result);
    }

    this.cachedCheckResult = result;
    return result;
  }

  getActiveVersion(): number {
    return getOtaVersion();
  }

  getAppVersion(): string {
    return getAppVersion();
  }

  getOtaVersion(): number {
    return getOtaVersion();
  }

  getAppId(): string {
    return getAppId();
  }

  restartApp(): void {
    restartApp();
  }

  /**
   * Download and apply an OTA bundle zip file.
   * Downloads to temp directory, extracts into staging, validates bundle metadata,
   * promotes to active bundles directory, and optionally restarts.
   */
  async downloadAndApplyUpdate(
    options?: OTADownloadOptions
  ): Promise<{ updated: boolean; version?: number }> {
    const targetRelease = options?.release || this.getLastCheckResult()?.release;
    let url =
      targetRelease?.bundleUrl ??
      targetRelease?.bundle_url ??
      targetRelease?.file_url;

    const { onProgress, onError, autoRestart } = options || {};

    if (!url) {
      const err = new OTAError(
        'DOWNLOAD_FAILED',
        'OTA: No release provided and no active release found from checkForUpdate().'
      );
      onError?.(err.toPayload());
      throw err;
    }

    const apiKey = this.config?.apiKey;
    const downloadHeaders: Record<string, string> = {
      Accept: 'application/octet-stream, application/zip, */*',
    };
    if (apiKey) {
      downloadHeaders['x-ota-app-key'] = apiKey;
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[OTA] downloadAndApplyUpdate downloading from =>', {
        url,
        headers: downloadHeaders,
      });
    }

    const nativeVersion = getAppVersion();
    const nativeAppId = getAppId();

    const isBlacklisted = await OTAStorage.getRejectedUrlInfo(url, nativeVersion);
    if (isBlacklisted) {
      const err = new OTAError(
        'UPDATE_BLACKLISTED',
        `OTA: Bundle at ${url} was previously rejected and blacklisted for this native build.`
      );
      onError?.(err.toPayload());
      throw err;
    }

    if (isDownloading) {
      const err = new OTAError(
        'ALREADY_IN_PROGRESS',
        'OTA: Another download/update operation is already in progress'
      );
      onError?.(err.toPayload());
      throw err;
    }

    isDownloading = true;

    let lastProgress: OTAProgressPayload = {
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      downloadedMB: '0.00',
      totalMB: '0.00',
      status: 'idle',
    };

    const emit = (partial: Partial<OTAProgressPayload>) => {
      lastProgress = {
        ...lastProgress,
        ...partial,
      };
      onProgress?.(lastProgress);
    };

    try {
      emit({ status: 'checking', percentage: 0 });

      const zipPath = await OTADownloader.downloadBundle(
        url,
        (payload) => {
          emit(payload);
        },
        downloadHeaders
      );

      emit({ status: 'downloaded', percentage: 100 });

      // Automatically report "download" event to OTALink backend if configured
      if (!this.reportedDownloads.has(url)) {
        this.reportedDownloads.add(url);
        this.reportEvent('download').catch(() => {});
      }

      const stagingDir = await OTAStorage.extractToStaging(zipPath);

      const meta = await OTAStorage.readBundleMeta(stagingDir);
      if (!meta) {
        throw new OTAError(
          'INVALID_META',
          'OTA: Missing or invalid meta.json in staged bundle'
        );
      }
      const metaOtaVersion = Number(meta.otaVersion);

      if (!metaOtaVersion || isNaN(metaOtaVersion) || metaOtaVersion <= 0) {
        throw new OTAError(
          'INVALID_META',
          `OTA: Invalid or missing otaVersion in staged bundle meta.json: "${meta.otaVersion}"`
        );
      }

      if (!meta.appId || (nativeAppId && meta.appId !== nativeAppId)) {
        throw new OTAError(
          'APP_ID_MISMATCH',
          meta.appId
            ? `OTA: App ID mismatch — bundle is built for ${meta.appId}, but device is running ${nativeAppId}`
            : `OTA: App ID missing in bundle — bundles must be built with a valid appId matching ${nativeAppId}`
        );
      }

      if (meta.appVersion !== nativeVersion) {
        throw new OTAError(
          'APP_VERSION_MISMATCH',
          `OTA: App version mismatch — bundle is built for native ${meta.appVersion}, but device is running ${nativeVersion}`
        );
      }

      const currentChannel = this.config?.channel || 'production';
      const bundleChannel = meta.channel || 'production';
      if (bundleChannel !== currentChannel) {
        throw new OTAError(
          'CHANNEL_MISMATCH',
          `OTA: Channel mismatch — bundle is built for channel "${bundleChannel}", but device is configured for channel "${currentChannel}"`
        );
      }

      const activeVersion = getOtaVersion();
      if (metaOtaVersion <= activeVersion) {
        await OTAStorage.cleanupStaging();
        emit({ status: 'idle', percentage: 100 });
        return { updated: false, version: activeVersion };
      }

      const targetOtaVersion = metaOtaVersion;
      await OTAStorage.promoteStaging(targetOtaVersion);

      const isAndroid = Platform.OS === 'android';
      const bundleFileName = isAndroid
        ? OTA_BUNDLE_FILE_NAME
        : OTA_BUNDLE_FILE_NAME_IOS;

      const bundleDir = OTAStorage.bundleDirForVersion(targetOtaVersion);
      const activeBundlePath = `${bundleDir}/${bundleFileName}`;

      const newManifest: OTACurrentInfo = {
        activeVersion: targetOtaVersion,
        activeBundlePath,
        updatedAt: new Date().toISOString(),
        bootFailCount: 0,
        builtForNativeVersion: nativeVersion,
      };

      try {
        await OTAStorage.writeCurrent(newManifest);
        await OTAStorage.clearRejectedUpdates();
      } catch (err: any) {
        throw new OTAError(
          'STORAGE_ERROR',
          `OTA: Failed to write current.json manifest — ${err?.message ?? err}`,
          err
        );
      }

      emit({ status: 'downloaded', percentage: 100 });

      if (autoRestart === true) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        emit({ status: 'installed', percentage: 100 });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        restartApp();
      }

      return { updated: true, version: targetOtaVersion };
    } catch (err: any) {
      await OTAStorage.cleanupStaging();

      if (
        err instanceof OTAError &&
        (err.code === 'APP_ID_MISMATCH' ||
          err.code === 'APP_VERSION_MISMATCH' ||
          err.code === 'CHANNEL_MISMATCH' ||
          err.code === 'INVALID_META')
      ) {
        await OTAStorage.addRejectedUrl(url, err.message, nativeVersion);
      }

      emit({ status: 'failed', percentage: 0 });

      const otaErrorPayload: OTAErrorPayload =
        err instanceof OTAError
          ? err.toPayload()
          : {
              code: 'UNKNOWN_ERROR',
              message: String(err?.message ?? err),
              originalError: err,
            };

      onError?.(otaErrorPayload);
      throw err;
    } finally {
      isDownloading = false;
    }
  }

  /**
   * Called on app boot to confirm that native JS bundle loaded successfully.
   * If this is the first boot after an update restart, reports the "install" event
   * to the OTALink dashboard and purges older inactive bundles.
   */
  async reportBootSuccess(): Promise<void> {
    try {
      await confirmNativeBootSuccess();

      const current = await OTAStorage.readCurrent();
      if (!current) return;

      if (current.bootFailCount !== 0) {
        current.bootFailCount = 0;
        await OTAStorage.writeCurrent(current);
      }

      // Telemetry: report post-restart first-run install event
      const currentOtaVersion = getOtaVersion();
      if (currentOtaVersion > 0) {
        const isReported = await OTAStorage.isInstallReported(currentOtaVersion);
        if (!isReported) {
          const success = await this.reportEvent('install', {
            otaVersion: currentOtaVersion,
          });
          if (success) {
            await OTAStorage.markInstallReported(currentOtaVersion);
          }
        }
      }

      // Clean up older stale bundle directories on disk
      if (typeof current.activeVersion === 'number' && current.activeVersion > 0) {
        await OTAStorage.cleanupStaleBundles(current.activeVersion);
      }
    } catch (err: any) {
      console.warn('OTA: reportBootSuccess error:', err?.message ?? err);
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

export const OTA = new OTAServiceClass();
export const OTAService = OTA;
export const OTALink = OTA; // Backward-compatible alias
