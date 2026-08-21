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
export interface OTADownloadOptions {
    downloadUrl: string;
    bundleVersion?: number;
    autoRestart?: boolean;
    onProgress: OTAProgressCallback;
}
//# sourceMappingURL=OTATypes.d.ts.map