import type { OTADownloadOptions, OTAErrorCode, OTAErrorPayload } from './OTATypes';
export declare class OTAError extends Error {
    code: OTAErrorCode;
    originalError?: any;
    constructor(code: OTAErrorCode, message: string, originalError?: any);
    toPayload(): OTAErrorPayload;
}
declare class OTAServiceClass {
    getActiveVersion(): number;
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