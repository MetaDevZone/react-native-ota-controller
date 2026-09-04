import type { OTAConfig, OTACheckUpdateOptions, OTACheckUpdateResult, OTADownloadOptions, OTAErrorCode, OTAErrorPayload } from './OTATypes';
export declare class OTAError extends Error {
    code: OTAErrorCode;
    originalError?: any;
    constructor(code: OTAErrorCode, message: string, originalError?: any);
    toPayload(): OTAErrorPayload;
}
declare class OTAServiceClass {
    private config;
    private cachedCheckResult;
    private reportedDownloads;
    /**
     * Configure global credentials for the OTALink SDK.
     * Called automatically by <OTAProvider apiKey="..." /> on mount.
     */
    configure(config: OTAConfig): void;
    getConfig(): OTAConfig | null;
    isConfigured(): boolean;
    getLastCheckResult(): OTACheckUpdateResult | null;
    setLastCheckResult(result: OTACheckUpdateResult | null): void;
    /**
     * Report telemetry event ("download" | "install") to the OTALink backend.
     * Non-blocking and resilient — catches failures so runtime updates are never disrupted.
     */
    reportEvent(event: 'download' | 'install' | string, metadata?: Record<string, any>): Promise<boolean>;
    /**
     * Check for updates against the OTALink backend (POST /api/ota/public/check-update).
     * Zero apiKey needed here — automatically uses the apiKey from <OTAProvider apiKey="..." />.
     */
    checkForUpdate(options?: OTACheckUpdateOptions): Promise<OTACheckUpdateResult>;
    getActiveVersion(): number;
    getAppVersion(): string;
    getOtaVersion(): number;
    getAppId(): string;
    restartApp(): void;
    /**
     * Download and apply an OTA bundle zip file.
     * Downloads to temp directory, extracts into staging, validates bundle metadata,
     * promotes to active bundles directory, and optionally restarts.
     */
    downloadAndApplyUpdate(options?: OTADownloadOptions): Promise<{
        updated: boolean;
        version?: number;
    }>;
    /**
     * Called on app boot to confirm that native JS bundle loaded successfully.
     * If this is the first boot after an update restart, reports the "install" event
     * to the OTALink dashboard and purges older inactive bundles.
     */
    reportBootSuccess(): Promise<void>;
    reportBootFailure(): Promise<{
        rolledBack: boolean;
    }>;
    getActiveBundlePathForNative(): Promise<string | null>;
}
export declare const OTA: OTAServiceClass;
export declare const OTAService: OTAServiceClass;
export declare const OTALink: OTAServiceClass;
export {};
//# sourceMappingURL=OTAService.d.ts.map