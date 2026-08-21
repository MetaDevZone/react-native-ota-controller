import type { OTACurrentInfo } from './OTATypes';
export type BundleMeta = {
    appVersion: string;
    otaVersion?: number;
    builtAt?: string;
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
    clearAll(): Promise<void>;
    readBundleMeta(bundleDir: string): Promise<BundleMeta | null>;
}
export declare const OTAStorage: OTAStorageClass;
export {};
//# sourceMappingURL=OTAStorage.d.ts.map