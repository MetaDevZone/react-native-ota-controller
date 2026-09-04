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
declare class OTAStorageClass {
    ensureRootDirs(): Promise<void>;
    bundleDirForVersion(version: number): string;
    extractBundle(zipPath: string, version: number): Promise<string>;
    extractToStaging(zipPath: string): Promise<string>;
    promoteStaging(version: number): Promise<string>;
    cleanupStaging(): Promise<void>;
    readCurrent(): Promise<OTACurrentInfo | null>;
    writeCurrent(info: OTACurrentInfo): Promise<void>;
    deleteBundleVersion(version: number): Promise<void>;
    cleanupStaleBundles(keepVersion: number): Promise<void>;
    clearAll(): Promise<void>;
    readBundleMeta(bundleDir: string): Promise<BundleMeta | null>;
    readRejectedUpdates(currentNativeVersion: string): Promise<RejectedUpdatesData>;
    getRejectedUrlInfo(url: string, currentNativeVersion: string): Promise<RejectedEntry | null>;
    addRejectedUrl(url: string, reason: string, currentNativeVersion: string): Promise<void>;
    clearRejectedUpdates(): Promise<void>;
    markInstallReported(version: number): Promise<void>;
    isInstallReported(version: number): Promise<boolean>;
}
export declare const OTAStorage: OTAStorageClass;
export {};
//# sourceMappingURL=OTAStorage.d.ts.map