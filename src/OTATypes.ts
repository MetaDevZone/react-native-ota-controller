export type EventName = 'download' | 'install' | (string & {});

export interface OTACurrentInfo {
  activeVersion: number;
  activeBundlePath: string;
  updatedAt: string;
  bootFailCount: number;
  builtForNativeVersion: string;
  installReportedVersion?: number;
}

export interface OTAProgressPayload {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  downloadedMB: string;
  totalMB: string;
  status:
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'downloaded'
    | 'installed'
    | 'upToDate'
    | 'failed';
}

export type OTAProgressCallback = (payload: OTAProgressPayload) => void;

export type OTAChannel = 'development' | 'production';

export type OTAErrorCode =
  | 'DOWNLOAD_FAILED'
  | 'EXTRACTION_FAILED'
  | 'INVALID_META'
  | 'APP_ID_MISMATCH'
  | 'APP_VERSION_MISMATCH'
  | 'CHANNEL_MISMATCH'
  | 'INVALID_CHANNEL'
  | 'ALREADY_IN_PROGRESS'
  | 'STORAGE_ERROR'
  | 'UPDATE_BLACKLISTED'
  | 'API_KEY_MISSING'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NO_ACTIVE_RELEASE'
  | 'UNKNOWN_ERROR';

export interface OTAErrorPayload {
  code: OTAErrorCode;
  message: string;
  originalError?: any;
}

export type OTAErrorCallback = (error: OTAErrorPayload) => void;

export interface OTADownloadOptions {
  release?: OTAReleaseInfo;
  autoRestart?: boolean;
  onProgress?: OTAProgressCallback;
  onError?: OTAErrorCallback;
}

export interface OTACheckUpdateOptions {
  apiKey?: string;
  channel?: OTAChannel;
  bundleId?: string;
  platform?: 'ios' | 'android';
  version_no?: string | number;
  build_no?: number | string;
  currentOtaVersion?: number | string;
  buildNumber?: string | number;
  appVersion?: string;
  timeoutMs?: number;
}

export interface OTAConfig {
  apiKey: string;
  channel?: OTAChannel;
  disableInDev?: boolean;
  bundleId?: string;
  platform?: 'ios' | 'android';
  version_no?: string | number;
  build_no?: number | string;
  currentOtaVersion?: number;
  buildNumber?: string | number;
  timeoutMs?: number;
}

export type OTALinkConfig = OTAConfig;

export interface OTAReleaseInfo {
  id: string;
  platform?: string;
  appVersion?: string;
  buildNumber?: number | string;
  bundleUrl: string;
  bundleSizeBytes?: number;
  updateSilently?: boolean;
  skipOnStoreUpdate?: boolean;
  autoRestart?: boolean;
  publishedAt?: string;
  [key: string]: any;
}

export interface OTACheckUpdateResult {
  updateAvailable: boolean;
  release?: OTAReleaseInfo;
  currentOtaVersion?: number;
  reason?: string;
  isBlackList?: boolean;
}

export type OTASyncStatus =
  | 'UP_TO_DATE'
  | 'UPDATE_INSTALLED'
  | 'UPDATE_IGNORED'
  | 'ERROR';

export interface OTASyncOptions {
  beforeDownload?: (release: OTAReleaseInfo) => boolean | Promise<boolean>;
  autoRestart?: boolean;
  onProgress?: OTAProgressCallback;
  onError?: OTAErrorCallback;
}

export interface OTASyncResult {
  status: OTASyncStatus;
  release?: OTAReleaseInfo;
  error?: OTAErrorPayload;
  version?: number;
}

