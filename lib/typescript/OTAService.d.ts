import type { OTADownloadOptions } from './OTATypes';
declare class OTAServiceClass {
    getActiveVersion(): Promise<number>;
    downloadAndApplyUpdate(options: OTADownloadOptions): Promise<{
        updated: boolean;
        version?: number;
    }>;
    reportBootSuccess(): Promise<void>;
    reportBootFailure(): Promise<{
        rolledBack: boolean;
    }>;
    getActiveBundlePathForNative(): Promise<string | null>;
}
export declare const OTAService: OTAServiceClass;
export {};
//# sourceMappingURL=OTAService.d.ts.map