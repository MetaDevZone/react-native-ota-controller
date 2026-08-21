export interface OTACurrentInfo {
  activeVersion: number;
  activeBundlePath: string;
  updatedAt: string;
  bootFailCount: number;
  builtForNativeVersion: string;
}

export interface OTAProgressPayload {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  downloadedMB: string;
  totalMB: string;
  status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'installed' | 'failed';
}

export type OTAProgressCallback = (payload: OTAProgressPayload) => void;

export type OTAErrorCode =
  | 'DOWNLOAD_FAILED'
  | 'EXTRACTION_FAILED'
  | 'INVALID_META'
  | 'APP_VERSION_MISMATCH'
  | 'ALREADY_IN_PROGRESS'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

export interface OTAErrorPayload {
  code: OTAErrorCode;
  message: string;
  originalError?: any;
}

export type OTAErrorCallback = (error: OTAErrorPayload) => void;

export interface OTADownloadOptions {
  url: string;
  autoRestart?: boolean;
  onProgress?: OTAProgressCallback;
  onError?: OTAErrorCallback;
}
