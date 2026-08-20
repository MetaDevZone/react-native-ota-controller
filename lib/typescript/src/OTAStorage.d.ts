import type { OTACurrentInfo } from './OTATypes';
export type BundleMeta = {
    appVersion: string;
    androidOtaVersion?: number;
    iosOtaVersion?: number;
    builtAt?: string;
};
declare class OTAStorageClass {
    ensureRootDirs(): Promise<void>;
    bundleDirForVersion(version: number): string;
    extractBundle(zipPath: string, version: number): Promise<string>;
    readCurrent(): Promise<OTACurrentInfo | null>;
    writeCurrent(info: OTACurrentInfo): Promise<void>;
    deleteBundleVersion(version: number): Promise<void>;
    clearAll(): Promise<void>;
    readBundleMeta(bundleDir: string): Promise<BundleMeta | null>;
}
export declare const OTAStorage: OTAStorageClass;
export {};
//# sourceMappingURL=OTAStorage.d.ts.map